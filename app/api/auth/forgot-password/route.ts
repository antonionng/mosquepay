import { NextRequest, NextResponse } from "next/server";
import * as db from "@/lib/db";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import {
  sendPasswordResetByEmail,
  sendStaffPasswordReset,
} from "@/lib/auth/invites";
import { isPlatformOwnerEmail } from "@/lib/auth/platform-owner";

const GENERIC_RESPONSE = {
  success: true,
  message:
    "If an admin account exists for that email, a password reset link is on its way.",
};

/**
 * Public forgot-password endpoint for the admin sign-in flow. Returns the
 * same generic success message whether or not an account exists so we never
 * leak which emails are registered.
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
    const memberships = await db.listAdminUsersByEmail(email);
    const isOwner = isPlatformOwnerEmail(email);

    if (memberships.length === 0 && !isOwner) {
      // Don't reveal that the account is unknown.
      return NextResponse.json(GENERIC_RESPONSE);
    }

    if (memberships.length > 0) {
      // Prefer the platform-scoped row when present, so a person who is both
      // a platform admin and a tenant admin gets the platform-flavoured copy.
      const target =
        memberships.find((row) => row.church_id == null) ?? memberships[0];

      let churchName = "ChurchPay";
      if (target.church_id) {
        try {
          const church = await db.getChurchById(target.church_id);
          if (church?.name) churchName = church.name;
        } catch {
          // Non-fatal: keep the platform-level fallback name.
        }
      }

      const result = await sendStaffPasswordReset({
        request,
        staff: target,
        churchName,
      });
      if (!result.sent) {
        console.warn("[forgot-password] staff reset send failed", {
          email,
          error: result.error,
        });
      }
    } else {
      // Platform owner configured purely via env (no admin_users row).
      const result = await sendPasswordResetByEmail({
        request,
        email,
        recipientName: email,
        audience: "admin",
        churchName: "ChurchPay platform",
      });
      if (!result.sent) {
        console.warn("[forgot-password] owner reset send failed", {
          email,
          error: result.error,
        });
      }
    }
  } catch (error) {
    console.error("[forgot-password] unexpected error", { email, error });
  }

  return NextResponse.json(GENERIC_RESPONSE);
}
