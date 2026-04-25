import { NextResponse } from "next/server";
import { clearDummySession } from "@/lib/auth/dummy";

export async function POST() {
  await clearDummySession();
  return NextResponse.json({ success: true });
}
