// Defaults
const DEFAULT_URL = 'http://localhost:8000';
let firewallBaseUrl = DEFAULT_URL;

// State for history
let history = [];

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    // Load config
    const data = await chrome.storage.sync.get({ firewallBaseUrl: DEFAULT_URL });
    firewallBaseUrl = data.firewallBaseUrl;
    document.getElementById('apiUrlDisplay').textContent = firewallBaseUrl;

    // Load history (if persisted, but prompt said in-memory for popup session is fine, but extending it to session storage is nice)
    // We'll stick to in-memory for this session as requested.

    // Listeners
    document.getElementById('evaluateBtn').addEventListener('click', evaluateTransaction);
    document.getElementById('investigateBtn').addEventListener('click', investigateTransaction);
    document.getElementById('openOptions').addEventListener('click', () => chrome.runtime.openOptionsPage());

    // Preset listeners
    document.querySelectorAll('.preset-btn').forEach(btn => {
        btn.addEventListener('click', () => applyPreset(btn.dataset.preset));
    });
});

let currentResult = null; // Store last result for investigation

function applyPreset(type) {
    const fields = {
        merchantId: document.getElementById('merchantId'),
        customerId: document.getElementById('customerId'),
        amount: document.getElementById('amount'),
        currency: document.getElementById('currency'),
        planId: document.getElementById('planId'),
        isRecurring: document.getElementById('isRecurring'),
        wasCustomerCancelled: document.getElementById('wasCustomerCancelled')
    };

    // Common Randoms
    const randomSuffix = Math.floor(Math.random() * 1000);

    switch (type) {
        case 'good':
            fields.merchantId.value = 'mer_netflix';
            fields.customerId.value = `cus_good_${randomSuffix}`;
            fields.amount.value = '15.99';
            fields.planId.value = 'standard_monthly';
            fields.isRecurring.checked = true;
            fields.wasCustomerCancelled.checked = false;
            break;
        case 'trial':
            fields.merchantId.value = 'mer_vpn_service';
            fields.customerId.value = `cus_abuser_${randomSuffix}`;
            fields.amount.value = '99.00'; // High amount charge attempt
            fields.planId.value = 'free_trial_to_paid';
            fields.isRecurring.checked = true;
            fields.wasCustomerCancelled.checked = false;
            break;
        case 'cancel':
            fields.merchantId.value = 'mer_gym';
            fields.customerId.value = `cus_sad_${randomSuffix}`;
            fields.amount.value = '49.99';
            fields.planId.value = 'gym_membership';
            fields.isRecurring.checked = true;
            fields.wasCustomerCancelled.checked = true;
            break;
        case 'micro':
            fields.merchantId.value = 'mer_gamer';
            fields.customerId.value = `cus_tester_${randomSuffix}`;
            fields.amount.value = '1.00';
            fields.planId.value = 'verification_charge';
            fields.isRecurring.checked = false;
            fields.wasCustomerCancelled.checked = false;
            break;
    }

    // Auto-evaluate after setting preset
    evaluateTransaction();
}

