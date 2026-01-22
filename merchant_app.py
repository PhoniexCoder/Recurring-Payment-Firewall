# uvicorn merchant_app:app --reload --port 8000
#  score transaction
''' 
seed cancellation
Invoke-RestMethod -Uri "http://127.0.0.1:8000/seed-policies" `
-Method Post

score transaction
Invoke-RestMethod -Uri "http://127.0.0.1:8000/score-transaction" `
-Method Post `
-ContentType "application/json" `
-Body '{"merchant_id":"NEW_M_777","merchant_name":"Netfl1x Officia1 Ltd","amount":0.99}'

investigate using gemini and steps further
Invoke-RestMethod -Uri "http://127.0.0.1:8000/investigate-transaction" `
-Method Post `
-ContentType "application/json" `
-Body '{
  "merchant_id": "NEW_M_777",
  "merchant_name": "Netfl1x Officia1 Ltd",
  "amount": 0.99,
  "decision": "REVIEW",
  "merchant_trust_score": 25,
  "rename_similarity_score": 91,
  "closest_company_match": "netflix",
  "patterns_detected": ["NEW_MERCHANT","MERCHANT_REBRAND_PATTERN"]
}'

'''


# uvicorn merchant_app:app --reload --port 8000

import pandas as pd
import numpy as np
import re
import ast
from rapidfuzz import fuzz, process
from datetime import datetime
from sklearn.metrics import confusion_matrix
from fastapi import FastAPI, Query, HTTPException
from pydantic import BaseModel

# -----------------------------
# ✅ MongoDB
# -----------------------------
from pymongo import MongoClient, ASCENDING

# -----------------------------
# ✅ Gemini
# -----------------------------
import os
import json
from dotenv import load_dotenv
import google.generativeai as genai


# =============================
# ENV / CONFIG
# =============================
load_dotenv()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()
GEMINI_MODEL_NAME = os.getenv("GEMINI_MODEL_NAME", "gemini-1.5-flash")  # fast for hackathon

if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)
    gemini_model = genai.GenerativeModel(GEMINI_MODEL_NAME)
else:
    gemini_model = None


MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
DB_NAME = "recurring_firewall"

try:
    mongo_client = MongoClient(MONGO_URI)
    db = mongo_client[DB_NAME]

    transactions_col = db["transactions"]
    merchant_profiles_col = db["merchant_profiles"]
    merchant_rename_events_col = db["merchant_rename_events"]
    merchant_policies_col = db["merchant_policies"]
    case_logs_col = db["case_logs"]
    eval_logs_col = db["evaluation_logs"]
    subscription_snapshots_col = db["subscription_snapshots"]

    # indexes
    merchant_profiles_col.create_index([("merchant_id", ASCENDING)], unique=True)
    merchant_policies_col.create_index([("merchant_key", ASCENDING)], unique=True)
    merchant_policies_col.create_index([("merchant_name", ASCENDING)])

    # Helper for robust TTL index creation
    def ensure_ttl_index(col, field, seconds):
        try:
            col.create_index(field, expireAfterSeconds=seconds)
        except Exception as e:
            if "IndexOptionsConflict" in str(e):
                try:
                    # Drop conflicting index and retry
                    col.drop_index(f"{field}_1")
                    col.create_index(field, expireAfterSeconds=seconds)
                except:
                    pass

    # ✅ Retention + compound indexes
    transactions_col.create_index([("merchant_id", ASCENDING), ("timestamp", ASCENDING)])
    ensure_ttl_index(transactions_col, "timestamp", 180 * 24 * 3600)

    merchant_rename_events_col.create_index([("merchant_id", ASCENDING), ("timestamp", ASCENDING)])
    ensure_ttl_index(merchant_rename_events_col, "timestamp", 180 * 24 * 3600)

    ensure_ttl_index(case_logs_col, "timestamp", 180 * 24 * 3600)
    ensure_ttl_index(eval_logs_col, "timestamp", 180 * 24 * 3600)
    ensure_ttl_index(subscription_snapshots_col, "timestamp", 180 * 24 * 3600)

    MONGO_OK = True
