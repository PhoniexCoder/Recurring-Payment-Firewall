export interface TransactionPayload {
    transactionId: string;
    merchantId: string;
    customerId: string;
    amount: number;
    currency: string;
    timestamp: string;
    isRecurring: boolean;
    planId: string;
    status: string;
    wasCustomerCancelled: boolean;
}

export interface FirewallResponse {
    decision: "ALLOW" | "REVIEW" | "BLOCK";
    trustScore: number;
    riskLevel: "LOW" | "MEDIUM" | "HIGH";
    triggeredRules: string[];
    latencyMs: number;
}

export interface MerchantProfile {
    id: string;
    name: string;
    description: string;
    defaultPlanId: string;
}

export interface HistoryItem {
    timestamp: string;
    transactionId: string;
    merchantName: string;
    amount: number;
    currency: string;
    decision?: string;
    trustScore?: number;
}
