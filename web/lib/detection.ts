// ==========================================
// Recurring Payment Firewall - Detection Logic
// ==========================================

import { DETECTION_CONFIG } from "./config";
import type {
  MerchantFeatures,
  RiskLevel,
  Decision,
  DetectionOutput,
  AlertSeverity,
} from "./types";

// ==========================================
// Default Features (when no history exists)
// ==========================================

export function getDefaultFeatures(merchantId: string): MerchantFeatures {
  const now = new Date();
  const windowStart = new Date(now);
  windowStart.setDate(windowStart.getDate() - 30);

  return {
    merchantId,
    windowStart,
    windowEnd: now,
    txCount: 0,
    recurringTxCount: 0,
    refundRate: 0,
    chargebackRate: 0,
    postCancelChargeCount: 0,
    firstCycleCancelRate: 0,
    microChargeRatio: 0,
    anomalyScore: 0,
  };
}

// ==========================================
// Rule Engine
// ==========================================

interface RuleResult {
  triggered: boolean;
  code: string;
  isCritical: boolean;
}

/**
 * Check for forced continuity / dark trial pattern
 */
export function checkForcedContinuity(features: MerchantFeatures): RuleResult {
  const { forcedContinuity, reasonCodes, criticalRules } = DETECTION_CONFIG;
  const triggered =
    features.firstCycleCancelRate > forcedContinuity.firstCycleCancelRateThreshold &&
    features.chargebackRate > forcedContinuity.chargebackRateThreshold;

  return {
    triggered,
    code: reasonCodes.FORCED_CONTINUITY,
    isCritical: criticalRules.includes(reasonCodes.FORCED_CONTINUITY),
  };
}

/**
 * Check for post-cancellation charging pattern
 */
export function checkPostCancelCharging(features: MerchantFeatures): RuleResult {
  const { postCancelCharging, reasonCodes, criticalRules } = DETECTION_CONFIG;
  const triggered = features.postCancelChargeCount > postCancelCharging.countThreshold;

  return {
    triggered,
    code: reasonCodes.POST_CANCEL_CHARGES,
    isCritical: criticalRules.includes(reasonCodes.POST_CANCEL_CHARGES),
  };
}

/**
 * Check for micro-charges / card testing pattern
 */
export function checkMicroCharges(features: MerchantFeatures): RuleResult {
  const { microCharges, reasonCodes, criticalRules } = DETECTION_CONFIG;
  const triggered = features.microChargeRatio > microCharges.ratioThreshold;

  return {
    triggered,
    code: reasonCodes.MICRO_CHARGES,
    isCritical: criticalRules.includes(reasonCodes.MICRO_CHARGES),
  };
}

/**
 * Check for high chargeback rate
 */
export function checkHighChargebackRate(features: MerchantFeatures): RuleResult {
  const { highChargeback, reasonCodes, criticalRules } = DETECTION_CONFIG;
  const triggered = features.chargebackRate > highChargeback.rateThreshold;

  return {
    triggered,
    code: reasonCodes.HIGH_CHARGEBACK_RATE,
    isCritical: criticalRules.includes(reasonCodes.HIGH_CHARGEBACK_RATE),
  };
}

/**
 * Check for high refund rate
 */
export function checkHighRefundRate(features: MerchantFeatures): RuleResult {
  const { reasonCodes, criticalRules } = DETECTION_CONFIG;
  const triggered = features.refundRate > 0.15; // 15% refund rate

  return {
    triggered,
    code: reasonCodes.HIGH_REFUND_RATE,
    isCritical: criticalRules.includes(reasonCodes.HIGH_REFUND_RATE),
  };
}

/**
 * Check for anomaly detection
 */
export function checkAnomaly(features: MerchantFeatures): RuleResult {
  const { reasonCodes, criticalRules } = DETECTION_CONFIG;
  const triggered = features.anomalyScore > 0.7; // 70% anomaly threshold

  return {
    triggered,
    code: reasonCodes.ANOMALY_DETECTED,
    isCritical: criticalRules.includes(reasonCodes.ANOMALY_DETECTED),
  };
}

