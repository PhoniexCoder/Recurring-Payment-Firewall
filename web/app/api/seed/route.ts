import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import {
  upsertMerchant,
  upsertMerchantFeatures,
  insertTransaction,
  insertAlert,
  upsertRagDocument,
} from "@/lib/db";
import {
  evaluateMerchant,
  getAlertSeverity,
} from "@/lib/detection";
import { generateEmbedding } from "@/lib/llm";
import {
  ragDocuments,
  merchantProfiles,
  randomInRange,
  generateId,
  transactionStatuses,
  currencies,
  amountRanges,
} from "@/scripts/seed-data";
import type {
  Merchant,
  MerchantFeatures,
  Transaction,
  Alert,
  RagDocument,
} from "@/lib/types";

// Number of transactions to generate per merchant
const TRANSACTIONS_PER_MERCHANT = 250;

export async function POST() {
  try {
    console.log("Starting database seeding...");

    // Step 1: Seed RAG Documents
    console.log("Seeding RAG documents...");
    for (const doc of ragDocuments) {
      const embedding = await generateEmbedding(`${doc.title}\n\n${doc.body}`);
      const ragDoc: RagDocument = { ...doc, embedding };
      await upsertRagDocument(ragDoc);
    }
    console.log(`Seeded ${ragDocuments.length} RAG documents`);

    // Step 2: Seed Merchants and their data
    console.log("Seeding merchants...");
    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    for (const profile of merchantProfiles) {
      // Generate random features based on profile ranges
      const features: MerchantFeatures = {
        merchantId: profile.merchantId,
        windowStart: thirtyDaysAgo,
        windowEnd: now,
        txCount: Math.floor(TRANSACTIONS_PER_MERCHANT * profile.features.txCountMultiplier),
        recurringTxCount: Math.floor(
          TRANSACTIONS_PER_MERCHANT * profile.features.txCountMultiplier * 0.7
        ),
        refundRate: randomInRange(...profile.features.refundRate),
        chargebackRate: randomInRange(...profile.features.chargebackRate),
        postCancelChargeCount: Math.floor(
          randomInRange(...profile.features.postCancelChargeCount)
        ),
        firstCycleCancelRate: randomInRange(...profile.features.firstCycleCancelRate),
        microChargeRatio: randomInRange(...profile.features.microChargeRatio),
        anomalyScore: 0, // Will be calculated
      };

      // Run detection to get risk assessment
      const detection = evaluateMerchant(features, profile.merchantId);

      // Create merchant
      const onboardedAt = new Date(now);
      onboardedAt.setDate(onboardedAt.getDate() - Math.floor(Math.random() * 180 + 30));

      const merchant: Merchant = {
        merchantId: profile.merchantId,
        name: profile.name,
        category: profile.category,
        country: profile.country,
        onboardedAt,
        currentTrustScore: detection.trustScore,
        riskLevel: detection.riskLevel,
        lastEvaluatedAt: now,
      };

      await upsertMerchant(merchant);
      await upsertMerchantFeatures({ ...features, anomalyScore: detection.anomalyScore });

      // Generate transactions
      const amountRange = amountRanges[profile.category] || [9.99, 49.99];
      
      for (let i = 0; i < features.txCount; i++) {
        // Random timestamp within the 30-day window
        const timestamp = new Date(
          thirtyDaysAgo.getTime() +
            Math.random() * (now.getTime() - thirtyDaysAgo.getTime())
        );

        // Determine transaction status based on weighted random
        const statusRoll = Math.random();
        let cumulativeWeight = 0;
        let status = "SUCCESS";
        for (const s of transactionStatuses) {
          cumulativeWeight += s.weight;
          if (statusRoll <= cumulativeWeight) {
            status = s.status;
            break;
          }
        }

        // Adjust status weights based on merchant profile
        if (profile.profile === "bad") {
          if (Math.random() < 0.08) status = "CHARGEBACK";
          else if (Math.random() < 0.15) status = "REFUNDED";
        } else if (profile.profile === "medium") {
          if (Math.random() < 0.04) status = "CHARGEBACK";
          else if (Math.random() < 0.08) status = "REFUNDED";
        }

        // Determine if micro-charge
        const isMicroCharge = Math.random() < features.microChargeRatio;
        const amount = isMicroCharge
          ? randomInRange(0.01, 0.99)
          : randomInRange(...amountRange);

        // Determine if post-cancel
        const wasCustomerCancelled =
          Math.random() < features.firstCycleCancelRate * 0.3;

        // Run detection for this transaction
        const txDetection = evaluateMerchant(features, profile.merchantId);

        const transaction: Transaction = {
          transactionId: `txn_${uuidv4()}`,
          merchantId: profile.merchantId,
          customerId: `cust_${generateId("c")}`,
          amount: Math.round(amount * 100) / 100,
          currency: currencies[Math.floor(Math.random() * currencies.length)],
          timestamp,
          isRecurring: Math.random() < 0.7,
          planId: Math.random() < 0.7 ? `plan_${profile.merchantId}_monthly` : undefined,
          status: status as Transaction["status"],
          wasCustomerCancelled,
          decision: txDetection.decision,
          latencyMs: Math.floor(Math.random() * 300 + 50),
          triggeredRules: txDetection.triggeredRules,
        };

        await insertTransaction(transaction);
      }

      // Create alerts for medium/high risk merchants
      if (detection.riskLevel !== "LOW" && detection.triggeredRules.length > 0) {
        const hasCritical = detection.triggeredRules.some((r) =>
          ["HIGH_CHARGEBACK_RATE", "FORCED_CONTINUITY"].includes(r)
        );
        const severity = getAlertSeverity(detection.trustScore, hasCritical);

        const alert: Alert = {
          alertId: `alert_${uuidv4()}`,
          merchantId: profile.merchantId,
          createdAt: new Date(
            now.getTime() - Math.random() * 7 * 24 * 60 * 60 * 1000
          ), // Within last 7 days
          severity,
          trustScoreAtAlert: detection.trustScore,
          reasonCodes: detection.triggeredRules,
          status: Math.random() < 0.3 ? "RESOLVED" : "OPEN",
          resolvedAt:
            Math.random() < 0.3
              ? new Date(now.getTime() - Math.random() * 2 * 24 * 60 * 60 * 1000)
              : undefined,
        };

        await insertAlert(alert);
      }

      console.log(
        `Seeded merchant ${profile.name} (${detection.riskLevel} risk, score: ${detection.trustScore})`
      );
    }

    console.log("Database seeding completed successfully!");

    return NextResponse.json({
      success: true,
      message: "Database seeded successfully",
      stats: {
        merchants: merchantProfiles.length,
        ragDocuments: ragDocuments.length,
        transactionsPerMerchant: TRANSACTIONS_PER_MERCHANT,
      },
    });
  } catch (error) {
    console.error("Seeding error:", error);
    return NextResponse.json(
      { error: "Failed to seed database", details: String(error) },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: "POST to this endpoint to seed the database",
    warning: "This will create test data in your database",
  });
}
