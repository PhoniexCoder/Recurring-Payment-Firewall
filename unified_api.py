# uvicorn unified_api:app --reload --port 8000
"""
Unified Recurring Payment Firewall API
Combines merchant scoring, subscription evaluation, and RAG investigation.

Endpoints:
- GET  /                       : status
- GET  /mongo-status           : MongoDB ping
- POST /seed-policies          : seed cancellation policies
- POST /score-transaction      : merchant behaviour scoring
- GET  /merchant/{merchant_id} : merchant master profile
- GET  /merchant-history/{merchant_id}?limit=10 : merchant tx history (MongoDB)
- POST /investigate-transaction: Gemini RAG investigation notes
- GET  /evaluate-subscriptions : subscription-level evaluation (Banksim)
- GET  /evaluation-history     : evaluation logs (MongoDB)
"""

import os
import json
import re
import ast
from datetime import datetime

import pandas as pd
import numpy as np

from rapidfuzz import fuzz, process
from sklearn.metrics import confusion_matrix

from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# -----------------------------
# MongoDB
# -----------------------------
from pymongo import MongoClient, ASCENDING

# -----------------------------
# Gemini
# -----------------------------
from dotenv import load_dotenv
import google.generativeai as genai

# =============================
# ENV / CONFIG
# =============================
load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")

DB_NAME = "recurring_firewall"

# =============================
# ✅ GEMINI INIT (AUTO MODEL PICK)
# =============================
gemini_model = None
GEMINI_MODEL_SELECTED = None

def init_gemini():
    global gemini_model, GEMINI_MODEL_SELECTED
    if not GEMINI_API_KEY:
        print("[GEMINI] GEMINI_API_KEY missing -> Gemini disabled")
        return

    try:
        genai.configure(api_key=GEMINI_API_KEY)

        # list models available for this key
        supported = []
        for m in genai.list_models():
            if hasattr(m, "supported_generation_methods") and "generateContent" in m.supported_generation_methods:
                supported.append(m.name)

        print("[GEMINI] Supported models:", supported)

        preferred = [
            "models/gemini-2.5-flash",
            "models/gemini-2.5-pro",
            "models/gemini-flash-latest",
            "models/gemini-pro-latest",
            "models/gemini-2.0-flash",
            "models/gemini-2.0-flash-001",
            "models/gemini-1.5-flash",
            "models/gemini-1.5-pro",
        ]


        for pm in preferred:
            if pm in supported:
                GEMINI_MODEL_SELECTED = pm
                break
        
        # Fallback if preferred not found but others exist
        if GEMINI_MODEL_SELECTED is None and supported:
            GEMINI_MODEL_SELECTED = supported[0]

        if GEMINI_MODEL_SELECTED is None:
            raise RuntimeError("No Gemini model supports generateContent for this API key.")

        gemini_model = genai.GenerativeModel(GEMINI_MODEL_SELECTED)
        print("[GEMINI] Using model:", GEMINI_MODEL_SELECTED)

    except Exception as e:
        gemini_model = None
        GEMINI_MODEL_SELECTED = None
        print("[GEMINI INIT ERROR]", str(e))

init_gemini()


# =============================
# ✅ MONGODB INIT
# =============================
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

    def ensure_ttl_index(col, field, seconds):
        try:
            col.create_index(field, expireAfterSeconds=seconds)
        except Exception as e:
            # sometimes existing index conflicts
            if "IndexOptionsConflict" in str(e):
                try:
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


# =============================
# APP INIT
# =============================
app = FastAPI(title="Unified Recurring Payment Firewall API", version="3.0")

# ✅ CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow everything for demo purposes
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =============================
# Paths
# =============================
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ML_DIR = os.path.join(BASE_DIR, "ML")

MASTER_CSV_PATH = os.path.join(ML_DIR, "Online retial II", "MERGED MASTER NOTEBOOK", "merged_master_firewall_output.csv")
COMPANY_CSV_PATH = os.path.join(ML_DIR, "Online retial II", "company names", "Company Names.csv")

