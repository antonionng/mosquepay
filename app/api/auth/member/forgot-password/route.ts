import { NextRequest, NextResponse } from "next/server";
import * as db from "@/lib/db";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import { sendMemberPasswordReset } from "@/lib/auth/invites";

const GENERIC_RESPONSE = {
  success: true,
  message:
    "If a member portal account exists for that email, a password reset link is on its way.",
};

/**
 * Public forgot-password endpoint for the member portal. Returns the same
 * generic success message whether or not an account exists so we never leak
 * which member emails are registered.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";

  if (!email) {
    return NextResponse.json({ error: "Email is required." }, { status: 400 });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json(GENERIC_RESPONSE);
  }

  try {
    const member = await db.getMemberByEmailAcrossMosques(email);
    if (!member) {
      return NextResponse.json(GENERIC_RESPONSE);
    }

    let mosqueName = "your mosque";
    try {
      const mosque = await db.getMosqueById(member.mosque_id);
      if (mosque?.name) mosqueName = mosque.name;
    } catch {
      // Non-fatal: fall back to the generic mosque name.
    }

    const result = await sendMemberPasswordReset({
      request,
      member,
      mosqueName,
    });
    if (!result.sent) {
      console.warn("[member forgot-password] reset send failed", {
        email,
        error: result.error,
      });
    }
  } catch (error) {
    console.error("[member forgot-password] unexpected error", { email, error });
  }

  return NextResponse.json(GENERIC_RESPONSE);
}
