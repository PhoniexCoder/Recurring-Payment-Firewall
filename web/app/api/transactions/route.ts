import { NextRequest, NextResponse } from "next/server";
import { getTransactions, getTransactionStats } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "20", 10);
    const merchantId = searchParams.get("merchantId") || undefined;
    const decision = searchParams.get("decision") || undefined;
    const includeStats = searchParams.get("includeStats") === "true";

    const { transactions, total } = await getTransactions({
      page,
      limit,
      merchantId,
      decision,
    });

    const response: Record<string, unknown> = {
      data: transactions,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };

    if (includeStats) {
      const stats = await getTransactionStats();
      response.stats = stats;
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error fetching transactions:", error);
    return NextResponse.json(
      { error: "Failed to fetch transactions" },
      { status: 500 }
    );
  }
}
