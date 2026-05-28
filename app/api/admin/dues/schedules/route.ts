// GET /api/admin/dues/schedules
//
// Treasurer-facing list of dues_schedules for the active lodge. Used by:
//   * /admin/dues/schedules (full list view)
//   * /admin/treasurer (count card)
//
// Query params:
//   * status   - DuesScheduleStatus or comma-separated list. Optional.
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
import type { DuesScheduleStatus } from "@/lib/db/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_STATUSES: DuesScheduleStatus[] = [
  "pending",
  "active",
  "action_required",
  "past_due",
  "paused",
  "cancelled",
  "completed",
  "active_stripe",
];

const NEEDS_ATTENTION: DuesScheduleStatus[] = [
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
  if (ctx.mode !== "database" || !ctx.lodgeId) {
    return NextResponse.json({ schedules: [], counts: null });
  }
  const lodgeId = ctx.lodgeId;

  const forbidden = await requireAdminApiPermission("payments:write", lodgeId);
  if (forbidden) return forbidden;

  const url = new URL(request.url);
  const statusParam = url.searchParams.get("status");
  const email = url.searchParams.get("email")?.trim() || undefined;
  const includeCounts = url.searchParams.get("include_counts") === "1";
  const limitParam = Number(url.searchParams.get("limit") ?? "200");
  const limit = Number.isFinite(limitParam)
    ? Math.max(1, Math.min(500, limitParam))
    : 200;

  let statusFilter: DuesScheduleStatus[] | undefined;
  if (statusParam) {
    if (statusParam === "needs_attention") {
      statusFilter = NEEDS_ATTENTION;
    } else {
      const requested = statusParam
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean) as DuesScheduleStatus[];
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
    db.listDuesSchedules(lodgeId, {
      status: statusFilter,
      memberEmail: email,
      limit,
    }),
    includeCounts
      ? db.countDuesSchedulesByStatus(lodgeId)
      : Promise.resolve(null),
  ]);

  return NextResponse.json({
    schedules,
    counts,
  });
}
