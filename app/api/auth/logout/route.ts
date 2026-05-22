import { NextResponse } from "next/server";
import { clearDummySession } from "@/lib/auth/dummy";
import { STAFF_ADMIN_COOKIE } from "@/lib/auth/staff-cookie";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  await clearDummySession();
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
  } catch {
    /* Supabase may not be configured in local mock mode. */
  }
  const response = NextResponse.json({ success: true });
  response.cookies.delete(STAFF_ADMIN_COOKIE);
  return response;
}
