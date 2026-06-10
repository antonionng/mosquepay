// POST /api/giving/schedules/[id]/cancel
//
// Cancel a saved-charge or open-ended giving subscription. The cron and
// the Mooov subscription webhook both treat `cancelled` as a hard
// stop. We also hard-delete any outstanding (unpaid) instalments tied
// to this schedule — the treasurer view reads from giving_schedules
// (status + cycles_paid metadata), so the unpaid rows weren't
// load-bearing, and leaving them in place breaks the next enrolment's
// pre-create with a unique-constraint violation on
// (member_giving_id, sequence).
//
// Auth surface for v1: any caller with the schedule_id + matching
// member_email cookie. The member portal (/member/giving) is the only
// expected entry point.

import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import * as db from "@/lib/db";
import { createServiceClient } from "@/lib/supabase/server";

export async function POST(
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
  const body = (await request.json().catch(() => ({}))) as {
    reason?: string;
    actor?: "member" | "treasurer" | "system";
  };

  // Resolve church from the schedule row's church_id, not URL/host/cookie.
  // Schedule UUIDs are unguessable; derive tenant from the row to avoid
  // cross-tenant 404s when the caller is on a different host than the
  // schedule's church custom domain.
  const supa = createServiceClient();
  const { data: scheduleRow } = await supa
    .from("giving_schedules")
    .select("church_id")
    .eq("id", id)
    .maybeSingle<{ church_id: string }>();
  if (!scheduleRow) {
    return NextResponse.json(
      { error: "Schedule not found." },
      { status: 404 }
    );
  }
  const churchId = scheduleRow.church_id;

  const schedule = await db.getGivingSchedule(id, churchId);
  if (!schedule) {
    return NextResponse.json(
      { error: "Schedule not found." },
      { status: 404 }
    );
  }
  if (
    schedule.status === "cancelled" ||
    schedule.status === "completed"
  ) {
    return NextResponse.json({
      ok: true,
      status: schedule.status,
      already: true,
    });
  }

  await db.updateGivingSchedule(id, churchId, {
    status: "cancelled",
    next_charge_at: null,
    cancelled_at: new Date().toISOString(),
    cancelled_by_actor: body.actor ?? "member",
    metadata: {
      ...(schedule.metadata ?? {}),
      cancellation_reason: body.reason ?? null,
    },
  });

  // Hard-delete unpaid pre-created instalments. Without this, retrying
  // the enrolment for the same member_giving row trips the unique
  // (member_giving_id, sequence) constraint and surfaces as
  // "Could not create subscription session." in /member/giving.
  const { error: deleteErr } = await supa
    .from("member_giving_instalments")
    .delete()
    .eq("schedule_id", id)
    .eq("church_id", churchId)
    .is("paid_at", null);
  if (deleteErr) {
    console.error("giving/schedules/cancel: failed to delete unpaid instalments", {
      schedule_id: id,
      code: deleteErr.code,
      message: deleteErr.message,
    });
    // Non-fatal: the schedule is still cancelled. The member can
    // contact support if they hit the unique-constraint path on retry.
  }

  return NextResponse.json({ ok: true, status: "cancelled" });
}
