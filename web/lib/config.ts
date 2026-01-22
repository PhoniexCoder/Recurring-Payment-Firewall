// ==========================================
// Detection Rule Configuration
// ==========================================

export const DETECTION_CONFIG = {
  // Forced continuity / dark trial thresholds
  forcedContinuity: {
    firstCycleCancelRateThreshold: 0.3, // 30% cancel in first cycle
    chargebackRateThreshold: 0.02, // 2% chargebacks
  },

  // Post-cancellation charging
  postCancelCharging: {
    countThreshold: 3, // More than 3 post-cancel charges
  },

  // Micro-charges / card testing
  microCharges: {
    ratioThreshold: 0.15, // 15% of transactions are micro-charges
  },

  // High chargeback merchant
  highChargeback: {
    rateThreshold: 0.01, // 1% chargeback rate (industry standard)
  },

  // Trust score penalties
  penalties: {
    chargebackRate: {
      weight: 40, // Max penalty from chargeback rate
      threshold: 0.05, // At 5% chargeback rate, full penalty
    },
    refundRate: {
      weight: 15, // Max penalty from refund rate
      threshold: 0.2, // At 20% refund rate, full penalty
    },
    postCancelChargeCount: {
      weight: 15, // Max penalty from post-cancel charges
      threshold: 10, // At 10 charges, full penalty
    },
    microChargeRatio: {
      weight: 10, // Max penalty from micro-charge ratio
      threshold: 0.3, // At 30%, full penalty
    },
    anomalyScore: {
      weight: 15, // Max penalty from anomaly score
    },
    ruleTriggered: {
      standard: 3, // Per standard rule triggered
      critical: 8, // Per critical rule triggered
    },
  },

  // Risk level thresholds
  riskLevels: {
    low: { min: 80, max: 100 },
    medium: { min: 50, max: 79 },
    high: { min: 0, max: 49 },
  },

  // Reason codes
  reasonCodes: {
    FORCED_CONTINUITY: "FORCED_CONTINUITY",
    POST_CANCEL_CHARGES: "POST_CANCEL_CHARGES",
    MICRO_CHARGES: "MICRO_CHARGES",
    HIGH_CHARGEBACK_RATE: "HIGH_CHARGEBACK_RATE",
    HIGH_REFUND_RATE: "HIGH_REFUND_RATE",
    ANOMALY_DETECTED: "ANOMALY_DETECTED",
  },

  // Critical rules that trigger immediate BLOCK
  criticalRules: ["HIGH_CHARGEBACK_RATE", "FORCED_CONTINUITY"],

  // Alert severity mapping
  alertSeverity: {
    trustScoreCritical: 30,
    trustScoreHigh: 50,
  },
};

// Micro-charge threshold (transactions under this amount are considered micro)
export const MICRO_CHARGE_AMOUNT = 1.0; // $1.00

// Feature calculation window in days
export const FEATURE_WINDOW_DAYS = 30;

// Feature history to maintain (6 months)
export const FEATURE_HISTORY_DAYS = 180;
