import { NextResponse } from "next/server";
import { hasDummySession } from "@/lib/auth/dummy";

export async function GET() {
  const ok = await hasDummySession();
  return NextResponse.json({ authenticated: ok });
}
