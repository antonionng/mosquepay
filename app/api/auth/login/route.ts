import { NextRequest, NextResponse } from "next/server";
import { setDummySession, validateDummyCredentials } from "@/lib/auth/dummy";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = body.email?.trim();
    const password = body.password;

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required." },
        { status: 400 }
      );
    }

    if (!validateDummyCredentials(email, password)) {
      return NextResponse.json(
        { error: "Invalid email or password." },
        { status: 401 }
      );
    }

    await setDummySession();
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Login error:", e);
    return NextResponse.json(
      { error: "Something went wrong." },
      { status: 500 }
    );
  }
}