/**
 * Run all rules and return triggered codes
 */
export function runRuleEngine(features: MerchantFeatures): {
  triggeredRules: string[];
  hasCritical: boolean;
} {
  const rules = [
    checkForcedContinuity(features),
    checkPostCancelCharging(features),
    checkMicroCharges(features),
    checkHighChargebackRate(features),
    checkHighRefundRate(features),
    checkAnomaly(features),
  ];

  const triggered = rules.filter((r) => r.triggered);

  return {
    triggeredRules: triggered.map((r) => r.code),
    hasCritical: triggered.some((r) => r.isCritical),
  };
}

// ==========================================
// Anomaly Scoring
// ==========================================

/**
 * Calculate z-score for a value given population statistics
 */
function calculateZScore(value: number, mean: number, stdDev: number): number {
  if (stdDev === 0) return 0;
  return (value - mean) / stdDev;
}

/**
 * Normalize z-score to 0-1 range using sigmoid-like function
 */
function normalizeZScore(zScore: number): number {
  // Using a modified sigmoid that maps z-scores to 0-1
  // z-score of 2 maps to ~0.73, z-score of 3 maps to ~0.88
  return 1 / (1 + Math.exp(-zScore + 1));
}

// Population statistics (these would normally come from historical data)
const POPULATION_STATS = {
  chargebackRate: { mean: 0.005, stdDev: 0.01 },
  refundRate: { mean: 0.08, stdDev: 0.06 },
  postCancelChargeCount: { mean: 1, stdDev: 2 },
  microChargeRatio: { mean: 0.05, stdDev: 0.08 },
  firstCycleCancelRate: { mean: 0.1, stdDev: 0.15 },
};

/**
 * Calculate anomaly score using weighted z-scores
 * This approximates an Isolation Forest-like approach
 */
export function calculateAnomalyScore(features: MerchantFeatures): number {
  const weights = {
    chargebackRate: 0.35,
    refundRate: 0.15,
    postCancelChargeCount: 0.2,
    microChargeRatio: 0.15,
    firstCycleCancelRate: 0.15,
  };

  let totalScore = 0;

  // Calculate weighted z-scores for each feature
  for (const [key, weight] of Object.entries(weights)) {
    const featureValue = features[key as keyof MerchantFeatures] as number;
    const stats = POPULATION_STATS[key as keyof typeof POPULATION_STATS];
    
    const zScore = calculateZScore(featureValue, stats.mean, stats.stdDev);
    const normalizedScore = normalizeZScore(Math.abs(zScore));
    
    totalScore += normalizedScore * weight;
  }

  // Clamp between 0 and 1
  return Math.max(0, Math.min(1, totalScore));
}

// ==========================================
// Trust Score Calculation
// ==========================================

/**
 * Calculate merchant trust score (0-100)
 */
