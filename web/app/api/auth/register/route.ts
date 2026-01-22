import { NextRequest, NextResponse } from "next/server";
import { createUser, login, isAuthDisabled } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    // If auth is disabled, return success
    if (isAuthDisabled()) {
      return NextResponse.json({
        success: true,
        message: "Auth disabled, registration not needed",
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

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    // Create user
    await createUser(email, password);

    // Log them in
    const session = await login(email, password);

    return NextResponse.json({
      success: true,
      email: session.email,
    });
  } catch (error) {
    console.error("Registration error:", error);
    const message = error instanceof Error ? error.message : "Registration failed";
    return NextResponse.json(
      { error: message },
      { status: 400 }
    );
  }
}
