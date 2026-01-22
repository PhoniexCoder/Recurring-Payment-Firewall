#  uvicorn subscription_app:app --reload --port 8001
# Invoke-RestMethod "http://127.0.0.1:8001/mongo-status"
# Invoke-RestMethod "http://127.0.0.1:8001/evaluation-history?limit=10"


from fastapi import FastAPI, Query, HTTPException
from pydantic import BaseModel
import pandas as pd
import numpy as np
import re
import ast
from rapidfuzz import fuzz, process
from sklearn.metrics import confusion_matrix
from datetime import datetime

# -----------------------------
# ✅ MongoDB
# -----------------------------
from pymongo import MongoClient, ASCENDING

MONGO_URI = "mongodb://localhost:27017"
DB_NAME = "recurring_firewall"

try:
    mongo_client = MongoClient(MONGO_URI)
    db = mongo_client[DB_NAME]

    eval_logs = db["evaluation_logs"]
    subscription_snapshots = db["subscription_snapshots"]

    # indexes for faster queries + retention
    eval_logs.create_index([("timestamp", ASCENDING)])
    subscription_snapshots.create_index([("timestamp", ASCENDING)])

    # ✅ 6 months retention using TTL (180 days)
    eval_logs.create_index("timestamp", expireAfterSeconds=180 * 24 * 3600)
    subscription_snapshots.create_index("timestamp", expireAfterSeconds=180 * 24 * 3600)

    MONGO_OK = True
except Exception as e:
    print("[MongoDB ERROR]", e)
    MONGO_OK = False


app = FastAPI(title="Unified Fraud & Abuse Detector API", version="1.3")

# --- DATA PATHS ---
DF_SCORING_PATH = r"C:\Users\thapa\Desktop\project\df_scoring.csv"
SUB_PATH        = r"C:\Users\thapa\Desktop\project\sub.csv"
MASTER_CSV_PATH = r"C:\Users\thapa\Desktop\project\Online retial II\MERGED MASTER NOTEBOOK\merged_master_firewall_output.csv"
COMPANY_CSV_PATH = r"C:\Users\thapa\Desktop\project\Online retial II\company names\Company Names.csv"


# -----------------------------
# LOAD DATA
# -----------------------------
try:
    df_scoring = pd.read_csv(DF_SCORING_PATH)
    sub = pd.read_csv(SUB_PATH)
    master_df = pd.read_csv(MASTER_CSV_PATH)
    companies_df = pd.read_csv(COMPANY_CSV_PATH)

    # Enforce types for Banksim Data
    if "fraud" in df_scoring.columns:
        df_scoring["fraud"] = df_scoring["fraud"].fillna(0).astype(int)
    else:
        raise ValueError("df_scoring.csv missing 'fraud' column")

    # subscription_id check
    if "subscription_id" not in df_scoring.columns:
        raise ValueError("df_scoring.csv missing 'subscription_id'")
    if "subscription_id" not in sub.columns:
        raise ValueError("sub.csv missing 'subscription_id'")

    # Normalize Retail II Data
    master_df["merchant_id"] = master_df["merchant_id"].astype(str).str.strip()

    # Init company list for fuzzy matching
    companies_df.columns = [c.strip().lower() for c in companies_df.columns]
    name_col = next((c for c in ["name", "company", "company_name", "business_name"] if c in companies_df.columns),
                    companies_df.columns[0])

    companies_df = companies_df.dropna(subset=[name_col])

    def _clean_company(x):
        return re.sub(r"[^a-z0-9\s]", " ", str(x).lower()).strip()

    company_list = companies_df[name_col].astype(str).apply(_clean_company).unique().tolist()

    # Fast lookup for Retail II
    merchant_lookup = master_df.set_index("merchant_id").to_dict(orient="index")

    print(f"✅ Loaded master merchants: {len(master_df)}")
    print(f"✅ Loaded company names   : {len(company_list)}")
    print(f"✅ Loaded subscriptions   : {len(sub)}")
    print(f"✅ Loaded tx scoring rows : {len(df_scoring)}")

except Exception as e:
    print(f"❌ Error loading datasets: {e}")
    raise


# -----------------------------
# SCHEMAS
# -----------------------------
class TransactionRequest(BaseModel):
    merchant_id: str | None = None
    merchant_name: str | None = None
    customer_id: str | None = None
    amount: float | None = None
    currency: str | None = "USD"
    timestamp: str | None = None