except Exception as e:
    print("[MongoDB ERROR]", e)
    MONGO_OK = False


app = FastAPI(title="Recurring Payment Firewall API + Gemini RAG", version="2.0")


# =============================
# Helpers
# =============================
def normalize_name(x: str) -> str:
    x = str(x).lower()
    x = re.sub(r"[^a-z0-9\s]", " ", x)
    x = re.sub(r"\s+", " ", x).strip()

    stop = {
        "pvt", "private", "ltd", "limited", "llp", "inc", "co", "company", "corp",
        "official", "store", "shop", "online", "services", "service", "solutions",
        "technology", "technologies", "international", "group", "payments", "pay"
    }
    tokens = [t for t in x.split() if t not in stop]
    return " ".join(tokens).strip()


def safe_parse_patterns(x):
    if x is None or (isinstance(x, float) and pd.isna(x)):
        return []
    if isinstance(x, list):
        return x
    x = str(x).strip()

    try:
        v = ast.literal_eval(x)
        if isinstance(v, list):
            return [str(i) for i in v]
    except Exception:
        pass

    if "," in x:
        return [p.strip() for p in x.split(",") if p.strip()]
    return [x] if x else []


def mongo_safe_insert(col, doc: dict):
    if not MONGO_OK:
        return False
    try:
        col.insert_one(doc)
        return True
    except Exception as e:
        print("[MongoDB Insert Error]", e)
        return False


def mongo_safe_update_profile(merchant_id: str, merchant_name: str, amount: float, decision: str):
    if not MONGO_OK:
        return False

    try:
        now = datetime.utcnow()
        merchant_profiles_col.update_one(
            {"merchant_id": merchant_id},
            {
                "$set": {
                    "merchant_name_latest": merchant_name,
                    "last_seen": now
                },
                "$addToSet": {
                    "known_names": merchant_name
                },
                "$inc": {
                    "stats_180d.tx_count": 1,
                    "stats_180d.total_amount": float(amount or 0),
                    f"stats_180d.decisions.{decision}": 1
                }
            },
            upsert=True
        )
        return True
    except Exception as e:
        print("[MongoDB Update Error]", e)
        return False


# =============================
# Load Master CSV (Merchant Profiles)
# =============================
MASTER_CSV_PATH = r"C:\Users\thapa\Desktop\project\Online retial II\MERGED MASTER NOTEBOOK\merged_master_firewall_output.csv"
master_df = pd.read_csv(MASTER_CSV_PATH)
master_df["merchant_id"] = master_df["merchant_id"].astype(str).str.strip()

if "patterns_detected" in master_df.columns:
    master_df["patterns_detected"] = master_df["patterns_detected"].apply(safe_parse_patterns)

merchant_lookup = master_df.set_index("merchant_id").to_dict(orient="index")


# =============================
# Load Company Names dataset
# =============================
COMPANY_CSV_PATH = r"C:\Users\thapa\Desktop\project\Online retial II\company names\Company Names.csv"
companies_df = pd.read_csv(COMPANY_CSV_PATH)

companies_df.columns = [c.strip().lower() for c in companies_df.columns]
possible_name_cols = ["name", "company", "company_name", "business_name", "organization", "organisation"]
name_col = None
for c in possible_name_cols:
    if c in companies_df.columns:
        name_col = c
        break
if name_col is None:
    name_col = companies_df.columns[0]

companies_df = companies_df.dropna(subset=[name_col])
companies_df[name_col] = companies_df[name_col].astype(str)
companies_df["clean_name"] = companies_df[name_col].apply(normalize_name)
company_list = companies_df["clean_name"].dropna().unique().tolist()

# -----------------------------
# Banksim Data (for Evaluation)
# -----------------------------
DF_SCORING_PATH = r"C:\Users\thapa\Desktop\project\df_scoring.csv"
SUB_PATH        = r"C:\Users\thapa\Desktop\project\sub.csv"

