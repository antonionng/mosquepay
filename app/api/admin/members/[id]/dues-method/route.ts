// POST /api/admin/members/[id]/dues-method
// GET  /api/admin/members/[id]/dues-method
//
// Lets a lodge admin (treasurer / secretary) tag *how* a member is
// paying this year's dues:
//
//   * online_subscription - they're set up on a Mooov subscription;
//                           usually self-set when a schedule activates
//                           but admin can pre-tag.
//   * bacs                - external standing order; admin records the
//                           agreed monthly amount + optional BACS ref.
//   * paid_in_full        - paid offline in one shot (cash on the
//                           night, cheque, transfer). Flips
//                           member_dues.status -> 'paid'.
//   * fee_waived          - lodge has waived dues for the year. Flips
//                           status -> 'waived' + writes waiver_reason.
//   * null                - clears the tag (back to 'outstanding /
//                           unset').
//
// The route also exposes GET, which returns the current method state
// PLUS a copyable subscription link the admin can email to the
// member. The link is the same public dues URL we surface in the
// initiation cron template (/dues/[duesId]?email=...) so the member
// flow is identical whether the admin sends them the link or they
// reach it organically.
//
// Auth: requireAdminApiPermission("payments:write", lodgeId).
// Tenant: derived from request host (getLodgeSlugFromRequest), then
// re-checked against the member row.

import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import * as db from "@/lib/db";
import { getLodgeSlugFromRequest } from "@/lib/tenant";
import {
  requireAdminApiAuth,
  requireAdminApiPermission,
} from "@/lib/auth/api";
import { getCurrentAdminContextAny } from "@/lib/auth/permissions";
import { writeAuditLog } from "@/lib/audit";
import type {
  DuesPaymentMethod,
  MemberDues,
} from "@/lib/db/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const VALID_METHODS = new Set<DuesPaymentMethod>([
  "online_subscription",
  "bacs",
  "paid_in_full",
  "fee_waived",
]);

/**
 * Resolve the current-year (non-advance) member_dues row for a given
 * member. Treasurers care about "this year" — older years are
 * historical. We pick the row whose period overlaps the current
 * masonic year; falls back to the most recently-created
 * non-advance row when no masonic year is configured yet so the
 * panel never blanks out.
 */
async function resolveCurrentYearDues(
  lodgeId: string,
  memberEmail: string,
): Promise<MemberDues | null> {
  const allDues = await db.getMemberDues(lodgeId, { memberEmail });
  const nonAdvance = allDues.filter((d) => !d.is_advance);
  if (nonAdvance.length === 0) return null;

  const currentYear = await db.getCurrentMasonicYear(lodgeId).catch(() => null);
  if (currentYear) {
    const yearStart = currentYear.start_date.slice(0, 10);
    const yearEnd = currentYear.end_date.slice(0, 10);
    const inYear = nonAdvance.find(
      (d) =>
        d.period_start.slice(0, 10) <= yearEnd &&
        d.period_end.slice(0, 10) >= yearStart,
    );
    if (inYear) return inYear;
  }
  // Fall back to the newest non-advance row.
  return nonAdvance.sort((a, b) =>
    b.created_at.localeCompare(a.created_at),
  )[0];
}

function buildSubscriptionLink(
  request: NextRequest,
  duesId: string,
  memberEmail: string,
  lodgeSlug: string,
): string {
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ??
    `${request.nextUrl.protocol}//${request.nextUrl.host}`;
  const u = new URL(`/dues/${duesId}`, siteUrl);
  u.searchParams.set("email", memberEmail);
  if (lodgeSlug) u.searchParams.set("lodge", lodgeSlug);
  return u.toString();
}

