import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import {
  getMerchantById,
  getLatestMerchantFeatures,
  insertExplanation,
} from "@/lib/db";
import {
  evaluateMerchant,
  buildMerchantSummary,
  getDefaultFeatures,
} from "@/lib/detection";
import { similarDocuments, hybridSearch } from "@/lib/vectorStore";
import {
  callLLM,
  buildExplanationPrompt,
  parseExplanationResponse,
} from "@/lib/llm";
import type { Explanation } from "@/lib/types";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { merchantId, alertId } = body;

    if (!merchantId) {
      return NextResponse.json(
        { error: "merchantId is required" },
        { status: 400 }
      );
    }

    // Fetch merchant and features
    const [merchant, features] = await Promise.all([
      getMerchantById(merchantId),
      getLatestMerchantFeatures(merchantId),
    ]);

    if (!merchant) {
      return NextResponse.json(
        { error: "Merchant not found" },
        { status: 404 }
      );
    }

    // Run detection to get current assessment
    const detection = evaluateMerchant(features, merchantId);
    const effectiveFeatures = features || getDefaultFeatures(merchantId);

    // Build merchant summary for RAG query
    const merchantSummary = buildMerchantSummary(
      merchant.name,
      effectiveFeatures,
      detection
    );

    // Search for similar documents using hybrid search
    // Use triggered rules as tags for better matching
    const similarDocs = await hybridSearch(
      merchantSummary,
      detection.triggeredRules,
      5
    );

    // If hybrid search returns nothing, try vector-only search
    let relevantDocs = similarDocs;
    if (relevantDocs.length === 0) {
      relevantDocs = await similarDocuments(merchantSummary, 5);
    }

    // Extract case descriptions from similar documents
    const similarCases = relevantDocs.map(
      (doc) => `**${doc.title}**\n${doc.body}`
    );

    // Build prompt and call LLM
    const prompt = buildExplanationPrompt(merchantSummary, similarCases);
    
    let explanationText: string;
    let recommendedActions: string[];

    try {
      const llmResponse = await callLLM(prompt);
      const parsed = parseExplanationResponse(llmResponse);
      explanationText = parsed.explanationText;
      recommendedActions = parsed.recommendedActions;
    } catch {
      // Fallback to rule-based explanation if LLM fails
      explanationText = generateRuleBasedExplanation(merchant.name, effectiveFeatures, detection);
      recommendedActions = generateRuleBasedActions(detection.triggeredRules);
    }

    // Create and save explanation
    const explanation: Explanation = {
      explanationId: `exp_${uuidv4()}`,
      merchantId,
      alertId: alertId || undefined,
      createdAt: new Date(),
      explanationText,
      recommendedActions,
      sourceType: similarCases.length > 0 ? "RAG" : "RULE_BASED",
    };

    await insertExplanation(explanation);

    return NextResponse.json(explanation);
  } catch (error) {
    console.error("Explanation generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate explanation" },
      { status: 500 }
    );
  }
}

/**
 * Generate a rule-based explanation as fallback
 */
function generateRuleBasedExplanation(
  merchantName: string,
  features: {
    chargebackRate: number;
    refundRate: number;
    postCancelChargeCount: number;
    firstCycleCancelRate: number;
    microChargeRatio: number;
  },
  detection: {
    trustScore: number;
    riskLevel: string;
    triggeredRules: string[];
    anomalyScore: number;
  }
): string {
  const parts: string[] = [];

  parts.push(
    `${merchantName} has been classified as ${detection.riskLevel} risk with a trust score of ${detection.trustScore}/100.`
  );

  if (detection.triggeredRules.includes("HIGH_CHARGEBACK_RATE")) {
    parts.push(
      `The merchant's chargeback rate of ${(features.chargebackRate * 100).toFixed(2)}% exceeds industry thresholds, indicating potential fraud or customer dissatisfaction issues.`
    );
  }

  if (detection.triggeredRules.includes("FORCED_CONTINUITY")) {
    parts.push(
      `The combination of high first-cycle cancellation rate (${(features.firstCycleCancelRate * 100).toFixed(1)}%) and elevated chargebacks suggests a possible forced continuity or dark trial pattern.`
    );
  }

  if (detection.triggeredRules.includes("POST_CANCEL_CHARGES")) {
    parts.push(
      `The merchant has ${features.postCancelChargeCount} charges after customer cancellations, which may indicate billing system issues or intentional post-cancellation charging.`
    );
  }

  if (detection.triggeredRules.includes("MICRO_CHARGES")) {
    parts.push(
      `${(features.microChargeRatio * 100).toFixed(1)}% of transactions are micro-charges, which could indicate card testing activity.`
    );
  }

  if (detection.anomalyScore > 0.5) {
    parts.push(
      `The anomaly detection system identified unusual patterns in this merchant's behavior, with an anomaly score of ${(detection.anomalyScore * 100).toFixed(0)}%.`
    );
  }

  return parts.join(" ");
}

/**
 * Generate rule-based recommended actions
 */
function generateRuleBasedActions(triggeredRules: string[]): string[] {
  const actions: string[] = [];

  if (triggeredRules.includes("HIGH_CHARGEBACK_RATE")) {
    actions.push("Implement enhanced monitoring for all transactions from this merchant");
    actions.push("Request merchant provide documentation of their refund/cancellation policies");
  }

  if (triggeredRules.includes("FORCED_CONTINUITY")) {
    actions.push("Audit merchant's trial-to-subscription conversion practices");
    actions.push("Require clear cancellation instructions be provided to customers");
  }

  if (triggeredRules.includes("POST_CANCEL_CHARGES")) {
    actions.push("Investigate merchant's billing system for proper cancellation handling");
    actions.push("Issue refunds for any confirmed post-cancellation charges");
  }

  if (triggeredRules.includes("MICRO_CHARGES")) {
    actions.push("Implement velocity checks on small-amount transactions");
    actions.push("Review customer complaints related to unauthorized charges");
  }

  // Default actions if none triggered
  if (actions.length === 0) {
    actions.push("Continue regular monitoring of merchant activity");
    actions.push("Review merchant's transaction patterns weekly");
    actions.push("Maintain documentation of any customer complaints");
  }

  return actions;
}