export function calculateTrustScore(
  features: MerchantFeatures,
  triggeredRules: string[],
  anomalyScore: number
): number {
  const { penalties, criticalRules } = DETECTION_CONFIG;
  let score = 100;

  // Penalty from chargeback rate
  const cbPenalty = Math.min(
    penalties.chargebackRate.weight,
    (features.chargebackRate / penalties.chargebackRate.threshold) *
      penalties.chargebackRate.weight
  );
  score -= cbPenalty;

  // Penalty from refund rate
  const refundPenalty = Math.min(
    penalties.refundRate.weight,
    (features.refundRate / penalties.refundRate.threshold) *
      penalties.refundRate.weight
  );
  score -= refundPenalty;

  // Penalty from post-cancel charges
  const postCancelPenalty = Math.min(
    penalties.postCancelChargeCount.weight,
    (features.postCancelChargeCount / penalties.postCancelChargeCount.threshold) *
      penalties.postCancelChargeCount.weight
  );
  score -= postCancelPenalty;

  // Penalty from micro-charge ratio
  const microPenalty = Math.min(
    penalties.microChargeRatio.weight,
    (features.microChargeRatio / penalties.microChargeRatio.threshold) *
      penalties.microChargeRatio.weight
  );
  score -= microPenalty;

  // Penalty from anomaly score
  const anomalyPenalty = anomalyScore * penalties.anomalyScore.weight;
  score -= anomalyPenalty;

  // Penalty from triggered rules
  for (const rule of triggeredRules) {
    if (criticalRules.includes(rule)) {
      score -= penalties.ruleTriggered.critical;
    } else {
      score -= penalties.ruleTriggered.standard;
    }
  }

  // Clamp between 0 and 100
  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Map trust score to risk level
 */
export function getRiskLevel(trustScore: number): RiskLevel {
  const { riskLevels } = DETECTION_CONFIG;

  if (trustScore >= riskLevels.low.min) return "LOW";
  if (trustScore >= riskLevels.medium.min) return "MEDIUM";
  return "HIGH";
}

// ==========================================
// Decision Making
// ==========================================

/**
 * Determine transaction decision based on risk assessment
 */
export function makeDecision(
  riskLevel: RiskLevel,
  triggeredRules: string[],
  hasCritical: boolean
): Decision {
  // Immediate BLOCK for critical rules or HIGH risk
  if (hasCritical || riskLevel === "HIGH") {
    return "BLOCK";
  }

  // REVIEW for MEDIUM risk or any rules triggered
  if (riskLevel === "MEDIUM" || triggeredRules.length > 0) {
    return "REVIEW";
  }

  // ALLOW for LOW risk with no rules
  return "ALLOW";
}

/**
 * Determine alert severity based on trust score
 */
export function getAlertSeverity(trustScore: number, hasCritical: boolean): AlertSeverity {
  const { alertSeverity } = DETECTION_CONFIG;

  if (hasCritical || trustScore < alertSeverity.trustScoreCritical) {
    return "CRITICAL";
  }
  if (trustScore < alertSeverity.trustScoreHigh) {
    return "HIGH";
  }
  return "MEDIUM";
}

// ==========================================
// Main Detection Function
// ==========================================

/**
 * Main detection function that evaluates a merchant's risk
 */
export function evaluateMerchant(features: MerchantFeatures | null, merchantId: string): DetectionOutput {
  // Use default features if none exist
  const effectiveFeatures = features || getDefaultFeatures(merchantId);

  // Calculate anomaly score
  const anomalyScore = calculateAnomalyScore(effectiveFeatures);

  // Update features with calculated anomaly score
  const updatedFeatures = { ...effectiveFeatures, anomalyScore };

  // Run rule engine
  const { triggeredRules, hasCritical } = runRuleEngine(updatedFeatures);

  // Calculate trust score
  const trustScore = calculateTrustScore(updatedFeatures, triggeredRules, anomalyScore);

  // Determine risk level
  const riskLevel = getRiskLevel(trustScore);

  // Make decision
  const decision = makeDecision(riskLevel, triggeredRules, hasCritical);

  return {
    decision,
    trustScore,
    riskLevel,
    triggeredRules,
    anomalyScore,
  };
}

/**
 * Build a text summary of merchant situation for RAG
 */
export function buildMerchantSummary(
  merchantName: string,
  features: MerchantFeatures,
  detection: DetectionOutput
): string {
  return `
Merchant: ${merchantName}
Risk Level: ${detection.riskLevel}
Trust Score: ${detection.trustScore}/100
Anomaly Score: ${(detection.anomalyScore * 100).toFixed(1)}%

Key Metrics:
- Chargeback Rate: ${(features.chargebackRate * 100).toFixed(2)}%
- Refund Rate: ${(features.refundRate * 100).toFixed(2)}%
- Post-Cancel Charges: ${features.postCancelChargeCount}
- First Cycle Cancel Rate: ${(features.firstCycleCancelRate * 100).toFixed(2)}%
- Micro-Charge Ratio: ${(features.microChargeRatio * 100).toFixed(2)}%
- Total Transactions: ${features.txCount}
- Recurring Transactions: ${features.recurringTxCount}

Triggered Rules: ${detection.triggeredRules.length > 0 ? detection.triggeredRules.join(", ") : "None"}
Decision: ${detection.decision}
`.trim();
}