DF_SCORING_PATH = os.path.join(ML_DIR, "df_scoring.csv")
SUB_PATH = os.path.join(ML_DIR, "sub.csv")


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
                "$set": {"merchant_name_latest": merchant_name, "last_seen": now},
                "$addToSet": {"known_names": merchant_name},
                "$inc": {
                    "stats_180d.tx_count": 1,
                    "stats_180d.total_amount": float(amount or 0),
                    f"stats_180d.decisions.{decision}": 1
                },
            },
            upsert=True
        )
        return True
    except Exception as e:
        print("[MongoDB Update Error]", e)
        return False


def guidance_from_decision(decision: str):
    if decision == "ALLOW":
        return "Payment looks safe. Subscription can proceed."
    if decision == "REVIEW":
        return "Suspicious. Recommended: step-up authentication (OTP) + warn user + allow cancellation."
    return "High risk recurring payment. Recommended: BLOCK transaction + alert user + provide cancellation steps."


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

    if len(reasons) == 0:
        reasons.append("No high-risk signals detected.")

    return reasons[:5]


# =============================
# Load Master CSV
# =============================
try:
    master_df = pd.read_csv(MASTER_CSV_PATH)
    master_df["merchant_id"] = master_df["merchant_id"].astype(str).str.strip()

    if "patterns_detected" in master_df.columns:
        master_df["patterns_detected"] = master_df["patterns_detected"].apply(safe_parse_patterns)

    merchant_lookup = master_df.set_index("merchant_id").to_dict(orient="index")
    
    # ✅ Name Mapping for Lookup (handle simplified IDs)
    merchant_name_map = {}
    for _, row in master_df.iterrows():
        clean = normalize_name(row.get("merchant_name", ""))
        if clean:
            merchant_name_map[clean] = str(row["merchant_id"]).strip()
            
except Exception as e:
    print(f"[INIT ERROR] Could not load master CSV: {e}")
    master_df = pd.DataFrame()
    merchant_lookup = {}
    merchant_name_map = {}


# =============================
# Load Company Names CSV
# =============================
try:
    companies_df = pd.read_csv(COMPANY_CSV_PATH)
    companies_df.columns = [c.strip().lower() for c in companies_df.columns]

    possible_name_cols = ["name", "company", "company_name", "business_name", "organization", "organisation"]
    name_col = next((c for c in possible_name_cols if c in companies_df.columns), companies_df.columns[0])

    companies_df = companies_df.dropna(subset=[name_col])
    companies_df[name_col] = companies_df[name_col].astype(str)

    companies_df["clean_name"] = companies_df[name_col].apply(normalize_name)
    company_list = companies_df["clean_name"].dropna().unique().tolist()
except Exception as e:
    print(f"[INIT ERROR] Could not load companies CSV: {e}")
    company_list = []


# =============================
# Load Banksim data (optional)
# =============================
try:
    df_scoring = pd.read_csv(DF_SCORING_PATH)
    sub_df = pd.read_csv(SUB_PATH)

    if "fraud" in df_scoring.columns:
        df_scoring["fraud"] = df_scoring["fraud"].fillna(0).astype(int)

except Exception as e:
    print("[Banksim Load Error]", e)
    df_scoring = pd.DataFrame()
    sub_df = pd.DataFrame()


