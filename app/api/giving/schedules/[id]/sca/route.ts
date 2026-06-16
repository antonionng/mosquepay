// GET /api/giving/schedules/[id]/sca
//
// Returns the live SCA next_action envelope for a giving schedule when its
// status is action_required. The frontend at /giving/schedules/[id]/resume
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
import { createServiceClient } from "@/lib/supabase/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Database not configured." },
      { status: 503 }
    );
  }

  const { id } = await params;

  // Resolve mosque from the schedule row, not URL/host/cookie. See note
  // in /api/giving/schedules/[id]/cancel for rationale.
  const supa = createServiceClient();
  const { data: scheduleRow } = await supa
    .from("giving_schedules")
    .select("mosque_id")
    .eq("id", id)
    .maybeSingle<{ mosque_id: string }>();
  if (!scheduleRow) {
    return NextResponse.json(
      { error: "Schedule not found." },
      { status: 404 }
    );
  }
  const mosqueId = scheduleRow.mosque_id;

  const schedule = await db.getGivingSchedule(id, mosqueId);
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
          "Verification details are missing. Please contact your mosque secretary.",
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
          "Verification details are missing. Please contact your mosque secretary.",
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
