// ==========================================
// Recurring Payment Firewall - Type Definitions
// ==========================================

// Risk levels for merchants
export type RiskLevel = "LOW" | "MEDIUM" | "HIGH";

// Transaction decision types
export type Decision = "ALLOW" | "REVIEW" | "BLOCK";

// Transaction status
export type TransactionStatus = "SUCCESS" | "FAILED" | "REFUNDED" | "CHARGEBACK";

// Alert severity
export type AlertSeverity = "MEDIUM" | "HIGH" | "CRITICAL";

// Alert status
export type AlertStatus = "OPEN" | "ACKNOWLEDGED" | "RESOLVED";

// Explanation source type
export type ExplanationSourceType = "RAG" | "RULE_BASED";

// ==========================================
// Merchant
// ==========================================
export interface Merchant {
  merchantId: string;
  name: string;
  category: string;
  country: string;
  onboardedAt: Date;
  currentTrustScore: number;
  riskLevel: RiskLevel;
  clusterLabel?: string;
  lastEvaluatedAt: Date;
  notes?: string;
}

// ==========================================
// Transaction
// ==========================================
export interface Transaction {
  transactionId: string;
  merchantId: string;
  customerId: string;
  amount: number;
  currency: string;
  timestamp: Date;
  isRecurring: boolean;
  planId?: string;
  status: TransactionStatus;
  wasCustomerCancelled: boolean;
  decision: Decision;
  latencyMs: number;
  triggeredRules: string[];
}

export interface TransactionInput {
  transactionId?: string;
  merchantId: string;
  customerId: string;
  amount: number;
  currency: string;
  timestamp?: Date;
  isRecurring: boolean;
  planId?: string;
  status: TransactionStatus;
  wasCustomerCancelled: boolean;
}

// ==========================================
// Merchant Features
// ==========================================
export interface MerchantFeatures {
  merchantId: string;
  windowStart: Date;
  windowEnd: Date;
  txCount: number;
  recurringTxCount: number;
  refundRate: number;
  chargebackRate: number;
  postCancelChargeCount: number;
  firstCycleCancelRate: number;
  microChargeRatio: number;
  anomalyScore: number;
}

// ==========================================
// Alert
// ==========================================
export interface Alert {
  alertId: string;
  merchantId: string;
  createdAt: Date;
  severity: AlertSeverity;
  trustScoreAtAlert: number;
  reasonCodes: string[];
  status: AlertStatus;
  resolvedAt?: Date;
}

// ==========================================
// Explanation
// ==========================================
export interface Explanation {
  explanationId: string;
  merchantId: string;
  alertId?: string;
  createdAt: Date;
  explanationText: string;
  recommendedActions: string[];
  sourceType: ExplanationSourceType;
}

// ==========================================
// RAG Document
// ==========================================
export interface RagDocument {
  docId: string;
  merchantId?: string;
  title: string;
  body: string;
  embedding: number[];
  tags: string[];
}

// ==========================================
// Detection Types
// ==========================================
export interface DetectionInput {
  merchantId: string;
  transaction: TransactionInput;
}

export interface DetectionOutput {
  decision: Decision;
  trustScore: number;
  riskLevel: RiskLevel;
  triggeredRules: string[];
  anomalyScore: number;
}

// ==========================================
// API Response Types
// ==========================================
export interface EvaluateResponse extends DetectionOutput {
  latencyMs: number;
  transactionId: string;
}

export interface MerchantDetail extends Merchant {
  features?: MerchantFeatures;
  recentTransactions: Transaction[];
  openAlerts: Alert[];
  latestExplanation?: Explanation;
}

// ==========================================
// Pagination
// ==========================================
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