try:
    df_scoring = pd.read_csv(DF_SCORING_PATH)
    sub_df = pd.read_csv(SUB_PATH)
    if "fraud" in df_scoring.columns:
        df_scoring["fraud"] = df_scoring["fraud"].fillna(0).astype(int)
    print(f"[INIT] Loaded Banksim tx: {len(df_scoring)}, Subscriptions: {len(sub_df)}")
except Exception as e:
    print(f"[Banksim Load Error] {e}")
    df_scoring = pd.DataFrame()
    sub_df = pd.DataFrame()

print(f"[INIT] Loaded master merchants: {len(master_df)}")
print(f"[INIT] Loaded company names: {len(company_list)} (from column: {name_col})")
print(f"[INIT] MongoDB enabled: {MONGO_OK}")
print(f"[INIT] Gemini enabled : {bool(GEMINI_API_KEY)} | model={GEMINI_MODEL_NAME}")


def rename_similarity_score(merchant_name: str):
    q = normalize_name(merchant_name)
    if not q or len(q) < 3 or len(company_list) == 0:
        return "", 0
    best = process.extractOne(q, company_list, scorer=fuzz.token_sort_ratio)
    if best is None:
        return "", 0
    return best[0], int(best[1])


def compute_metrics(sub_eval: pd.DataFrame):
    y_true = sub_eval["fraud"].astype(int).values
    y_pred = sub_eval["pred"].astype(int).values

    tn, fp, fn, tp = confusion_matrix(y_true, y_pred, labels=[0, 1]).ravel()
    fpr = fp / (fp + tn + 1e-9)
    recall = tp / (tp + fn + 1e-9)
    precision = tp / (tp + fp + 1e-9)

    return {
        "precision": float(precision),
        "recall": float(recall),
        "fpr": float(fpr),
        "confusion": {"tn": int(tn), "fp": int(fp), "fn": int(fn), "tp": int(tp)}
    }


def guidance_from_decision(decision: str):
    if decision == "ALLOW":
        return "Payment looks safe. Subscription can proceed."
    if decision == "REVIEW":
        return (
            "This subscription looks suspicious. Recommended: step-up authentication (OTP), "
            "or show warning + allow one-click cancellation."
        )
    return (
        "High risk recurring payment. Recommended: BLOCK transaction, alert user, "
        "and provide cancellation steps via bank app → Recurring Payments → Disable Merchant."
    )


def build_reasons(row: dict):
    reasons = []

    trust = row.get("merchant_trust_score", None)
    if trust is not None:
        try:
            trust = float(trust)
            if trust < 55:
                reasons.append(f"Low merchant trust score: {trust:.1f}/100")
        except:
            pass

    patterns = safe_parse_patterns(row.get("patterns_detected", []))
    if len(patterns) > 0:
        reasons.append("Patterns detected: " + ", ".join(patterns))

    rename = row.get("rename_similarity_score", None)
    if rename is not None:
        try:
            rename = int(rename)
            if rename >= 80:
                reasons.append(f"Merchant name similar to known companies (rename similarity: {rename})")
        except:
            pass

    micro = row.get("microcharge_rate", None)
    if micro is not None and micro != "":
        try:
            micro = float(micro)
            if micro > 0.5:
                reasons.append(f"High microcharge rate: {micro:.2f}")
        except:
            pass

    spike = row.get("spike_ratio", None)
    if spike is not None and spike != "":
        try:
            spike = float(spike)
            if spike > 5:
                reasons.append(f"Abnormal transaction spike ratio: {spike:.2f}")
        except:
            pass

    anomaly = row.get("anomaly_score", None)
    if anomaly is not None and anomaly != "":
        try:
            anomaly = float(anomaly)
            if anomaly > 0.75:
                reasons.append(f"Merchant anomaly score high: {anomaly:.2f}")
        except:
            pass

    if len(reasons) == 0:
        reasons.append("No high-risk signals detected.")

    return reasons[:5]


