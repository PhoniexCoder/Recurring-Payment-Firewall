import streamlit as st
import requests
import pandas as pd

# -------------------------
# CONFIG
# -------------------------
MERCHANT_API = "http://127.0.0.1:8000"
SUB_API = "http://127.0.0.1:8001"

st.set_page_config(
    page_title="Recurring Payment Firewall",
    layout="wide"
)

# -------------------------
# HELPERS
# -------------------------
def api_post(url, payload):
    try:
        r = requests.post(url, json=payload, timeout=60)
        return r.status_code, r.json()
    except Exception as e:
        return 0, {"error": str(e)}

def api_get(url):
    try:
        r = requests.get(url, timeout=60)
        return r.status_code, r.json()
    except Exception as e:
        return 0, {"error": str(e)}

def badge(decision: str):
    decision = (decision or "").upper()
    if decision == "ALLOW":
        st.success("✅ ALLOW")
    elif decision == "REVIEW":
        st.warning("⚠️ REVIEW")
    elif decision == "BLOCK":
        st.error("⛔ BLOCK")
    else:
        st.info(decision)

# -------------------------
# SIDEBAR
# -------------------------
st.sidebar.title("⚙️ API Config")
merchant_api = st.sidebar.text_input("Merchant API", MERCHANT_API)
sub_api = st.sidebar.text_input("Subscription API", SUB_API)

st.sidebar.markdown("---")
st.sidebar.subheader("Server Check")

if st.sidebar.button("Ping APIs"):
    code1, res1 = api_get(f"{merchant_api}/")
    code2, res2 = api_get(f"{sub_api}/")
    st.sidebar.write("Merchant API:", "✅" if code1 == 200 else "❌", res1)
    st.sidebar.write("Subscription API:", "✅" if code2 == 200 else "❌", res2)

# -------------------------
# MAIN UI
# -------------------------
st.title("🧱 Recurring Payment Firewall (Hackathon Demo)")

tab1, tab2, tab3 = st.tabs(["🔎 Score Transaction", "🕵️ Investigation (Gemini RAG)", "📊 Evaluate Subscriptions"])

# ============================================================
# TAB 1: Score Transaction
# ============================================================
with tab1:
    st.subheader("1) Merchant Behaviour Scoring")

    colA, colB, colC = st.columns(3)
    with colA:
        merchant_id = st.text_input("merchant_id", value="NEW_M_777")
    with colB:
        merchant_name = st.text_input("merchant_name", value="Netfl1x Officia1 Ltd")
    with colC:
        amount = st.number_input("amount", min_value=0.0, value=0.99, step=0.01)

    payload = {
        "merchant_id": merchant_id,
        "merchant_name": merchant_name,
        "amount": amount
    }

    col1, col2 = st.columns([1, 1])
    with col1:
        if st.button("✅ Score Transaction", use_container_width=True):
            status, resp = api_post(f"{merchant_api}/score-transaction", payload)

            if status != 200:
                st.error(f"API Error ({status})")
                st.json(resp)
            else:
                st.markdown("### Result")
                badge(resp.get("decision"))

                c1, c2, c3 = st.columns(3)
                c1.metric("Merchant Trust Score", resp.get("merchant_trust_score", resp.get("trust_score", "N/A")))
                c2.metric("Rename Similarity", resp.get("rename_similarity_score", resp.get("match_score", "N/A")))
                c3.metric("Closest Match", resp.get("closest_company_match", resp.get("fuzzy_match", "")))

                st.markdown("### Reasons")
                reasons = resp.get("reasons", [])
                if isinstance(reasons, list):
                    for r in reasons:
                        st.write("•", r)
                else:
                    st.write(reasons)

                st.markdown("### User Guidance")
                st.info(resp.get("user_guidance", resp.get("guidance", "No guidance")))

                st.markdown("### Full JSON")
                st.json(resp)

    with col2:
        st.markdown("### Merchant History (MongoDB)")
        if st.button("📜 Fetch Merchant History", use_container_width=True):
            if merchant_id.strip() == "":
                st.warning("Enter merchant_id first.")
            else:
                status, hist = api_get(f"{merchant_api}/merchant-history/{merchant_id}?limit=10")
                if status != 200:
                    st.error(f"API Error ({status})")
                    st.json(hist)
                else:
                    if hist.get("count", 0) == 0:
                        st.info("No history found (try scoring at least once).")
                    else:
                        dfh = pd.DataFrame(hist.get("history", []))
                        st.dataframe(dfh, use_container_width=True)

