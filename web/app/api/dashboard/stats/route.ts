import { NextResponse } from "next/server";
import { getTransactionStats, getOpenAlertsCount, getMerchants } from "@/lib/db";

export async function GET() {
  try {
    const [transactionStats, openAlertsCount, merchantsResult] = await Promise.all([
      getTransactionStats(),
      getOpenAlertsCount(),
      getMerchants({ limit: 1000 }), // Get all merchants for risk distribution
    ]);

    // Calculate risk distribution
    const riskDistribution = {
      LOW: 0,
      MEDIUM: 0,
      HIGH: 0,
    };

    for (const merchant of merchantsResult.merchants) {
      riskDistribution[merchant.riskLevel]++;
    }

    return NextResponse.json({
      transactions: transactionStats,
      openAlerts: openAlertsCount,
      totalMerchants: merchantsResult.total,
      riskDistribution,
    });
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch dashboard stats" },
      { status: 500 }
    );
  }
}