# =============================
# Schemas
# =============================
class TransactionRequest(BaseModel):
    merchant_id: str | None = None
    merchant_name: str | None = None
    customer_id: str | None = None
    amount: float | None = None
    currency: str | None = "USD"
    timestamp: str | None = None


class InvestigateRequest(BaseModel):
    merchant_id: str | None = None
    merchant_name: str | None = None
    amount: float | None = None
    decision: str | None = None
    merchant_trust_score: float | None = None
    rename_similarity_score: int | None = None
    closest_company_match: str | None = None
    patterns_detected: list[str] | None = []


# =============================
# RAG helpers
# =============================
def fetch_rag_context(merchant_id: str, merchant_name: str):
    """Mongo-only RAG (no vector DB): history + profile + policies."""
    if not MONGO_OK:
        return {"mongo_enabled": False}

    profile = merchant_profiles_col.find_one({"merchant_id": merchant_id}, {"_id": 0}) or {}

    recent_tx = list(
        transactions_col.find({"merchant_id": merchant_id}, {"_id": 0})
        .sort("timestamp", -1)
        .limit(10)
    )

    rename_events = list(
        merchant_rename_events_col.find({"merchant_id": merchant_id}, {"_id": 0})
        .sort("timestamp", -1)
        .limit(5)
    )

    # simple policy match: by first keyword in merchant name
    merchant_key = normalize_name(merchant_name).split(" ")[0] if merchant_name else ""
    policy = None
    if merchant_key:
        policy = merchant_policies_col.find_one({"merchant_key": merchant_key}, {"_id": 0})

    return {
        "mongo_enabled": True,
        "merchant_profile_180d": profile,
        "recent_transactions": recent_tx,
        "rename_events": rename_events,
        "policy": policy or {}
    }


def build_gemini_prompt(payload: dict, rag: dict):
    return f"""
You are an expert Fraud Analyst Assistant in a bank working on a system called "Recurring Payment Firewall".

GOAL:
Generate real-time investigation notes for a subscription/recurring payment related merchant.

STRICT RULES:
- Only use evidence from the input payload + RAG context.
- If unknown, say "insufficient evidence".
- Give actionable next steps for bank + customer.
- Output MUST be valid JSON only.

INPUT PAYLOAD:
{payload}

RAG CONTEXT:
{rag}

OUTPUT JSON FORMAT:
{{
  "risk_summary": "2 lines max",
  "key_reasons": ["...", "...", "..."],
  "evidence": [
    {{"signal":"...", "value":"...", "meaning":"..."}}
  ],
  "recommended_bank_action": ["...", "..."],
  "customer_guidance": ["...", "..."],
  "cancellation_instructions": ["Step 1...", "Step 2...", "Step 3..."],
  "confidence": "LOW/MEDIUM/HIGH"
}}
""".strip()


def safe_parse_gemini_json(text: str):
    """Gemini may return JSON wrapped in ```json ...```; handle safely."""
    t = text.strip()

    # remove ```json blocks if any
    if t.startswith("```"):
        t = re.sub(r"^```[a-zA-Z]*", "", t).strip()
        if t.endswith("```"):
            t = t[:-3].strip()

    # try json parse
    try:
        return json.loads(t)
    except Exception:
        return {"raw_text": text, "error": "LLM output not valid JSON"}


# =============================
# Endpoints
# =============================
@app.get("/")
def home():
    return {
        "message": "Recurring Payment Firewall API + Gemini RAG is running",
        "version": "2.0",
        "mongo_enabled": MONGO_OK,
        "gemini_enabled": bool(GEMINI_API_KEY),
        "endpoints": [
            "/score-transaction",
            "/merchant/{merchant_id}",
            "/merchant-history/{merchant_id}",
            "/mongo-status",
            "/seed-policies",
            "/investigate-transaction",
            "/evaluate-subscriptions",
            "/evaluation-history"
        ]
    }


