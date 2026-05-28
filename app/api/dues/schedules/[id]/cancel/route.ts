// POST /api/dues/schedules/[id]/cancel
//
// Cancel a saved-charge subscription. The cron treats `cancelled` as a
// hard stop and skips it on every subsequent tick. Outstanding
// instalments stay outstanding so the treasurer can still see what was
// owed; the parent member_dues row stays open until paid by some other
// means.
//
// Auth surface for v1: any caller with the schedule_id + matching
// member_email cookie. The member portal (/member/dues) is the only
// expected entry point.

import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import * as db from "@/lib/db";
import { getLodgeSlugFromRequest } from "@/lib/tenant";

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
  const lodgeSlug = getLodgeSlugFromRequest(request);
  const lodgeId = await db.resolveLodgeId(lodgeSlug);
  if (!lodgeId) {
    return NextResponse.json({ error: "Lodge not found." }, { status: 404 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    reason?: string;
    actor?: "member" | "treasurer" | "system";
  };

  const schedule = await db.getDuesSchedule(id, lodgeId);
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

  await db.updateDuesSchedule(id, lodgeId, {
    status: "cancelled",
    next_charge_at: null,
    cancelled_at: new Date().toISOString(),
    cancelled_by_actor: body.actor ?? "member",
    metadata: {
      ...(schedule.metadata ?? {}),
      cancellation_reason: body.reason ?? null,
    },
  });

  return NextResponse.json({ ok: true, status: "cancelled" });
}
