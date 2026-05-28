// lib/dues/advance.ts
//
// Pure helper that resolves "next year's dues bill" for a member and
// creates the member_dues row scoped to that future masonic year if it
// does not already exist. Used by:
//   * /api/dues/pay-in-advance        (member portal, self-service)
//   * /api/admin/take-payment/advance-dues  (treasurer-driven, in-person)
//
// The two callers diverge only in auth surface and downstream payment
// recording. The dues + year resolution is identical.

import * as db from "@/lib/db";
import type { LodgeMasonicYear, Member, MemberDues } from "@/lib/db/types";
import { nextYearBounds } from "@/lib/dues/year-position";

export type AdvanceDuesGate =
  | { ok: true }
  | { ok: false; code: AdvanceDuesGateCode; message: string };

export type AdvanceDuesGateCode =
  | "no_masonic_year"
  | "no_current_year_record"
  | "current_year_outstanding";

export type AdvanceDuesResult = {
  member_dues_id: string;
  already_existed: boolean;
  next_year_id: string;
  next_year_label: string;
  next_year_start: string;
  next_year_end: string;
  base_amount: number;
  discount_percent: number;
  charged_amount: number;
  charitable_amount: number;
  currency: string;
  status: string;
  /** The pre-existing advance row when already_existed=true; null otherwise. */
  existing: MemberDues | null;
};

export type ResolveAdvanceArgs = {
  lodgeId: string;
  member: Member;
  /** Optional override; defaults to whatever the lodge_dues template +
   *  next year's annual_dues_amount work out to. Useful for the admin
   *  flow when a treasurer wants to invoice an unusual amount. */
  amountOverride?: number;
};

/**
 * Confirm the member is eligible to prepay (current year is paid or
 * waived). Used as a guard upstream so callers can return a clean
 * 409 instead of an opaque 500.
 */
export async function checkAdvanceEligibility(
  lodgeId: string,
  member: Pick<Member, "email">
): Promise<AdvanceDuesGate> {
  const currentYear = await db.getCurrentMasonicYear(lodgeId);
  if (!currentYear) {
    return {
      ok: false,
      code: "no_masonic_year",
      message:
        "Your lodge has not configured a masonic year yet. Please contact your lodge secretary.",
    };
  }
  const memberDues = await db.getMemberDues(lodgeId, {
    memberEmail: member.email,
  });
  const currentYearStart = currentYear.start_date.slice(0, 10);
  const currentYearEnd = currentYear.end_date.slice(0, 10);
  const currentYearDues = memberDues.find(
    (d) =>
      !d.is_advance &&
      d.period_start.slice(0, 10) <= currentYearEnd &&
      d.period_end.slice(0, 10) >= currentYearStart
  );
  if (!currentYearDues) {
    return {
      ok: false,
      code: "no_current_year_record",
      message:
        "Current-year dues record is missing. Please contact your lodge secretary.",
    };
  }
  if (
    currentYearDues.status !== "paid" &&
    currentYearDues.status !== "waived"
  ) {
    return {
      ok: false,
      code: "current_year_outstanding",
      message:
        "Pay current-year dues before paying in advance for next year.",
    };
  }
  return { ok: true };
}

/**
 * Resolve next year + create the advance member_dues row if absent.
 * Idempotent: re-runs return the existing advance row.
 *
 * Caller is responsible for the actual payment (cash recording, hosted
 * Checkout mint, etc.). This helper only owns the dues+year resolution.
 */