export async function GET(request: NextRequest, { params }: Ctx) {
  const unauthorized = await requireAdminApiAuth();
  if (unauthorized) return unauthorized;

  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Database not configured." },
      { status: 503 },
    );
  }

  const lodgeSlug = getLodgeSlugFromRequest(request);
  const lodgeId = await db.resolveLodgeId(lodgeSlug);
  if (!lodgeId) {
    return NextResponse.json({ error: "Lodge not found." }, { status: 404 });
  }

  const forbidden = await requireAdminApiPermission("payments:write", lodgeId);
  if (forbidden) return forbidden;

  const { id: memberId } = await params;
  const member = await db.getMemberById(memberId, lodgeId);
  if (!member) {
    return NextResponse.json({ error: "Member not found." }, { status: 404 });
  }

  const duesRow = await resolveCurrentYearDues(lodgeId, member.email);
  const schedules = await db.getDuesSchedulesForMember(lodgeId, member.email);
  const activeSchedule = schedules.find(
    (s) =>
      s.status === "active" ||
      s.status === "active_stripe" ||
      s.status === "action_required" ||
      s.status === "past_due" ||
      s.status === "paused",
  );

  return NextResponse.json({
    member: { id: member.id, email: member.email, full_name: member.full_name },
    dues: duesRow
      ? {
          id: duesRow.id,
          amount: duesRow.amount,
          currency: duesRow.currency,
          status: duesRow.status,
          period_start: duesRow.period_start,
          period_end: duesRow.period_end,
          dues_payment_method: duesRow.dues_payment_method,
          bacs_monthly_amount: duesRow.bacs_monthly_amount,
          bacs_reference: duesRow.bacs_reference,
          payment_method_set_by: duesRow.payment_method_set_by,
          payment_method_set_at: duesRow.payment_method_set_at,
          paid_at: duesRow.paid_at,
          waiver_reason: duesRow.waiver_reason,
        }
      : null,
    subscription: activeSchedule
      ? {
          id: activeSchedule.id,
          status: activeSchedule.status,
          cadence: activeSchedule.cadence,
        }
      : null,
    subscription_link: duesRow
      ? buildSubscriptionLink(request, duesRow.id, member.email, lodgeSlug)
      : null,
  });
}