# ============================================================
# TAB 2: Investigation using Gemini RAG
# ============================================================
with tab2:
    st.subheader("2) Gemini RAG Investigation Notes")

    st.write("This generates **Fraud Analyst Investigation Notes** + **Cancellation Instructions** using Gemini + MongoDB context.")

    colA, colB = st.columns(2)
    with colA:
        inv_merchant_id = st.text_input("Investigation merchant_id", value="NEW_M_777", key="inv_mid")
        inv_amount = st.number_input("Investigation amount", min_value=0.0, value=0.99, step=0.01, key="inv_amt")
    with colB:
        inv_merchant_name = st.text_input("Investigation merchant_name", value="Netfl1x Officia1 Ltd", key="inv_mname")
        inv_decision = st.selectbox("Decision", ["REVIEW", "ALLOW", "BLOCK"], index=0)

    inv_payload = {
        "merchant_id": inv_merchant_id,
        "merchant_name": inv_merchant_name,
        "amount": inv_amount,
        "decision": inv_decision,
        "merchant_trust_score": 25,
        "rename_similarity_score": 91,
        "closest_company_match": "netflix",
        "patterns_detected": ["NEW_MERCHANT", "MERCHANT_REBRAND_PATTERN"]
    }

    if st.button("🧠 Generate Investigation Notes (Gemini)", use_container_width=True):
        status, resp = api_post(f"{merchant_api}/investigate-transaction", inv_payload)

        if status != 200:
            st.error(f"API Error ({status})")
            st.json(resp)
        else:
            st.markdown("### Investigation Result")
            inv = resp.get("investigation", {})

            st.markdown("#### Risk Summary")
            st.info(inv.get("risk_summary", "N/A"))

            st.markdown("#### Key Reasons")
            reasons = inv.get("key_reasons", [])
            if isinstance(reasons, list):
                for r in reasons:
                    st.write("•", r)
            else:
                st.write(reasons)

            st.markdown("#### Recommended Bank Action")
            act = inv.get("recommended_bank_action", [])
            if isinstance(act, list):
                for a in act:
                    st.write("✅", a)
            else:
                st.write(act)

            st.markdown("#### Customer Guidance")
            cust = inv.get("customer_guidance", [])
            if isinstance(cust, list):
                for c in cust:
                    st.write("👉", c)
            else:
                st.write(cust)

            st.markdown("#### Cancellation Instructions")
            canc = inv.get("cancellation_instructions", [])
            if isinstance(canc, list):
                for i, step in enumerate(canc, 1):
                    st.write(f"{i}. {step}")
            else:
                st.write(canc)

            st.markdown("### Full JSON")
            st.json(resp)

# ============================================================
# TAB 3: Subscription evaluation
# ============================================================
with tab3:
    st.subheader("3) Subscription Abuse Detector Evaluation")

    col1, col2 = st.columns(2)

    with col1:
        tune_fpr = st.checkbox("Tune threshold to enforce FPR ≤ 1%", value=False)
        fpr_target = st.slider("FPR Target", min_value=0.0, max_value=0.10, value=0.01, step=0.005)

        if st.button("📊 Evaluate Subscriptions", use_container_width=True):
            url = f"{sub_api}/evaluate-subscriptions"

            if tune_fpr:
                url += f"?tune_fpr=true&fpr_target={fpr_target}"
            status, resp = api_get(url)

            if status != 200:
                st.error(f"API Error ({status})")
                st.json(resp)
            else:
                st.markdown("### Evaluation Output")
                st.json(resp)

                # show metrics nicely if exists
                if resp.get("mode") == "decision_based":
                    metrics = resp.get("metrics", {})
                else:
                    metrics = resp.get("best", {}).get("metrics", {}) if "best" in resp else {}

                st.markdown("### Quick Metrics")
                if "metrics" in resp:
                    m = resp["metrics"]
                    c1, c2, c3 = st.columns(3)
                    c1.metric("Precision", round(m.get("precision", 0), 4))
                    c2.metric("Recall", round(m.get("recall", 0), 4))
                    c3.metric("FPR", round(m.get("fpr", 0), 4))

    with col2:
        st.markdown("### Notes for Judges")
        st.info(
            "✅ Merchant Firewall (Trust + Rename Detection)\n"
            "✅ Subscription Abuse Detector (ML + Rules)\n"
            "✅ MongoDB 180-day retention\n"
            "✅ Gemini RAG investigation notes + cancellation instructions"
        )
