import { NextRequest, NextResponse } from "next/server";
import { getMerchants } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "20", 10);
    const riskLevel = searchParams.get("riskLevel") || undefined;
    const search = searchParams.get("search") || undefined;

    const { merchants, total } = await getMerchants({
      page,
      limit,
      riskLevel,
      search,
    });

    return NextResponse.json({
      data: merchants,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Error fetching merchants:", error);
    return NextResponse.json(
      { error: "Failed to fetch merchants" },
      { status: 500 }
    );
  }
}