export async function resolveOrCreateAdvanceDues(
  args: ResolveAdvanceArgs
): Promise<AdvanceDuesResult> {
  const { lodgeId, member } = args;

  const currentYear = await db.getCurrentMasonicYear(lodgeId);
  if (!currentYear) {
    throw new Error("Lodge has no current masonic year configured.");
  }
  const currentYearEnd = currentYear.end_date.slice(0, 10);
  const currentYearStart = currentYear.start_date.slice(0, 10);

  const allYears = await db.listLodgeMasonicYears(lodgeId);
  let next: LodgeMasonicYear | null =
    allYears.find((y) => y.start_date.slice(0, 10) > currentYearEnd) ?? null;

  let nextYearId: string;
  let nextYearStart: string;
  let nextYearEnd: string;
  let nextYearLabel: string;

  if (next) {
    nextYearId = next.id;
    nextYearStart = next.start_date.slice(0, 10);
    nextYearEnd = next.end_date.slice(0, 10);
    nextYearLabel = next.label;
  } else {
    const bounds = nextYearBounds(currentYearStart, currentYearEnd);
    const created = await db.upsertLodgeMasonicYear(lodgeId, {
      label: bounds.label,
      start_date: bounds.startDate,
      end_date: bounds.endDate,
      annual_dues_amount: currentYear.annual_dues_amount,
      is_current: false,
    });
    next = created;
    nextYearId = created.id;
    nextYearStart = bounds.startDate;
    nextYearEnd = bounds.endDate;
    nextYearLabel = bounds.label;
  }

  const memberDues = await db.getMemberDues(lodgeId, {
    memberEmail: member.email,
  });
  const existing =
    memberDues.find(
      (d) => d.is_advance && d.advance_for_year_id === nextYearId
    ) ?? null;

  const lodgeDues = (await db.getLodgeDues(lodgeId))[0] ?? null;
  const baseAmount =
    next?.annual_dues_amount ??
    lodgeDues?.amount ??
    currentYear.annual_dues_amount ??
    0;
  if (!baseAmount || baseAmount <= 0) {
    throw new Error("No annual dues amount configured for next year.");
  }
  const discountPct = lodgeDues?.advance_discount_percent ?? 0;
  const computedCharge =
    Math.round(baseAmount * (1 - discountPct / 100) * 100) / 100;
  const chargedAmount =
    typeof args.amountOverride === "number" && args.amountOverride > 0
      ? Math.round(args.amountOverride * 100) / 100
      : computedCharge;
  const charitableAmount =
    lodgeDues?.gift_aid_enabled === true
      ? Math.min(lodgeDues.charitable_amount ?? 0, chargedAmount)
      : 0;
  const currency = (
    existing?.currency ??
    lodgeDues?.currency ??
    "gbp"
  ).toLowerCase();

  if (existing) {
    return {
      member_dues_id: existing.id,
      already_existed: true,
      next_year_id: nextYearId,
      next_year_label: nextYearLabel,
      next_year_start: nextYearStart,
      next_year_end: nextYearEnd,
      base_amount: baseAmount,
      discount_percent: discountPct,
      charged_amount: existing.amount,
      charitable_amount: existing.charitable_amount ?? 0,
      currency: existing.currency,
      status: existing.status,
      existing,
    };
  }

  const advanceRecord = await db.createMemberDues(lodgeId, {
    member_email: member.email,
    member_name: member.full_name,
    member_id: member.id,
    dues_id: lodgeDues?.id ?? null,
    amount: chargedAmount,
    currency,
    period_start: nextYearStart,
    period_end: nextYearEnd,
    status: "outstanding",
    payment_id: null,
    stripe_payment_intent_id: null,
    stripe_subscription_id: null,
    paid_at: null,
    charitable_amount: charitableAmount,
    gift_aid_status:
      lodgeDues?.gift_aid_enabled && charitableAmount > 0
        ? "eligible"
        : "unknown",
    gift_aid_eligible_amount: charitableAmount,
    full_year_amount: baseAmount,
    is_advance: true,
    advance_for_year_id: nextYearId,
  } as Parameters<typeof db.createMemberDues>[1]);

  return {
    member_dues_id: advanceRecord.id,
    already_existed: false,
    next_year_id: nextYearId,
    next_year_label: nextYearLabel,
    next_year_start: nextYearStart,
    next_year_end: nextYearEnd,
    base_amount: baseAmount,
    discount_percent: discountPct,
    charged_amount: chargedAmount,
    charitable_amount: charitableAmount,
    currency: advanceRecord.currency,
    status: advanceRecord.status,
    existing: null,
  };
}