@app.get("/evaluation-history")
def evaluation_history(limit: int = Query(10, ge=1, le=200)):
    if not MONGO_OK:
        return {"ok": False, "error": "MongoDB not connected"}

    rows = list(eval_logs_col.find({}, {"_id": 0}).sort("timestamp", -1).limit(limit))
    return {"ok": True, "count": len(rows), "history": rows}


@app.get("/evaluate-subscriptions")
def evaluate_subscriptions(
    tune_fpr: bool = Query(False),
    fpr_target: float = Query(0.01, ge=0.0, le=1.0),
    save_snapshot: bool = Query(True, description="Store top risky subscriptions snapshot in MongoDB")
):
    if df_scoring.empty or sub_df.empty:
        raise HTTPException(status_code=500, detail="Banksim data not loaded")

    # --- subscription fraud truth ---
    sub_true = df_scoring.groupby("subscription_id")["fraud"].max().reset_index()

    # merge predictions with truth
    sub_eval = sub_df.merge(sub_true, on="subscription_id", how="left").fillna(0)
    sub_eval["fraud"] = sub_eval["fraud"].astype(int)

    # default prediction: based on decision
    if not tune_fpr:
        if "decision" not in sub_eval.columns:
            raise HTTPException(status_code=400, detail="sub.csv must contain 'decision' column when tune_fpr=false")

        sub_eval["pred"] = sub_eval["decision"].isin(["REVIEW", "BLOCK"]).astype(int)
        metrics = compute_metrics(sub_eval)

        response = {
            "mode": "decision_based",
            "n_subscriptions": int(len(sub_eval)),
            "metrics": metrics
        }
    else:
        # tuned threshold using max_fraud_prob
        if "max_fraud_prob" not in sub_eval.columns:
            raise HTTPException(status_code=400, detail="sub.csv must contain 'max_fraud_prob' for threshold tuning")

        thresholds = np.linspace(0.0, 1.0, 2001)
        best = None

        for t in thresholds:
            y_pred = (sub_eval["max_fraud_prob"].astype(float) >= t).astype(int)
            tn, fp, fn, tp = confusion_matrix(sub_eval["fraud"].values, y_pred, labels=[0, 1]).ravel()
            fpr = fp / (fp + tn + 1e-9)

            if fpr <= fpr_target:
                recall = tp / (tp + fn + 1e-9)
                precision = tp / (tp + fp + 1e-9)
                if best is None or recall > best["recall"]:
                    best = {
                        "threshold": float(t),
                        "precision": float(precision),
                        "recall": float(recall),
                        "fpr": float(fpr),
                        "confusion": {"tn": int(tn), "fp": int(fp), "fn": int(fn), "tp": int(tp)},
                    }

        if best is None:
            response = {
                "mode": "tuned_threshold",
                "status": "FAILED",
                "message": f"No threshold achieved FPR <= {fpr_target}",
                "n_subscriptions": int(len(sub_eval))
            }
        else:
            # apply best threshold predictions
            sub_eval["pred"] = (sub_eval["max_fraud_prob"].astype(float) >= best["threshold"]).astype(int)
            response = {
                "mode": "tuned_threshold",
                "status": "OK",
                "n_subscriptions": int(len(sub_eval)),
                "fpr_target": float(fpr_target),
                "best": best
            }

    # ✅ MongoDB logs
    mongo_safe_insert(eval_logs_col, {
        "timestamp": datetime.utcnow(),
        "mode": response.get("mode"),
        "tune_fpr": bool(tune_fpr),
        "fpr_target": float(fpr_target),
        "n_subscriptions": int(response.get("n_subscriptions", 0)),
        "response": response
    })

    # ✅ Snapshot
    if save_snapshot and MONGO_OK and "final_abuse_score" in sub_eval.columns:
        try:
            top15 = (
                sub_eval.sort_values("final_abuse_score", ascending=False)
                .head(15)[[
                    "subscription_id",
                    "decision",
                    "final_abuse_score",
                    "rule_abuse_score",
                    "subscription_anomaly_score"
                ]]
                .fillna(0)
                .to_dict(orient="records")
            )
            mongo_safe_insert(subscription_snapshots_col, {
                "timestamp": datetime.utcnow(),
                "type": "top15_riskiest_subscriptions",
                "items": top15
            })
        except Exception as e:
            print("[Snapshot Error]", e)

    return response


