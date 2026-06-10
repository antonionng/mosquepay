// GET /api/admin/giving/schedules
//
// Treasurer-facing list of giving_schedules for the active church. Used by:
//   * /admin/giving/schedules (full list view)
//   * /admin/treasurer (count card)
//
// Query params:
//   * status   - GivingScheduleStatus or comma-separated list. Optional.
//                Special value "needs_attention" = action_required,past_due,paused.
//   * email    - case-insensitive substring match on member_email.
//                Optional.
//   * include_counts - "1" to also return aggregate counts by status.
//                      Used by /admin/treasurer.
//   * limit    - max 500, default 200.

import { NextRequest, NextResponse } from "next/server";
import { requireAdminApiAuth, requireAdminApiPermission } from "@/lib/auth/api";
import { getAdminReadContext } from "@/lib/admin/read-context";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import * as db from "@/lib/db";
import type { GivingScheduleStatus } from "@/lib/db/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_STATUSES: GivingScheduleStatus[] = [
  "pending",
  "active",
  "action_required",
  "past_due",
  "paused",
  "cancelled",
  "completed",
  "active_stripe",
];

const NEEDS_ATTENTION: GivingScheduleStatus[] = [
  "action_required",
  "past_due",
  "paused",
];

export async function GET(request: NextRequest) {
  const unauthorized = await requireAdminApiAuth();
  if (unauthorized) return unauthorized;

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ schedules: [], counts: null });
  }

  const ctx = await getAdminReadContext();
  if (ctx.mode !== "database" || !ctx.churchId) {
    return NextResponse.json({ schedules: [], counts: null });
  }
  const churchId = ctx.churchId;

  const forbidden = await requireAdminApiPermission("payments:write", churchId);
  if (forbidden) return forbidden;

  const url = new URL(request.url);
  const statusParam = url.searchParams.get("status");
  const email = url.searchParams.get("email")?.trim() || undefined;
  const includeCounts = url.searchParams.get("include_counts") === "1";
  const limitParam = Number(url.searchParams.get("limit") ?? "200");
  const limit = Number.isFinite(limitParam)
    ? Math.max(1, Math.min(500, limitParam))
    : 200;

  let statusFilter: GivingScheduleStatus[] | undefined;
  if (statusParam) {
    if (statusParam === "needs_attention") {
      statusFilter = NEEDS_ATTENTION;
    } else {
      const requested = statusParam
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean) as GivingScheduleStatus[];
      const valid = requested.filter((s) =>
        (VALID_STATUSES as string[]).includes(s)
      );
      if (valid.length === 0) {
        return NextResponse.json(
          { error: `Invalid status. Allowed: ${VALID_STATUSES.join(", ")}` },
          { status: 400 }
        );
      }
      statusFilter = valid;
    }
  }

  const [schedules, counts] = await Promise.all([
    db.listGivingSchedules(churchId, {
      status: statusFilter,
      memberEmail: email,
      limit,
    }),
    includeCounts
      ? db.countGivingSchedulesByStatus(churchId)
      : Promise.resolve(null),
  ]);

  return NextResponse.json({
    schedules,
    counts,
  });
}
