// ==========================================
// Seed Data for Recurring Payment Firewall
// ==========================================

import type { RagDocument } from "@/lib/types";

// ==========================================
// RAG Documents - Fraud Patterns & Cases
// ==========================================

export const ragDocuments: Omit<RagDocument, "embedding">[] = [
  // Generic Pattern: Forced Continuity
  {
    docId: "pattern_forced_continuity",
    title: "Forced Continuity / Dark Trial Pattern",
    body: `Forced continuity is a deceptive practice where customers are automatically enrolled in paid subscriptions after a free trial without clear disclosure or easy cancellation options.

Key Indicators:
- High first-cycle cancellation rates (>30%)
- Elevated chargeback rates (>2%)
- Customer complaints about unexpected charges
- Difficult or hidden cancellation processes

This pattern often involves:
1. Free trials that auto-convert to paid subscriptions
2. Pre-checked subscription boxes during checkout
3. Confusing or hidden terms and conditions
4. Deliberately complex cancellation workflows

Remediation Steps:
- Require explicit opt-in for subscription conversion
- Send clear notification before trial ends
- Provide simple one-click cancellation
- Implement proactive refund policies for disputed charges`,
    tags: ["FORCED_CONTINUITY", "DARK_PATTERN", "TRIAL_ABUSE"],
  },

  // Generic Pattern: Post-Cancellation Charges
  {
    docId: "pattern_post_cancel",
    title: "Post-Cancellation Charging Pattern",
    body: `Post-cancellation charging occurs when merchants continue to bill customers after they have explicitly cancelled their subscription or service.

Key Indicators:
- Charges appearing after confirmed cancellation
- Multiple charges following cancellation request
- Billing for services no longer being used
- Customer disputes about unauthorized transactions

Common Causes:
1. Billing system bugs or delays
2. Grace period policies not clearly communicated
3. Intentional fraudulent behavior
4. Complex multi-tier subscription structures

Remediation Steps:
- Audit billing system for proper cancellation handling
- Implement immediate billing termination on cancellation
- Provide instant cancellation confirmations
- Proactively refund any post-cancellation charges
- Review and simplify subscription tier structures`,
    tags: ["POST_CANCEL_CHARGES", "BILLING_ABUSE", "SUBSCRIPTION_FRAUD"],
  },

  // Generic Pattern: Micro-Charges
  {
    docId: "pattern_micro_charges",
    title: "Micro-Charges / Card Testing Pattern",
    body: `Micro-charges involve processing numerous small-value transactions, often used for card testing or to avoid detection of fraudulent activity.

Key Indicators:
- High volume of transactions under $1
- Rapid succession of small charges
- Small charges followed by larger ones
- Unusual transaction patterns and timing

Risk Assessment:
1. Card testing: Fraudsters verify stolen card numbers with small charges
2. Aggregate fraud: Multiple small charges that add up
3. Detection avoidance: Staying under monitoring thresholds
4. Account validation: Testing if accounts are active

Remediation Steps:
- Implement velocity checks on small transactions
- Set minimum transaction amounts
- Monitor for rapid-fire transaction patterns
- Block merchants with abnormal micro-charge ratios
- Alert on sudden spikes in small-value transactions`,
    tags: ["MICRO_CHARGES", "CARD_TESTING", "FRAUD_DETECTION"],
  },

  // Generic Pattern: High Chargebacks
  {
    docId: "pattern_high_chargeback",
    title: "High Chargeback Rate Pattern",
    body: `A high chargeback rate indicates significant customer disputes and potential merchant fraud. Industry standards typically set the threshold at 1% of transactions.

Key Indicators:
- Chargeback rate exceeding 1%
- Increasing trend in disputes
- Multiple chargeback reason codes
- Customer complaints correlating with chargebacks

Common Causes:
1. Unclear billing descriptors
2. Product/service quality issues
3. Subscription billing confusion
4. Intentional fraud or deception
5. Poor customer service response

Remediation Steps:
- Review and improve billing descriptors
- Enhance product/service quality
- Implement clear cancellation and refund policies
- Provide responsive customer service
- Monitor chargeback trends by reason code
- Consider chargeback insurance or prevention tools`,
    tags: ["HIGH_CHARGEBACK_RATE", "DISPUTES", "MERCHANT_RISK"],
  },

  // Case Study 1: Subscription Box Fraud
  {
    docId: "case_study_subscription_box",
    merchantId: "case_merchant_001",
    title: "Case Study: Subscription Box Service Fraud",
    body: `A subscription box service showed concerning patterns over a 3-month period:

Situation:
- Trust Score: 35/100
- Risk Level: HIGH
- Chargeback Rate: 4.2%
- First Cycle Cancel Rate: 45%
- Post-Cancellation Charges: 12

Analysis:
The merchant offered "free trial" boxes that auto-converted to $89/month subscriptions. Cancellation required calling during limited hours. Many customers were unaware of the subscription terms.

Actions Taken:
1. Required merchant to implement clear disclosure of subscription terms
2. Mandated easy online cancellation option
3. Implemented 30-day monitoring period
4. Required proactive refunds for disputed charges

Outcome:
After remediation, chargeback rate dropped to 0.8% within 60 days. Merchant now operates within acceptable parameters with a trust score of 78.`,
    tags: ["FORCED_CONTINUITY", "HIGH_CHARGEBACK_RATE", "CASE_STUDY"],
  },

  // Case Study 2: SaaS Platform Issues
  {
    docId: "case_study_saas_platform",
    merchantId: "case_merchant_002",
    title: "Case Study: SaaS Platform Billing Problems",
    body: `A B2B SaaS platform triggered multiple alerts due to post-cancellation billing issues:

Situation:
- Trust Score: 52/100
- Risk Level: MEDIUM
- Post-Cancellation Charges: 8
- Refund Rate: 18%
- Anomaly Score: 67%

Analysis:
The platform had annual billing with complex enterprise tiers. When customers downgraded or cancelled, the billing system continued charging for the previous tier due to synchronization bugs between the CRM and billing systems.

Actions Taken:
1. Identified billing system integration issues
2. Required immediate technical audit
3. Mandated customer communication about refunds
4. Implemented weekly billing reconciliation checks

Outcome:
Technical issues were resolved within 2 weeks. All affected customers received automatic refunds. Trust score improved to 81 within 30 days.`,
    tags: ["POST_CANCEL_CHARGES", "HIGH_REFUND_RATE", "CASE_STUDY"],
  },

  // Case Study 3: Gaming Platform Micro-Charges
  {
    docId: "case_study_gaming_platform",
    merchantId: "case_merchant_003",
    title: "Case Study: Gaming Platform Card Testing",
    body: `A mobile gaming platform showed suspicious micro-charge patterns:

Situation:
- Trust Score: 41/100
- Risk Level: HIGH
- Micro-Charge Ratio: 28%
- Anomaly Score: 82%
- Transaction Volume: 15,000/day

Analysis:
The platform allowed in-app purchases starting at $0.99. Analysis revealed a spike in $0.99 charges from new accounts, followed by larger purchases. This pattern indicated card testing activity by fraudsters.

Actions Taken:
1. Implemented velocity checks on small transactions
2. Required additional verification for new accounts
3. Added device fingerprinting
4. Blocked suspicious transaction patterns in real-time

Outcome:
Micro-charge ratio dropped to 5% within 1 week. Fraud losses decreased by 78%. Trust score improved to 72.`,
    tags: ["MICRO_CHARGES", "CARD_TESTING", "ANOMALY_DETECTED", "CASE_STUDY"],
  },

  // Case Study 4: Fitness App Dark Patterns
  {
    docId: "case_study_fitness_app",
    merchantId: "case_merchant_004",
    title: "Case Study: Fitness App Trial Abuse",
    body: `A fitness app subscription service exhibited classic dark pattern behavior:

Situation:
- Trust Score: 28/100
- Risk Level: HIGH
- First Cycle Cancel Rate: 62%
- Chargeback Rate: 5.1%
- Forced Continuity: Detected

Analysis:
The app offered a "7-day free trial" that required payment information upfront. The trial auto-converted to an annual subscription at $149.99. Cancellation required navigating through 8 screens and confirming multiple times.

Actions Taken:
1. BLOCKED all new transactions pending review
2. Required merchant to simplify cancellation to 2 clicks maximum
3. Mandated clear trial terms on signup screens
4. Required email notification 3 days before trial ends
5. Implemented automatic refund policy for first-time chargebacks

Outcome:
Merchant implemented changes within 2 weeks. Monitoring showed first-cycle cancel rate dropped to 22%, chargebacks reduced to 0.9%. Trust score reached 71 after 60-day probation.`,
    tags: ["FORCED_CONTINUITY", "HIGH_CHARGEBACK_RATE", "DARK_PATTERN", "CASE_STUDY"],
  },

  // Case Study 5: Newsletter Subscription Fraud
  {
    docId: "case_study_newsletter",
    merchantId: "case_merchant_005",
    title: "Case Study: Premium Newsletter Billing Issues",
    body: `A premium newsletter service showed multiple risk indicators:

Situation:
- Trust Score: 45/100
- Risk Level: MEDIUM
- Chargeback Rate: 2.3%
- Refund Rate: 24%
- Post-Cancel Charges: 5

Analysis:
The newsletter offered monthly and annual subscriptions with automatic renewal. Customers reported difficulty finding cancellation options, and the billing system had timezone-related bugs causing charges after cancellation for certain regions.

Actions Taken:
1. Required prominent unsubscribe link in every email
2. Added one-click cancellation from account dashboard
3. Fixed timezone handling in billing system
4. Implemented proactive renewal reminders

Outcome:
Within 30 days, refund rate dropped to 8%, chargebacks reduced to 0.6%. Customer satisfaction improved significantly. Trust score reached 83.`,
    tags: ["POST_CANCEL_CHARGES", "HIGH_REFUND_RATE", "CASE_STUDY"],
  },

  // Industry Guidelines
  {
    docId: "guidelines_subscription_best_practices",
    title: "Subscription Industry Best Practices",
    body: `Best practices for subscription-based businesses to maintain compliance and customer trust:

Transparency Requirements:
1. Clear pricing disclosure before payment
2. Explicit consent for recurring charges
3. Easy-to-find terms and conditions
4. Billing descriptor matching business name

Cancellation Standards:
1. Online cancellation option (no phone-only)
2. Maximum 2-3 clicks to cancel
3. Immediate cancellation confirmation
4. No dark patterns or guilt-tripping

Billing Practices:
1. Send reminder before each billing cycle
2. Provide receipts for all charges
3. Implement proactive refund policies
4. Honor cancellation requests immediately

Monitoring Thresholds:
- Chargeback Rate: Keep under 1%
- Refund Rate: Keep under 10%
- First Cycle Cancellation: Keep under 20%
- Customer Complaints: Address within 24 hours`,
    tags: ["BEST_PRACTICES", "COMPLIANCE", "GUIDELINES"],
  },
];

