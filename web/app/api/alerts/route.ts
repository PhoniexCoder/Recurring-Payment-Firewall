import { NextRequest, NextResponse } from "next/server";
import { getAlerts, getOpenAlertsCount } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "20", 10);
    const status = searchParams.get("status") || undefined;
    const severity = searchParams.get("severity") || undefined;
    const merchantId = searchParams.get("merchantId") || undefined;
    const includeCount = searchParams.get("includeCount") === "true";

    const { alerts, total } = await getAlerts({
      page,
      limit,
      status,
      severity,
      merchantId,
    });

    const response: Record<string, unknown> = {
      data: alerts,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };

    if (includeCount) {
      const openCount = await getOpenAlertsCount();
      response.openCount = openCount;
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error fetching alerts:", error);
    return NextResponse.json(
      { error: "Failed to fetch alerts" },
      { status: 500 }
    );
  }
}
