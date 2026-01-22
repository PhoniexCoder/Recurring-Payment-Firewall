import { NextRequest, NextResponse } from "next/server";
import {
  getMerchantById,
  getLatestMerchantFeatures,
  getTransactions,
  getAlerts,
  getLatestExplanation,
} from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ merchantId: string }> }
) {
  try {
    const { merchantId } = await params;

    const [merchant, features, transactionsResult, alertsResult, explanation] =
      await Promise.all([
        getMerchantById(merchantId),
        getLatestMerchantFeatures(merchantId),
        getTransactions({ merchantId, limit: 20 }),
        getAlerts({ merchantId, status: "OPEN", limit: 10 }),
        getLatestExplanation(merchantId),
      ]);

    if (!merchant) {
      return NextResponse.json(
        { error: "Merchant not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ...merchant,
      features,
      recentTransactions: transactionsResult.transactions,
      openAlerts: alertsResult.alerts,
      latestExplanation: explanation,
    });
  } catch (error) {
    console.error("Error fetching merchant:", error);
    return NextResponse.json(
      { error: "Failed to fetch merchant" },
      { status: 500 }
    );
  }
}