@app.get("/mongo-status")
def mongo_status():
    if not MONGO_OK:
        return {"mongo": "DISCONNECTED", "ok": False}
    try:
        mongo_client.admin.command("ping")
        return {"mongo": "CONNECTED", "ok": True, "db": DB_NAME}
    except Exception as e:
        return {"mongo": "ERROR", "ok": False, "detail": str(e)}


@app.post("/seed-policies")
def seed_policies():
    """
    Optional helper endpoint for hackathon:
    Seeds cancellation instruction templates into MongoDB RAG store.
    """
    if not MONGO_OK:
        raise HTTPException(status_code=500, detail="MongoDB not connected")

    templates = [
        {
            "merchant_key": "netflix",
            "merchant_name": "Netflix",
            "cancellation_steps": [
                "Open Netflix app or website",
                "Go to Account → Membership & Billing",
                "Select Cancel Membership",
                "Confirm cancellation"
            ],
            "notes": "If billed through Google Play/Apple App Store, cancel in that store subscription settings."
        },
        {
            "merchant_key": "spotify",
            "merchant_name": "Spotify",
            "cancellation_steps": [
                "Open Spotify website",
                "Go to Account → Your Plan",
                "Select Change Plan → Cancel Premium",
                "Confirm cancellation"
            ]
        },
        {
            "merchant_key": "amazon",
            "merchant_name": "Amazon Prime",
            "cancellation_steps": [
                "Open Amazon app/website",
                "Go to Account → Prime Membership",
                "Select Manage Membership",
                "Cancel Membership",
                "Confirm cancellation"
            ]
        },
    ]

    inserted = 0
    for t in templates:
        merchant_policies_col.update_one(
            {"merchant_key": t["merchant_key"]},
            {"$set": t},
            upsert=True
        )
        inserted += 1

    return {"ok": True, "inserted_or_updated": inserted}


@app.get("/merchant/{merchant_id}")
def merchant_profile(merchant_id: str):
    merchant_id = str(merchant_id).strip()
    m = merchant_lookup.get(merchant_id)
    if not m:
        return {"merchant_id": merchant_id, "found": False}
    return {"merchant_id": merchant_id, "found": True, "profile": m}


@app.get("/merchant-history/{merchant_id}")
def merchant_history(merchant_id: str, limit: int = 10):
    if not MONGO_OK:
        return {"ok": False, "error": "MongoDB not connected"}

    merchant_id = str(merchant_id).strip()
    rows = list(
        transactions_col.find({"merchant_id": merchant_id}, {"_id": 0})
        .sort("timestamp", -1)
        .limit(int(limit))
    )

    return {"ok": True, "merchant_id": merchant_id, "count": len(rows), "history": rows}


