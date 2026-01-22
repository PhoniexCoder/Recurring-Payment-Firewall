import { NextRequest, NextResponse } from "next/server";
import { login, isAuthDisabled } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    // If auth is disabled, return success with mock session
    if (isAuthDisabled()) {
      return NextResponse.json({
        success: true,
        message: "Auth disabled, logged in as admin",
        email: "admin@example.com",
      });
    }

    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    const session = await login(email, password);

    return NextResponse.json({
      success: true,
      email: session.email,
    });
  } catch (error) {
    console.error("Login error:", error);
    const message = error instanceof Error ? error.message : "Login failed";
    return NextResponse.json(
      { error: message },
      { status: 401 }
    );
  }
}
