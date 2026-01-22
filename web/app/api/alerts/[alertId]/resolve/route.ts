import { NextRequest, NextResponse } from "next/server";
import { resolveAlert, getAlertById } from "@/lib/db";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ alertId: string }> }
) {
  try {
    const { alertId } = await params;

    // Check if alert exists
    const alert = await getAlertById(alertId);
    if (!alert) {
      return NextResponse.json(
        { error: "Alert not found" },
        { status: 404 }
      );
    }

    // Resolve the alert
    await resolveAlert(alertId);

    return NextResponse.json({
      success: true,
      alertId,
      status: "RESOLVED",
      resolvedAt: new Date(),
    });
  } catch (error) {
    console.error("Error resolving alert:", error);
    return NextResponse.json(
      { error: "Failed to resolve alert" },
      { status: 500 }
    );
  }
}
