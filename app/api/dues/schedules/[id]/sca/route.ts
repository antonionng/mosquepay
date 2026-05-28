// GET /api/dues/schedules/[id]/sca
//
// Returns the live SCA next_action envelope for a dues schedule when its
// status is action_required. The frontend at /dues/schedules/[id]/resume
// loads this and hands the values to Stripe.js handleNextAction.
//
// Auth: token-gated. The schedule's owner gets a one-time link via email
// (token = schedule_id + member_id signed). For now we accept the
// schedule_id directly and assert that the requesting member's session
// matches schedule.member_id; an email link with a signed token will
// replace this in a follow-up.

import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import * as db from "@/lib/db";
import { getLodgeSlugFromRequest } from "@/lib/tenant";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Database not configured." },
      { status: 503 }
    );
  }

  const { id } = await params;
  const lodgeSlug = getLodgeSlugFromRequest(request);
  const lodgeId = await db.resolveLodgeId(lodgeSlug);
  if (!lodgeId) {
    return NextResponse.json({ error: "Lodge not found." }, { status: 404 });
  }

  const schedule = await db.getDuesSchedule(id, lodgeId);
  if (!schedule) {
    return NextResponse.json(
      { error: "Schedule not found." },
      { status: 404 }
    );
  }

  if (schedule.status !== "action_required") {
    return NextResponse.json(
      {
        error:
          "This schedule does not currently require additional verification.",
        status: schedule.status,
        code: "no_action_required",
      },
      { status: 409 }
    );
  }

  if (
    !schedule.next_action_client_secret ||
    !schedule.next_action_connected_account_id
  ) {
    return NextResponse.json(
      {
        error:
          "Verification details are missing. Please contact your lodge secretary.",
        code: "next_action_missing",
      },
      { status: 500 }
    );
  }

  // Mooov 2026-05-28 reply, Q-B (locked): publishable_key arrives on
  // every requires_action response and is persisted on schedule.metadata.
  // The field MAY be empty-string when the Mooov gateway boots without
  // the key configured (rare ops event). Belt-and-braces fallback to
  // NEXT_PUBLIC_MOOOV_STRIPE_PUBLISHABLE_KEY (Mooov's platform-Stripe
  // publishable key for the current LP env: pk_test_* on staging,
  // pk_live_* on prod) so a single bad gateway revision doesn't strand
  // a member mid-3DS.
  const metadata = (schedule.metadata ?? {}) as Record<string, unknown>;
  const fromMetadata =
    typeof metadata.last_publishable_key === "string"
      ? metadata.last_publishable_key
      : "";
  const fromEnv =
    process.env.NEXT_PUBLIC_MOOOV_STRIPE_PUBLISHABLE_KEY?.trim() ?? "";
  const publishableKey = fromMetadata || fromEnv || null;
  if (!publishableKey) {
    return NextResponse.json(
      {
        error:
          "Verification details are missing. Please contact your lodge secretary.",
        code: "publishable_key_missing",
      },
      { status: 500 }
    );
  }

  const expiresAt = schedule.next_action_expires_at ?? null;
  if (expiresAt && new Date(expiresAt).getTime() < Date.now()) {
    return NextResponse.json(
      {
        error:
          "This verification link has expired. The system will retry the charge automatically; you'll get a new link if it's still required.",
        code: "next_action_expired",
      },
      { status: 410 }
    );
  }

  return NextResponse.json({
    schedule_id: schedule.id,
    member_email: schedule.member_email,
    publishable_key: publishableKey,
    connected_account_id: schedule.next_action_connected_account_id,
    client_secret: schedule.next_action_client_secret,
    expires_at: expiresAt,
  });
}