@app.post("/score-transaction")
def score_transaction(req: TransactionRequest):
    merchant_id = (req.merchant_id or "").strip()
    merchant_name = req.merchant_name or ""
    amount = float(req.amount or 0)

    base = merchant_lookup.get(merchant_id)

    # 1) Known merchant
    if base:
        decision = base.get("final_decision", "REVIEW")
        response = {
            "merchant_id": merchant_id,
            "merchant_name": base.get("merchant_name", merchant_name),
            "decision": decision,
            "merchant_trust_score": float(base.get("merchant_trust_score", 50)),
            "risk_score": float(base.get("risk_score", 0.5)),
            "rename_similarity_score": int(base.get("rename_similarity_score", 0)),
            "closest_company_match": base.get("closest_company_match", ""),
            "patterns_detected": safe_parse_patterns(base.get("patterns_detected", [])),
            "reasons": build_reasons(base),
            "user_guidance": guidance_from_decision(decision),
        }

        mongo_safe_insert(transactions_col, {
            "timestamp": datetime.utcnow(),
            "merchant_id": merchant_id,
            "merchant_name": response["merchant_name"],
            "amount": amount,
            "decision": decision,
            "patterns_detected": response["patterns_detected"],
            "scores": {
                "merchant_trust_score": response["merchant_trust_score"],
                "risk_score": response["risk_score"],
                "rename_similarity_score": response["rename_similarity_score"]
            }
        })
        mongo_safe_update_profile(merchant_id, response["merchant_name"], amount, decision)

        return response

    # 2) Unknown merchant -> rename fallback
    best_match, rename_score = rename_similarity_score(merchant_name)

    trust_score = 50
    decision = "REVIEW"
    if rename_score >= 90:
        decision = "BLOCK"
        trust_score = 25
    elif rename_score >= 80:
        decision = "REVIEW"
        trust_score = 40

    fallback_row = {
        "merchant_trust_score": trust_score,
        "rename_similarity_score": rename_score,
        "closest_company_match": best_match,
        "patterns_detected": ["NEW_MERCHANT"] + (["MERCHANT_REBRAND_PATTERN"] if rename_score >= 80 else []),
        "microcharge_rate": None,
        "spike_ratio": None,
        "anomaly_score": None
    }

    response = {
        "merchant_id": merchant_id,
        "merchant_name": merchant_name,
        "decision": decision,
        "merchant_trust_score": float(trust_score),
        "risk_score": None,
        "rename_similarity_score": int(rename_score),
        "closest_company_match": best_match,
        "patterns_detected": fallback_row["patterns_detected"],
        "reasons": build_reasons(fallback_row),
        "user_guidance": guidance_from_decision(decision),
    }

    mongo_safe_insert(transactions_col, {
        "timestamp": datetime.utcnow(),
        "merchant_id": merchant_id,
        "merchant_name": merchant_name,
        "amount": amount,
        "decision": decision,
        "patterns_detected": fallback_row["patterns_detected"],
        "scores": {
            "merchant_trust_score": trust_score,
            "risk_score": None,
            "rename_similarity_score": rename_score,
            "closest_company_match": best_match
        }
    })
    mongo_safe_update_profile(merchant_id, merchant_name, amount, decision)

    if rename_score >= 80:
        mongo_safe_insert(merchant_rename_events_col, {
            "timestamp": datetime.utcnow(),
            "merchant_id": merchant_id,
            "merchant_name": merchant_name,
            "best_match": best_match,
            "rename_similarity_score": int(rename_score),
            "decision": decision
        })

    return response


@app.post("/investigate-transaction")
def investigate_transaction(req: InvestigateRequest):
    """
    ✅ RAG + Gemini endpoint
    Uses MongoDB evidence context (no vector DB) + Gemini to generate
    investigation notes + cancellation instructions.
    """
    if not GEMINI_API_KEY or gemini_model is None:
        raise HTTPException(status_code=500, detail="Gemini is not configured. Set GEMINI_API_KEY in .env")

    payload = req.model_dump()
    merchant_id = (req.merchant_id or "UNKNOWN").strip()
    merchant_name = (req.merchant_name or "UNKNOWN").strip()

    rag = fetch_rag_context(merchant_id, merchant_name)
    prompt = build_gemini_prompt(payload, rag)

    try:
        llm_resp = gemini_model.generate_content(prompt)
        output_text = llm_resp.text.strip()
        parsed = safe_parse_gemini_json(output_text)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gemini error: {str(e)}")

    # ✅ Persist case logs (evidence + llm report)
    mongo_safe_insert(case_logs_col, {
        "timestamp": datetime.utcnow(),
        "merchant_id": merchant_id,
        "merchant_name": merchant_name,
        "payload": payload,
        "rag_context": rag,
        "llm_output": parsed
    })

    return {
        "ok": True,
        "merchant_id": merchant_id,
        "merchant_name": merchant_name,
        "investigation": parsed
    }