# -----------------------------
# HELPERS
# -----------------------------
def normalize_name(x: str) -> str:
    x = str(x).lower()
    x = re.sub(r"[^a-z0-9\s]", " ", x)
    x = re.sub(r"\s+", " ", x).strip()
    stop = {"pvt", "private", "ltd", "limited", "inc", "co", "official", "store", "online", "services"}
    return " ".join([t for t in x.split() if t not in stop]).strip()


def safe_parse_patterns(x):
    if x is None or (isinstance(x, float) and pd.isna(x)):
        return []
    if isinstance(x, list):
        return x
    try:
        v = ast.literal_eval(str(x))
        if isinstance(v, list):
            return [str(i) for i in v]
    except:
        pass
    return [p.strip() for p in str(x).split(",") if p.strip()]


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
        return "Payment looks safe."
    if decision == "REVIEW":
        return "Suspicious. Recommended: step-up authentication (OTP)."
    return "High risk. Recommended: BLOCK transaction."


def mongo_safe_insert(collection, doc: dict):
    """Safely write to MongoDB without breaking API if DB fails."""
    if not MONGO_OK:
        return False
    try:
        collection.insert_one(doc)
        return True
    except Exception as e:
        print("[MongoDB Insert Error]", e)
        return False


# -----------------------------
# ENDPOINTS
# -----------------------------
@app.get("/")
def home():
    return {
        "message": "Unified API Running",
        "version": "1.3",
        "mongo_enabled": MONGO_OK,
        "endpoints": [
            "/evaluate-subscriptions",
            "/score-transaction",
            "/merchant/{merchant_id}",
            "/mongo-status",
            "/evaluation-history"
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


@app.get("/evaluation-history")
def evaluation_history(limit: int = Query(10, ge=1, le=200)):
    if not MONGO_OK:
        return {"ok": False, "error": "MongoDB not connected"}

    rows = list(eval_logs.find({}, {"_id": 0}).sort("timestamp", -1).limit(limit))
    return {"ok": True, "count": len(rows), "history": rows}


@app.get("/evaluate-subscriptions")
def evaluate_subscriptions(
    tune_fpr: bool = Query(False),
    fpr_target: float = Query(0.01, ge=0.0, le=1.0),
    save_snapshot: bool = Query(True, description="Store top risky subscriptions snapshot in MongoDB")
):
    # --- subscription fraud truth ---
    sub_true = df_scoring.groupby("subscription_id")["fraud"].max().reset_index()

    # merge predictions with truth
    sub_eval = sub.merge(sub_true, on="subscription_id", how="left").fillna(0)
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

    # ✅ MongoDB logs (retention)
    mongo_safe_insert(eval_logs, {
        "timestamp": datetime.utcnow(),
        "mode": response.get("mode"),
        "tune_fpr": bool(tune_fpr),
        "fpr_target": float(fpr_target),
        "n_subscriptions": int(response.get("n_subscriptions", 0)),
        "response": response
    })

    # ✅ save snapshot of top risky subscriptions (optional)
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

            mongo_safe_insert(subscription_snapshots, {
                "timestamp": datetime.utcnow(),
                "type": "top15_riskiest_subscriptions",
                "items": top15
            })
        except Exception as e:
            print("[Snapshot Save Error]", e)

    return response


@app.post("/score-transaction")
def score_transaction(req: TransactionRequest):
    m_id = (req.merchant_id or "").strip()
    m_name = req.merchant_name or ""

    base = merchant_lookup.get(m_id)

    # known merchant
    if base:
        decision = base.get("final_decision", "REVIEW")
        return {
            "merchant_id": m_id,
            "merchant_name": base.get("merchant_name", m_name),
            "decision": decision,
            "trust_score": float(base.get("merchant_trust_score", 50)),
            "patterns": safe_parse_patterns(base.get("patterns_detected", [])),
            "guidance": guidance_from_decision(decision)
        }

    # fallback fuzzy matching
    q = normalize_name(m_name)
    best_match, score = ("", 0)
    if q and company_list:
        match = process.extractOne(q, company_list, scorer=fuzz.token_sort_ratio)
        if match:
            best_match, score = match[0], int(match[1])

    decision = "BLOCK" if score >= 90 else "REVIEW"
    return {
        "merchant_id": m_id,
        "merchant_name": m_name,
        "decision": decision,
        "fuzzy_match": best_match,
        "match_score": score,
        "guidance": guidance_from_decision(decision)
    }


@app.get("/merchant/{merchant_id}")
def get_merchant(merchant_id: str):
    m = merchant_lookup.get(merchant_id.strip())
    return {"merchant_id": merchant_id, "found": bool(m), "profile": m}
