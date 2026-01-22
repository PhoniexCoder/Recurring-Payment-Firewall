// Defaults
const DEFAULT_URL = 'http://localhost:3000';
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
    document.getElementById('openOptions').addEventListener('click', () => chrome.runtime.openOptionsPage());

    // Preset listeners
    document.querySelectorAll('.preset-btn').forEach(btn => {
        btn.addEventListener('click', () => applyPreset(btn.dataset.preset));
    });
});

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

    // Construct Payload
    const payload = {
        transactionId: `ext_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
        merchantId: document.getElementById('merchantId').value,
        customerId: document.getElementById('customerId').value,
        amount: parseFloat(document.getElementById('amount').value),
        currency: document.getElementById('currency').value,
        timestamp: new Date().toISOString(),
        isRecurring: document.getElementById('isRecurring').checked,
        planId: document.getElementById('planId').value,
        status: "SUCCESS",
        wasCustomerCancelled: document.getElementById('wasCustomerCancelled').checked
    };

    try {
        const url = `${firewallBaseUrl.replace(/\/$/, '')}/api/transactions/evaluate`;
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

        // Render Result
        decisionLabel.textContent = result.decision;
        scoreLabel.textContent = `Score: ${result.trustScore}`;
        riskLabel.textContent = result.riskLevel;
        latencyLabel.textContent = result.latencyMs;
        rulesLabel.textContent = result.triggeredRules && result.triggeredRules.length
            ? result.triggeredRules.join(', ')
            : 'None';

        // Apply Styling
        resultPanel.classList.remove('bg-allow', 'bg-review', 'bg-block');
        if (result.decision === 'ALLOW') resultPanel.classList.add('bg-allow');
        else if (result.decision === 'REVIEW') resultPanel.classList.add('bg-review');
        else resultPanel.classList.add('bg-block');

        // Add to History
        addToHistory(result.decision, result.trustScore);

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