print(f"[INIT] master merchants: {len(master_df)}")
print(f"[INIT] company names   : {len(company_list)}")
print(f"[INIT] banksim tx rows : {len(df_scoring)}")
print(f"[INIT] subscriptions   : {len(sub_df)}")
print(f"[INIT] MongoDB enabled : {MONGO_OK}")
print(f"[INIT] Gemini enabled  : {gemini_model is not None}")


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
    if not MONGO_OK:
        return {"mongo_enabled": False}

    profile = merchant_profiles_col.find_one({"merchant_id": merchant_id}, {"_id": 0}) or {}

    recent_tx = list(
        transactions_col.find({"merchant_id": merchant_id}, {"_id": 0})
        .sort("timestamp", -1).limit(10)
    )

    rename_events = list(
        merchant_rename_events_col.find({"merchant_id": merchant_id}, {"_id": 0})
        .sort("timestamp", -1).limit(5)
    )

    merchant_key = normalize_name(merchant_name).split(" ")[0] if merchant_name else ""
    policy = merchant_policies_col.find_one({"merchant_key": merchant_key}, {"_id": 0}) if merchant_key else None

    return {
        "mongo_enabled": True,
        "merchant_profile_180d": profile,
        "recent_transactions": recent_tx,
        "rename_events": rename_events,
        "policy": policy or {}
    }


def build_gemini_prompt(payload: dict, rag: dict):
    return f"""
You are an expert Fraud Analyst Assistant in a bank for "Recurring Payment Firewall".

STRICT:
- Only use payload + RAG evidence.
- If unknown say "insufficient evidence".
- Output must be VALID JSON only (no markdown).

PAYLOAD:
{payload}

RAG:
{rag}

OUTPUT JSON:
{{
  "risk_summary": "2 lines max",
  "key_reasons": ["...", "..."],
  "recommended_bank_action": ["..."],
  "customer_guidance": ["..."],
  "cancellation_instructions": ["Step 1...", "Step 2..."],
  "confidence": "LOW/MEDIUM/HIGH"
}}
""".strip()


def safe_parse_gemini_json(text: str):
    t = text.strip()
    if t.startswith("```"):
        t = re.sub(r"^```[a-zA-Z]*", "", t).strip()
        if t.endswith("```"):
            t = t[:-3].strip()
    try:
        return json.loads(t)
    except Exception:
        return {"raw_text": text, "error": "LLM output not valid JSON"}


# =============================
# ENDPOINTS
# =============================
@app.get("/")
def home():
    return {
        "message": "Unified Recurring Payment Firewall API + Gemini RAG running",
        "version": "3.0",
        "mongo_enabled": MONGO_OK,
        "gemini_enabled": gemini_model is not None,
        "gemini_model_selected": GEMINI_MODEL_SELECTED,
        "endpoints": [
            "/mongo-status",
            "/seed-policies",
            "/score-transaction",
            "/investigate-transaction",
            "/merchant/{merchant_id}",
            "/merchant-history/{merchant_id}",
            "/evaluate-subscriptions",
            "/evaluation-history",
        ]
    }


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
            "notes": "If billed through Google Play/Apple App Store, cancel there."
        },
        {
            "merchant_key": "spotify",
            "merchant_name": "Spotify",
            "cancellation_steps": [
                "Open Spotify website",
                "Go to Account → Your Plan",
                "Cancel Premium",
                "Confirm cancellation"
            ]
        },
        {
            "merchant_key": "amazon",
            "merchant_name": "Amazon Prime",
            "cancellation_steps": [
                "Open Amazon app/website",
                "Account → Prime Membership",
                "Manage Membership",
                "Cancel Membership"
            ]
        },
    ]

    inserted = 0
    for t in templates:
        merchant_policies_col.update_one({"merchant_key": t["merchant_key"]}, {"$set": t}, upsert=True)
        inserted += 1

    return {"ok": True, "inserted_or_updated": inserted}


@app.get("/merchant/{merchant_id}")
def merchant_profile(merchant_id: str):
    merchant_id = str(merchant_id).strip()
    m = merchant_lookup.get(merchant_id)
    return {"merchant_id": merchant_id, "found": bool(m), "profile": m}


@app.get("/merchant-history/{merchant_id}")
def merchant_history(merchant_id: str, limit: int = 10):
    if not MONGO_OK:
        return {"ok": False, "error": "MongoDB not connected"}

    merchant_id = str(merchant_id).strip()
    rows = list(
        transactions_col.find({"merchant_id": merchant_id}, {"_id": 0})
        .sort("timestamp", -1).limit(int(limit))
    )
    return {"ok": True, "merchant_id": merchant_id, "count": len(rows), "history": rows}


