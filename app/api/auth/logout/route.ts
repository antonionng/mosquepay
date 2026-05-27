import { NextResponse } from "next/server";
import { clearDummySession } from "@/lib/auth/dummy";
import { STAFF_ADMIN_COOKIE } from "@/lib/auth/staff-cookie";
import { createClient } from "@/lib/supabase/server";
import { ADMIN_LODGE_COOKIE } from "@/lib/tenant";

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
  // Clear the lodge cookie too so the next user who signs in on this device
  // doesn't inherit the previous admin's lodge selection. This is the most
  // common way ADMIN_LODGE_COOKIE drifts away from the actor's actual lodge.
  response.cookies.delete(ADMIN_LODGE_COOKIE);
  return response;
}