export async function POST(request: NextRequest, { params }: Ctx) {
  const unauthorized = await requireAdminApiAuth();
  if (unauthorized) return unauthorized;

  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Database not configured." },
      { status: 503 },
    );
  }

  const lodgeSlug = getLodgeSlugFromRequest(request);
  const lodgeId = await db.resolveLodgeId(lodgeSlug);
  if (!lodgeId) {
    return NextResponse.json({ error: "Lodge not found." }, { status: 404 });
  }

  const forbidden = await requireAdminApiPermission("payments:write", lodgeId);
  if (forbidden) return forbidden;

  const { id: memberId } = await params;
  const member = await db.getMemberById(memberId, lodgeId);
  if (!member) {
    return NextResponse.json({ error: "Member not found." }, { status: 404 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    method?: string | null;
    bacs_monthly_amount?: number | string | null;
    bacs_reference?: string | null;
    waiver_reason?: string | null;
    note?: string | null;
  };

  // Accept null / "" / "unset" to clear the tag.
  let method: DuesPaymentMethod | null;
  const rawMethod = typeof body.method === "string" ? body.method : null;
  if (rawMethod == null || rawMethod === "" || rawMethod === "unset") {
    method = null;
  } else if (VALID_METHODS.has(rawMethod as DuesPaymentMethod)) {
    method = rawMethod as DuesPaymentMethod;
  } else {
    return NextResponse.json(
      {
        error:
          "Unsupported method. Use one of: online_subscription, bacs, paid_in_full, fee_waived, or null.",
      },
      { status: 400 },
    );
  }

  // BACS path requires an amount we can store. We tolerate string amounts
  // ("60.00") so the form can post raw input fields without coercion.
  let bacsAmount: number | null = null;
  if (method === "bacs") {
    const raw = body.bacs_monthly_amount;
    if (raw === null || raw === undefined || raw === "") {
      return NextResponse.json(
        { error: "bacs_monthly_amount is required for BACS." },
        { status: 400 },
      );
    }
    const parsed = typeof raw === "number" ? raw : Number(raw);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return NextResponse.json(
        { error: "bacs_monthly_amount must be a non-negative number." },
        { status: 400 },
      );
    }
    bacsAmount = Math.round(parsed * 100) / 100;
  }

  if (method === "fee_waived") {
    const raw = (body.waiver_reason ?? body.note ?? "").trim();
    if (!raw) {
      return NextResponse.json(
        { error: "waiver_reason is required when waiving fees." },
        { status: 400 },
      );
    }
  }

  // Resolve which member_dues row to mutate. Prefer current masonic
  // year; fall back to most-recent non-advance.
  const duesRow = await resolveCurrentYearDues(lodgeId, member.email);
  if (!duesRow) {
    return NextResponse.json(
      {
        error:
          "No dues record exists for this member yet. Create one from the Membership Dues panel before assigning a payment method.",
        code: "no_dues_record",
      },
      { status: 409 },
    );
  }

  const adminCtx = await getCurrentAdminContextAny(lodgeId);
  const setBy = adminCtx?.email ?? "system_admin";

  let updated: MemberDues | null = null;
  try {
    if (method === null) {
      updated = await db.setMemberDuesPaymentMethod(duesRow.id, lodgeId, {
        method: null,
        setBy,
      });
    } else if (method === "online_subscription") {
      updated = await db.setMemberDuesPaymentMethod(duesRow.id, lodgeId, {
        method: "online_subscription",
        setBy,
      });
    } else if (method === "bacs") {
      updated = await db.setMemberDuesPaymentMethod(duesRow.id, lodgeId, {
        method: "bacs",
        setBy,
        bacsMonthlyAmount: bacsAmount,
        bacsReference:
          typeof body.bacs_reference === "string" && body.bacs_reference.trim()
            ? body.bacs_reference.trim().slice(0, 100)
            : null,
      });
    } else if (method === "paid_in_full") {
      updated = await db.setMemberDuesPaymentMethod(duesRow.id, lodgeId, {
        method: "paid_in_full",
        setBy,
        note:
          typeof body.note === "string" && body.note.trim()
            ? body.note.trim().slice(0, 500)
            : null,
      });
    } else {
      // fee_waived
      const reason = (body.waiver_reason ?? body.note ?? "")
        .toString()
        .trim()
        .slice(0, 500);
      updated = await db.setMemberDuesPaymentMethod(duesRow.id, lodgeId, {
        method: "fee_waived",
        setBy,
        waiverReason: reason,
      });
    }
  } catch (err) {
    console.error("admin/members/dues-method: update failed", {
      member_id: member.id,
      dues_id: duesRow.id,
      message: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: "Could not update payment method." },
      { status: 500 },
    );
  }

  if (!updated) {
    return NextResponse.json(
      { error: "Dues record not found." },
      { status: 404 },
    );
  }

  await writeAuditLog({
    lodgeId,
    action: `dues_method_${method ?? "cleared"}`,
    entityType: "dues",
    entityId: updated.id,
    summary: `Set ${member.email} dues method to ${method ?? "unset"}`,
    metadata: {
      member_id: member.id,
      method,
      bacs_monthly_amount: updated.bacs_monthly_amount,
      bacs_reference: updated.bacs_reference,
      waiver_reason: updated.waiver_reason,
      status: updated.status,
    },
  });

  // Email the member so they know what we've recorded. Skipped for
  // method=null (clearing the tag) and method=online_subscription
  // (the subscription.activated webhook already covers that case).
  if (method === "bacs" || method === "paid_in_full" || method === "fee_waived") {
    try {
      const lodge = await db.getLodgeById(lodgeId).catch(() => null);
      const currentYear = await db
        .getCurrentMasonicYear(lodgeId)
        .catch(() => null);
      const { notifyDuesMethodChanged } = await import(
        "@/lib/email/dues-notifications"
      );
      await notifyDuesMethodChanged({
        lodgeId,
        lodge,
        member: {
          id: member.id,
          email: member.email,
          full_name: member.full_name,
        },
        duesRecord: {
          id: updated.id,
          amount: updated.amount,
          currency: updated.currency,
        },
        method,
        bacsMonthlyAmount: updated.bacs_monthly_amount ?? null,
        bacsReference: updated.bacs_reference ?? null,
        waiverReason: updated.waiver_reason ?? null,
        setBy,
        yearLabel: currentYear?.label ?? null,
      });
    } catch (err) {
      console.error("admin dues-method: notification email failed", {
        member_id: member.id,
        method,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return NextResponse.json({
    dues: {
      id: updated.id,
      status: updated.status,
      dues_payment_method: updated.dues_payment_method,
      bacs_monthly_amount: updated.bacs_monthly_amount,
      bacs_reference: updated.bacs_reference,
      waiver_reason: updated.waiver_reason,
      payment_method_set_by: updated.payment_method_set_by,
      payment_method_set_at: updated.payment_method_set_at,
      paid_at: updated.paid_at,
    },
    subscription_link: buildSubscriptionLink(
      request,
      updated.id,
      member.email,
      lodgeSlug,
    ),
  });
}