@app.get("/recent-transactions")
def recent_transactions(limit: int = 10):
    if not MONGO_OK:
        return {"ok": False, "error": "MongoDB not connected"}
    
    rows = list(
        transactions_col.find({}, {"_id": 0})
        .sort("timestamp", -1).limit(int(limit))
    )
    return {"ok": True, "count": len(rows), "history": rows}


@app.post("/score-transaction")
def score_transaction(req: TransactionRequest):
    merchant_id = (req.merchant_id or "").strip()
    merchant_name = req.merchant_name or ""
    amount = float(req.amount or 0)

    # Known merchant (Direct ID)
    base = merchant_lookup.get(merchant_id)
    
    # ✅ Fallback: Try Name Lookup (if ID was simplified by extension)
    if not base and merchant_name:
        clean_in = normalize_name(merchant_name)
        found_id = merchant_name_map.get(clean_in)
        if found_id:
            base = merchant_lookup.get(found_id)
            # Update ID to the real one
            merchant_id = found_id

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

    # Unknown merchant -> fuzzy match
    best_match, rename_score = rename_similarity_score(merchant_name)

    if rename_score >= 90:
        decision = "BLOCK"
        trust_score = 25
    elif rename_score >= 80:
        decision = "REVIEW"
        trust_score = 40
    else:
        decision = "REVIEW"
        trust_score = 50

    fallback_row = {
        "merchant_trust_score": trust_score,
        "rename_similarity_score": rename_score,
        "closest_company_match": best_match,
        "patterns_detected": ["NEW_MERCHANT"] + (["MERCHANT_REBRAND_PATTERN"] if rename_score >= 80 else []),
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
    if gemini_model is None:
        raise HTTPException(
            status_code=500,
            detail="Gemini not configured OR no supported model found. Check GEMINI_API_KEY."
        )

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

    mongo_safe_insert(case_logs_col, {
        "timestamp": datetime.utcnow(),
        "merchant_id": merchant_id,
        "merchant_name": merchant_name,
        "payload": payload,
        "rag_context": rag,
        "llm_output": parsed
    })

    return {"ok": True, "merchant_id": merchant_id, "merchant_name": merchant_name, "investigation": parsed}


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
    save_snapshot: bool = Query(True)
):
    if df_scoring.empty or sub_df.empty:
        raise HTTPException(status_code=500, detail="Banksim data not loaded")

    sub_true = df_scoring.groupby("subscription_id")["fraud"].max().reset_index()
    sub_eval = sub_df.merge(sub_true, on="subscription_id", how="left").fillna(0)
    sub_eval["fraud"] = sub_eval["fraud"].astype(int)

    if not tune_fpr:
        if "decision" not in sub_eval.columns:
            raise HTTPException(status_code=400, detail="sub.csv must contain 'decision'")
        sub_eval["pred"] = sub_eval["decision"].isin(["REVIEW", "BLOCK"]).astype(int)
        metrics = compute_metrics(sub_eval)
        response = {"mode": "decision_based", "n_subscriptions": int(len(sub_eval)), "metrics": metrics}

    else:
        if "max_fraud_prob" not in sub_eval.columns:
            raise HTTPException(status_code=400, detail="sub.csv must contain 'max_fraud_prob'")
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
            sub_eval["pred"] = (sub_eval["max_fraud_prob"].astype(float) >= best["threshold"]).astype(int)
            response = {
                "mode": "tuned_threshold",
                "status": "OK",
                "n_subscriptions": int(len(sub_eval)),
                "fpr_target": float(fpr_target),
                "best": best
            }

    # store eval log
    mongo_safe_insert(eval_logs_col, {
        "timestamp": datetime.utcnow(),
        "mode": response.get("mode"),
        "tune_fpr": bool(tune_fpr),
        "fpr_target": float(fpr_target),
        "n_subscriptions": int(response.get("n_subscriptions", 0)),
        "response": response
    })

    # store snapshot (optional)
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
