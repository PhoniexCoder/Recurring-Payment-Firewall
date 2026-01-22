import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import {
  getMerchantById,
  upsertMerchant,
  getLatestMerchantFeatures,
  insertTransaction,
  insertAlert,
} from "@/lib/db";
import {
  evaluateMerchant,
  getDefaultFeatures,
  getAlertSeverity,
} from "@/lib/detection";
import type { TransactionInput, Transaction, Alert, Merchant } from "@/lib/types";

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body = await request.json();
    const input: TransactionInput = body;

    // Validate required fields
    if (!input.merchantId || !input.customerId || input.amount === undefined) {
      return NextResponse.json(
        { error: "Missing required fields: merchantId, customerId, amount" },
        { status: 400 }
      );
    }

    // Generate transaction ID if not provided
    const transactionId = input.transactionId || `txn_${uuidv4()}`;

    // Fetch merchant and features
    const [merchant, features] = await Promise.all([
      getMerchantById(input.merchantId),
      getLatestMerchantFeatures(input.merchantId),
    ]);

    // Run detection logic
    const detection = evaluateMerchant(features, input.merchantId);
    const latencyMs = Date.now() - startTime;

    // Create transaction record
    const transaction: Transaction = {
      transactionId,
      merchantId: input.merchantId,
      customerId: input.customerId,
      amount: input.amount,
      currency: input.currency || "USD",
      timestamp: input.timestamp ? new Date(input.timestamp) : new Date(),
      isRecurring: input.isRecurring ?? false,
      planId: input.planId,
      status: input.status || "SUCCESS",
      wasCustomerCancelled: input.wasCustomerCancelled ?? false,
      decision: detection.decision,
      latencyMs,
      triggeredRules: detection.triggeredRules,
    };

    // Insert transaction
    await insertTransaction(transaction);

    // Update merchant trust score and risk level
    if (merchant) {
      const updatedMerchant: Merchant = {
        ...merchant,
        currentTrustScore: detection.trustScore,
        riskLevel: detection.riskLevel,
        lastEvaluatedAt: new Date(),
      };
      await upsertMerchant(updatedMerchant);
    } else {
      // Create merchant if doesn't exist
      const effectiveFeatures = features || getDefaultFeatures(input.merchantId);
      const newMerchant: Merchant = {
        merchantId: input.merchantId,
        name: `Merchant ${input.merchantId}`,
        category: "Unknown",
        country: "US",
        onboardedAt: effectiveFeatures.windowStart,
        currentTrustScore: detection.trustScore,
        riskLevel: detection.riskLevel,
        lastEvaluatedAt: new Date(),
      };
      await upsertMerchant(newMerchant);
    }

    // Create alert if risk is MEDIUM or HIGH
    if (detection.riskLevel !== "LOW" || detection.triggeredRules.length > 0) {
      const hasCritical = detection.triggeredRules.some((r) =>
        ["HIGH_CHARGEBACK_RATE", "FORCED_CONTINUITY"].includes(r)
      );
      const severity = getAlertSeverity(detection.trustScore, hasCritical);

      const alert: Alert = {
        alertId: `alert_${uuidv4()}`,
        merchantId: input.merchantId,
        createdAt: new Date(),
        severity,
        trustScoreAtAlert: detection.trustScore,
        reasonCodes: detection.triggeredRules,
        status: "OPEN",
      };

      await insertAlert(alert);

      // Note: RAG explanation generation would be triggered here asynchronously
      // For now, we'll let the frontend request it explicitly
    }

    return NextResponse.json({
      transactionId,
      decision: detection.decision,
      trustScore: detection.trustScore,
      riskLevel: detection.riskLevel,
      triggeredRules: detection.triggeredRules,
      anomalyScore: detection.anomalyScore,
      latencyMs,
    });
  } catch (error) {
    console.error("Transaction evaluation error:", error);
    return NextResponse.json(
      { error: "Failed to evaluate transaction" },
      { status: 500 }
    );
  }
}
