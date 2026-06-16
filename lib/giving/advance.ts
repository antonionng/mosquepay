// lib/giving/advance.ts
//
// Pure helper that resolves "next year's giving bill" for a member and
// creates the member_giving row scoped to that future giving year if it
// does not already exist. Used by:
//   * /api/giving/pay-in-advance        (member portal, self-service)
//   * /api/admin/take-payment/advance-giving  (treasurer-driven, in-person)
//
// The two callers diverge only in auth surface and downstream payment
// recording. The giving + year resolution is identical.

import * as db from "@/lib/db";
import type { MosqueGivingYear, Member, MemberGiving } from "@/lib/db/types";
import { nextYearBounds } from "@/lib/giving/year-position";

export type AdvanceGivingGate =
  | { ok: true }
  | { ok: false; code: AdvanceGivingGateCode; message: string };

export type AdvanceGivingGateCode =
  | "no_giving_year"
  | "no_current_year_record"
  | "current_year_outstanding";

export type AdvanceGivingResult = {
  member_giving_id: string;
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
  existing: MemberGiving | null;
};

export type ResolveAdvanceArgs = {
  mosqueId: string;
  member: Member;
  /** Optional override; defaults to whatever the mosque_giving template +
   *  next year's annual_giving_amount work out to. Useful for the admin
   *  flow when a treasurer wants to invoice an unusual amount. */
  amountOverride?: number;
};

/**
 * Confirm the member is eligible to prepay (current year is paid or
 * waived). Used as a guard upstream so callers can return a clean
 * 409 instead of an opaque 500.
 */
export async function checkAdvanceEligibility(
  mosqueId: string,
  member: Pick<Member, "email">
): Promise<AdvanceGivingGate> {
  const currentYear = await db.getCurrentMosqueYear(mosqueId);
  if (!currentYear) {
    return {
      ok: false,
      code: "no_giving_year",
      message:
        "Your mosque has not configured a giving year yet. Please contact your mosque secretary.",
    };
  }
  const memberGiving = await db.getMemberGiving(mosqueId, {
    memberEmail: member.email,
  });
  const currentYearStart = currentYear.start_date.slice(0, 10);
  const currentYearEnd = currentYear.end_date.slice(0, 10);
  const currentYearGiving = memberGiving.find(
    (d) =>
      !d.is_advance &&
      d.period_start.slice(0, 10) <= currentYearEnd &&
      d.period_end.slice(0, 10) >= currentYearStart
  );
  if (!currentYearGiving) {
    return {
      ok: false,
      code: "no_current_year_record",
      message:
        "Current-year giving record is missing. Please contact your mosque secretary.",
    };
  }
  if (
    currentYearGiving.status !== "paid" &&
    currentYearGiving.status !== "waived"
  ) {
    return {
      ok: false,
      code: "current_year_outstanding",
      message:
        "Pay current-year giving before paying in advance for next year.",
    };
  }
  return { ok: true };
}

/**
 * Resolve next year + create the advance member_giving row if absent.
 * Idempotent: re-runs return the existing advance row.
 *
 * Caller is responsible for the actual payment (cash recording, hosted
 * Checkout mint, etc.). This helper only owns the giving+year resolution.
 */
export async function resolveOrCreateAdvanceGiving(
  args: ResolveAdvanceArgs
): Promise<AdvanceGivingResult> {
  const { mosqueId, member } = args;

  const currentYear = await db.getCurrentMosqueYear(mosqueId);
  if (!currentYear) {
    throw new Error("Mosque has no current giving year configured.");
  }
  const currentYearEnd = currentYear.end_date.slice(0, 10);
  const currentYearStart = currentYear.start_date.slice(0, 10);

  const allYears = await db.listMosqueGivingYears(mosqueId);
  let next: MosqueGivingYear | null =
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
    const created = await db.upsertMosqueGivingYear(mosqueId, {
      label: bounds.label,
      start_date: bounds.startDate,
      end_date: bounds.endDate,
      annual_giving_amount: currentYear.annual_giving_amount,
      is_current: false,
    });
    next = created;
    nextYearId = created.id;
    nextYearStart = bounds.startDate;
    nextYearEnd = bounds.endDate;
    nextYearLabel = bounds.label;
  }

  const memberGiving = await db.getMemberGiving(mosqueId, {
    memberEmail: member.email,
  });
  const existing =
    memberGiving.find(
      (d) => d.is_advance && d.advance_for_year_id === nextYearId
    ) ?? null;

  const mosqueGiving = (await db.getMosqueGiving(mosqueId))[0] ?? null;
  const baseAmount =
    next?.annual_giving_amount ??
    mosqueGiving?.amount ??
    currentYear.annual_giving_amount ??
    0;
  if (!baseAmount || baseAmount <= 0) {
    throw new Error("No annual giving amount configured for next year.");
  }
  const discountPct = mosqueGiving?.advance_discount_percent ?? 0;
  const computedCharge =
    Math.round(baseAmount * (1 - discountPct / 100) * 100) / 100;
  const chargedAmount =
    typeof args.amountOverride === "number" && args.amountOverride > 0
      ? Math.round(args.amountOverride * 100) / 100
      : computedCharge;
  const charitableAmount =
    mosqueGiving?.gift_aid_enabled === true
      ? Math.min(mosqueGiving.charitable_amount ?? 0, chargedAmount)
      : 0;
  const currency = (
    existing?.currency ??
    mosqueGiving?.currency ??
    "gbp"
  ).toLowerCase();

  if (existing) {
    return {
      member_giving_id: existing.id,
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

  const advanceRecord = await db.createMemberGiving(mosqueId, {
    member_email: member.email,
    member_name: member.full_name,
    member_id: member.id,
    giving_id: mosqueGiving?.id ?? null,
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
      mosqueGiving?.gift_aid_enabled && charitableAmount > 0
        ? "eligible"
        : "unknown",
    gift_aid_eligible_amount: charitableAmount,
    full_year_amount: baseAmount,
    is_advance: true,
    advance_for_year_id: nextYearId,
  } as Parameters<typeof db.createMemberGiving>[1]);

  return {
    member_giving_id: advanceRecord.id,
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