// ==========================================
// Merchant Profiles for Seeding
// ==========================================

interface MerchantProfile {
  merchantId: string;
  name: string;
  category: string;
  country: string;
  profile: "good" | "medium" | "bad";
  // Feature ranges for this merchant type
  features: {
    chargebackRate: [number, number];
    refundRate: [number, number];
    postCancelChargeCount: [number, number];
    firstCycleCancelRate: [number, number];
    microChargeRatio: [number, number];
    txCountMultiplier: number;
  };
}

export const merchantProfiles: MerchantProfile[] = [
  // Good merchants
  {
    merchantId: "merchant_good_001",
    name: "StreamFlow Video",
    category: "Streaming",
    country: "US",
    profile: "good",
    features: {
      chargebackRate: [0.001, 0.005],
      refundRate: [0.02, 0.06],
      postCancelChargeCount: [0, 1],
      firstCycleCancelRate: [0.05, 0.12],
      microChargeRatio: [0.01, 0.03],
      txCountMultiplier: 1.2,
    },
  },
  {
    merchantId: "merchant_good_002",
    name: "CloudStore Pro",
    category: "Cloud Storage",
    country: "US",
    profile: "good",
    features: {
      chargebackRate: [0.002, 0.006],
      refundRate: [0.03, 0.07],
      postCancelChargeCount: [0, 2],
      firstCycleCancelRate: [0.08, 0.15],
      microChargeRatio: [0.0, 0.02],
      txCountMultiplier: 1.0,
    },
  },
  {
    merchantId: "merchant_good_003",
    name: "FitLife Premium",
    category: "Health & Fitness",
    country: "UK",
    profile: "good",
    features: {
      chargebackRate: [0.003, 0.008],
      refundRate: [0.04, 0.09],
      postCancelChargeCount: [0, 1],
      firstCycleCancelRate: [0.1, 0.18],
      microChargeRatio: [0.02, 0.04],
      txCountMultiplier: 0.8,
    },
  },
  {
    merchantId: "merchant_good_004",
    name: "NewsDaily Plus",
    category: "News & Media",
    country: "US",
    profile: "good",
    features: {
      chargebackRate: [0.001, 0.004],
      refundRate: [0.02, 0.05],
      postCancelChargeCount: [0, 0],
      firstCycleCancelRate: [0.06, 0.12],
      microChargeRatio: [0.0, 0.01],
      txCountMultiplier: 1.5,
    },
  },
  {
    merchantId: "merchant_good_005",
    name: "MusicStream HQ",
    category: "Music",
    country: "DE",
    profile: "good",
    features: {
      chargebackRate: [0.002, 0.005],
      refundRate: [0.03, 0.06],
      postCancelChargeCount: [0, 1],
      firstCycleCancelRate: [0.07, 0.14],
      microChargeRatio: [0.01, 0.02],
      txCountMultiplier: 1.3,
    },
  },
  {
    merchantId: "merchant_good_006",
    name: "LearnCode Academy",
    category: "Education",
    country: "US",
    profile: "good",
    features: {
      chargebackRate: [0.001, 0.003],
      refundRate: [0.04, 0.08],
      postCancelChargeCount: [0, 1],
      firstCycleCancelRate: [0.12, 0.2],
      microChargeRatio: [0.0, 0.01],
      txCountMultiplier: 0.7,
    },
  },
  {
    merchantId: "merchant_good_007",
    name: "DesignHub Pro",
    category: "Design Tools",
    country: "CA",
    profile: "good",
    features: {
      chargebackRate: [0.002, 0.006],
      refundRate: [0.05, 0.1],
      postCancelChargeCount: [0, 2],
      firstCycleCancelRate: [0.08, 0.16],
      microChargeRatio: [0.0, 0.02],
      txCountMultiplier: 0.9,
    },
  },

  // Medium risk merchants
  {
    merchantId: "merchant_med_001",
    name: "QuickBox Subscription",
    category: "E-commerce",
    country: "US",
    profile: "medium",
    features: {
      chargebackRate: [0.008, 0.015],
      refundRate: [0.1, 0.18],
      postCancelChargeCount: [2, 4],
      firstCycleCancelRate: [0.2, 0.28],
      microChargeRatio: [0.03, 0.08],
      txCountMultiplier: 1.0,
    },
  },
  {
    merchantId: "merchant_med_002",
    name: "GymPro Membership",
    category: "Health & Fitness",
    country: "US",
    profile: "medium",
    features: {
      chargebackRate: [0.01, 0.018],
      refundRate: [0.08, 0.14],
      postCancelChargeCount: [1, 3],
      firstCycleCancelRate: [0.18, 0.25],
      microChargeRatio: [0.02, 0.05],
      txCountMultiplier: 0.8,
    },
  },
  {
    merchantId: "merchant_med_003",
    name: "DateConnect Premium",
    category: "Dating",
    country: "UK",
    profile: "medium",
    features: {
      chargebackRate: [0.012, 0.02],
      refundRate: [0.12, 0.2],
      postCancelChargeCount: [2, 5],
      firstCycleCancelRate: [0.22, 0.32],
      microChargeRatio: [0.04, 0.1],
      txCountMultiplier: 0.9,
    },
  },
  {
    merchantId: "merchant_med_004",
    name: "VPN Shield Plus",
    category: "Security",
    country: "NL",
    profile: "medium",
    features: {
      chargebackRate: [0.009, 0.016],
      refundRate: [0.1, 0.16],
      postCancelChargeCount: [1, 4],
      firstCycleCancelRate: [0.15, 0.24],
      microChargeRatio: [0.01, 0.04],
      txCountMultiplier: 1.1,
    },
  },
  {
    merchantId: "merchant_med_005",
    name: "GamePass Ultimate",
    category: "Gaming",
    country: "US",
    profile: "medium",
    features: {
      chargebackRate: [0.008, 0.014],
      refundRate: [0.09, 0.15],
      postCancelChargeCount: [2, 4],
      firstCycleCancelRate: [0.16, 0.26],
      microChargeRatio: [0.08, 0.14],
      txCountMultiplier: 1.4,
    },
  },
  {
    merchantId: "merchant_med_006",
    name: "MealKit Express",
    category: "Food & Beverage",
    country: "US",
    profile: "medium",
    features: {
      chargebackRate: [0.01, 0.017],
      refundRate: [0.11, 0.19],
      postCancelChargeCount: [3, 6],
      firstCycleCancelRate: [0.24, 0.35],
      microChargeRatio: [0.02, 0.05],
      txCountMultiplier: 0.7,
    },
  },

  // Bad merchants (high risk)
  {
    merchantId: "merchant_bad_001",
    name: "TrialBox Free",
    category: "E-commerce",
    country: "US",
    profile: "bad",
    features: {
      chargebackRate: [0.025, 0.045],
      refundRate: [0.2, 0.35],
      postCancelChargeCount: [6, 12],
      firstCycleCancelRate: [0.4, 0.55],
      microChargeRatio: [0.05, 0.1],
      txCountMultiplier: 0.8,
    },
  },
  {
    merchantId: "merchant_bad_002",
    name: "SlimFast Trial",
    category: "Health & Fitness",
    country: "US",
    profile: "bad",
    features: {
      chargebackRate: [0.03, 0.052],
      refundRate: [0.25, 0.4],
      postCancelChargeCount: [8, 15],
      firstCycleCancelRate: [0.45, 0.62],
      microChargeRatio: [0.03, 0.08],
      txCountMultiplier: 0.6,
    },
  },
  {
    merchantId: "merchant_bad_003",
    name: "CryptoSignals VIP",
    category: "Finance",
    country: "MT",
    profile: "bad",
    features: {
      chargebackRate: [0.035, 0.06],
      refundRate: [0.18, 0.3],
      postCancelChargeCount: [5, 10],
      firstCycleCancelRate: [0.35, 0.5],
      microChargeRatio: [0.15, 0.28],
      txCountMultiplier: 1.2,
    },
  },
  {
    merchantId: "merchant_bad_004",
    name: "MobileGames Plus",
    category: "Gaming",
    country: "CY",
    profile: "bad",
    features: {
      chargebackRate: [0.028, 0.048],
      refundRate: [0.15, 0.25],
      postCancelChargeCount: [4, 8],
      firstCycleCancelRate: [0.3, 0.45],
      microChargeRatio: [0.2, 0.35],
      txCountMultiplier: 1.5,
    },
  },
  {
    merchantId: "merchant_bad_005",
    name: "DatingElite Premium",
    category: "Dating",
    country: "US",
    profile: "bad",
    features: {
      chargebackRate: [0.032, 0.055],
      refundRate: [0.22, 0.38],
      postCancelChargeCount: [7, 14],
      firstCycleCancelRate: [0.42, 0.58],
      microChargeRatio: [0.04, 0.09],
      txCountMultiplier: 0.7,
    },
  },
  {
    merchantId: "merchant_bad_006",
    name: "AstroReading Live",
    category: "Entertainment",
    country: "RO",
    profile: "bad",
    features: {
      chargebackRate: [0.04, 0.065],
      refundRate: [0.28, 0.42],
      postCancelChargeCount: [9, 18],
      firstCycleCancelRate: [0.5, 0.68],
      microChargeRatio: [0.06, 0.12],
      txCountMultiplier: 0.5,
    },
  },
  {
    merchantId: "merchant_bad_007",
    name: "WinBig Casino",
    category: "Gaming",
    country: "GI",
    profile: "bad",
    features: {
      chargebackRate: [0.038, 0.058],
      refundRate: [0.12, 0.22],
      postCancelChargeCount: [3, 7],
      firstCycleCancelRate: [0.28, 0.42],
      microChargeRatio: [0.22, 0.38],
      txCountMultiplier: 1.8,
    },
  },
];

// Helper function to get random value in range
export function randomInRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

// Helper function to generate a unique ID
export function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
}

// Transaction statuses with weights
export const transactionStatuses: { status: string; weight: number }[] = [
  { status: "SUCCESS", weight: 0.88 },
  { status: "FAILED", weight: 0.05 },
  { status: "REFUNDED", weight: 0.04 },
  { status: "CHARGEBACK", weight: 0.03 },
];

// Currencies
export const currencies = ["USD", "EUR", "GBP", "CAD", "AUD"];

// Amount ranges by category
export const amountRanges: Record<string, [number, number]> = {
  Streaming: [4.99, 19.99],
  "Cloud Storage": [2.99, 14.99],
  "Health & Fitness": [9.99, 49.99],
  "News & Media": [4.99, 14.99],
  Music: [4.99, 14.99],
  Education: [19.99, 99.99],
  "Design Tools": [9.99, 49.99],
  "E-commerce": [19.99, 79.99],
  Dating: [14.99, 49.99],
  Security: [4.99, 12.99],
  Gaming: [4.99, 59.99],
  "Food & Beverage": [39.99, 89.99],
  Finance: [29.99, 199.99],
  Entertainment: [9.99, 39.99],
};