async function evaluateTransaction() {
    const btn = document.getElementById('evaluateBtn');
    const resultPanel = document.getElementById('resultPanel');
    const decisionLabel = document.getElementById('decisionLabel');
    const scoreLabel = document.getElementById('trustScoreLabel');
    const riskLabel = document.getElementById('riskLabel');
    const latencyLabel = document.getElementById('latencyLabel');
    const rulesLabel = document.getElementById('rulesLabel');

    // UI Loading State
    btn.disabled = true;
    btn.textContent = 'Evaluating...';
    resultPanel.classList.remove('hidden');
    resultPanel.className = 'result-panel'; // Reset colors
    decisionLabel.textContent = '...';

    // Construct Payload (Snake Case for Python API)
    // "merchant_id": "NEW_M_777","merchant_name": "Netfl1x Officia1 Ltd","amount": 0.99
    const payload = {
        merchant_id: document.getElementById('merchantId').value,
        merchant_name: "Unknown Merchant", // In a real ext, we'd grab this from the tab title or scraping
        amount: parseFloat(document.getElementById('amount').value) || 0,
        // The ML backend currently ignores customerId, planId, etc. but we keep them in UI for realism
    };

    // If we want to simulate the names from presets:
    if (payload.merchant_id === 'mer_netflix') payload.merchant_name = 'Netflix Inc';
    if (payload.merchant_id === 'mer_vpn_service') payload.merchant_name = 'Super Fast VPN';
    if (payload.merchant_id === 'mer_gym') payload.merchant_name = 'Iron Gym Global';
    if (payload.merchant_id === 'mer_gamer') payload.merchant_name = 'Ubisoft Store';

    try {
        // Updated endpoint: /score-transaction
        const url = `${firewallBaseUrl.replace(/\/$/, '')}/score-transaction`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (!response.ok) throw new Error(`API Error: ${response.status}`);

        const result = await response.json();
        currentResult = result; // Save for investigation

        // Render Result
        decisionLabel.textContent = result.decision;
        scoreLabel.textContent = `Score: ${result.merchant_trust_score}`; // Updated key
        riskLabel.textContent = result.guidance ? result.guidance.substring(0, 60) + '...' : 'N/A';
        latencyLabel.textContent = '120'; // Mock latency for now

        // Patterns
        rulesLabel.textContent = result.patterns_detected && result.patterns_detected.length
            ? result.patterns_detected.join(', ')
            : 'None';

        // Apply Styling
        resultPanel.classList.remove('bg-allow', 'bg-review', 'bg-block');
        if (result.decision === 'ALLOW') resultPanel.classList.add('bg-allow');
        else if (result.decision === 'REVIEW') resultPanel.classList.add('bg-review');
        else resultPanel.classList.add('bg-block');

        // Show Investigate Button
        document.getElementById('investigateBtn').classList.remove('hidden');
        document.getElementById('investigationPanel').classList.add('hidden'); // Hide old investigation

        // Add to History
        addToHistory(result.decision, result.merchant_trust_score);

        // Optional: Update Badge
        chrome.runtime.sendMessage({
            type: 'UPDATE_BADGE',
            decision: result.decision
        }).catch(() => { }); // If background script not ready/present, ignore

    } catch (error) {
        console.error(error);
        decisionLabel.textContent = 'ERROR';
        scoreLabel.textContent = '';
        riskLabel.textContent = error.message;
        resultPanel.className = 'result-panel bg-block';
    } finally {
        btn.disabled = false;
        btn.textContent = 'Evaluate Transaction';
    }
}

function addToHistory(decision, score) {
    const tbody = document.querySelector('#historyTable tbody');
    const row = document.createElement('tr');

    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    let color = '#000';
    if (decision === 'ALLOW') color = 'green';
    else if (decision === 'REVIEW') color = '#b08d00'; // Dark yellow
    else color = 'red';

    row.innerHTML = `
        <td>${time}</td>
        <td style="color:${color}; font-weight:bold">${decision}</td>
        <td>${score}</td>
    `;

    // Prepend
    tbody.insertBefore(row, tbody.firstChild);

    // Limit to 10
    if (tbody.children.length > 10) {
        tbody.removeChild(tbody.lastChild);
    }
}

async function investigateTransaction() {
    if (!currentResult) return;

    const btn = document.getElementById('investigateBtn');
    const panel = document.getElementById('investigationPanel');
    const content = document.getElementById('investigationContent');

    btn.disabled = true;
    btn.textContent = 'Consulting Gemini...';
    panel.classList.remove('hidden');
    content.textContent = 'Analyzing transaction patterns and merchant history...';

    // Prepare payload for investigation
    const invPayload = {
        merchant_id: currentResult.merchant_id,
        merchant_name: currentResult.merchant_name,
        amount: 0.99, // default
        decision: currentResult.decision,
        merchant_trust_score: currentResult.merchant_trust_score,
        rename_similarity_score: currentResult.rename_similarity_score,
        closest_company_match: currentResult.closest_company_match,
        patterns_detected: currentResult.patterns_detected
    };

    try {
        const url = `${firewallBaseUrl.replace(/\/$/, '')}/investigate-transaction`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(invPayload)
        });

        if (!response.ok) throw new Error(`RAG Error: ${response.status}`);
        const data = await response.json();
        const info = data.investigation;

        // Format the output
        let html = `<strong>Risk Summary:</strong> ${info.risk_summary || 'N/A'}\n\n`;
        if (info.key_reasons) html += `<strong>Reasons:</strong>\n- ${info.key_reasons.join('\n- ')}\n\n`;
        if (info.cancellation_instructions) html += `<strong>How to Cancel:</strong>\n${info.cancellation_instructions.join('\n')}`;

        content.innerHTML = html.replace(/\n/g, '<br>');

    } catch (e) {
        content.textContent = "Error: " + e.message;
    } finally {
        btn.disabled = false;
        btn.textContent = '🕵️ Investigate';
    }
}
