// lib/giving/enrolment-plan.ts
//
// Pure orchestrator that resolves everything needed to show OR start a
// saved-charge giving subscription enrolment for a single member-giving row:
// merchant, member, church giving template, current giving year, year
// position, default strategy, and the per-cycle instalment plan.
//
// Same code path used by:
//
//   * POST /api/giving/subscription-preview
//       Returns the plan to the member portal so the "Set up instalments"
//       confirmation dialog can show a real schedule (cycles, amounts,
//       dates, total) BEFORE redirecting the member to Mooov hosted
//       Checkout. The Mooov/Stripe surface only knows about cycle 1 +
//       saved-card setup, so all multi-cycle UX has to live in LP.
//
//   * POST /api/giving/pay (mode: "subscription")
//       Calls this helper, then writes the plan into giving_schedules +
//       member_giving_instalments and posts the enrolment intent to
//       Mooov. Pulled out so preview and pay can never disagree.
//
// Side-effect free: this function reads database rows but never writes.
// The giving_schedules row, instalment rows, and Mooov payment_attempt
// row are written by the caller (lib/giving/pay/route.ts) only on the
// real-charge path.

import * as db from "@/lib/db";
import { createServiceClient } from "@/lib/supabase/server";
import { computeYearPosition, type YearPosition } from "@/lib/giving/year-position";
import {
  buildSchedule,
  isStrategyEnabledForChurch,
  type GivingCadence,
} from "@/lib/giving/strategies";
import type {
  GivingSplitStrategy,
  ChurchGiving,
  ChurchGivingYear,
  Member,
  MemberGiving,
} from "@/lib/db/types";

export type EnrolmentPlanArgs = {
  churchId: string;
  givingRecord: MemberGiving;
  memberEmail: string;
  /** Caller-chosen strategy. Falls back to the year-position default. */
  strategy?: GivingSplitStrategy;
  /** Caller-chosen auto-renew. Falls back to the church default. */
  autoRenew?: boolean;
  /**
   * Caller-chosen cadence (monthly / quarterly). Falls back to the
   * church giving template's instalment_frequency. The giving page surfaces
   * any cadence options the church has enabled so the member can pick.
   */
  cadence?: GivingCadence;
};

/**
 * Which Mooov surface this enrolment should use.
 *
 * - `open_ended_subscription`: every cycle is the same amount AND the
 *   member opted in to auto-renew. Maps to POST /v1/subscription_checkouts
 *   (Stripe Subscription pass-through, fully Mooov-branded checkout at
 *   pay.mooov.money). Mooov drives renewals, so we don't need our cron
 *   for this schedule.
 *
 * - `saved_charge_fixed_term`: cycles vary in amount (catch-up lump,
 *   balloon) OR auto-renew is off (one-shot fixed-term plan). Stays on
 *   the embedded payment-intent + saved-charge flow we already run via
 *   /v1/payment_intents + lib/mooov-charges.ts. Mooov 2026-06-01 reply:
 *   "keep your existing embedded payment-intent + saved-charge flow for
 *   fixed-term installment plans".
 */
export type GivingMooovFlow =
  | "open_ended_subscription"
  | "saved_charge_fixed_term";

export type EnrolmentPlan = {
  merchantId: string;
  member: Member;
  churchGiving: ChurchGiving;
  churchYear: ChurchGivingYear;
  yearPosition: YearPosition;
  /** Strategy actually used (after church enable + cap checks). */
  strategy: GivingSplitStrategy;
  autoRenew: boolean;
  cadence: GivingCadence;
  /**
   * All cadences enabled by the church for this giving template, in the
   * order we want to surface them in the UI. Drives the cadence picker
   * on /member/giving. If the template only allows one cadence, this is
   * a single-element array.
   */
  cadenceOptions: GivingCadence[];
  customerRef: string;
  /** Schedule rows. cycle 1 is collected today by the enrolment intent. */
  schedule: ReturnType<typeof buildSchedule>;
  annualAmount: number;
  currency: string;
  /** Which Mooov surface to use for this enrolment. See GivingMooovFlow. */
  mooovFlow: GivingMooovFlow;
  /**
   * Per-cycle amount for an open-ended Stripe Subscription, in major units
   * (£). Always equal to schedule.firstCycleAmount when set, but kept
   * separate so callers can pass it directly to /v1/subscription_checkouts
   * without re-deriving. Null on saved_charge_fixed_term.
   *
   * Despite the historical name (the v1 release only supported monthly),
   * this is the "per-cycle" amount and is interpreted in conjunction
   * with subscriptionIntervalCount below.
   */
  monthlyAmount: number | null;
  /**
   * Stripe Subscription interval to hand to Mooov's
   * /v1/subscription_checkouts. We always pass "month"; the cadence is
   * encoded in interval_count (1 = monthly, 3 = quarterly). Null on
   * saved_charge_fixed_term.
   */
  subscriptionInterval: "month" | null;
  subscriptionIntervalCount: number | null;
};

export type EnrolmentPlanError = {
  code:
    | "church_not_connected"
    | "member_not_found"
    | "instalments_not_enabled"
    | "no_giving_year"
    | "catch_up_exceeds_cap"
    | "schedule_build_failed"
    | "internal";
  message: string;
  /** Suggested HTTP status for caller to surface. */
  status: number;
  /** Extra details (e.g. catch_up_max_months) for callers that want to render them. */
  details?: Record<string, unknown>;
};

export type EnrolmentPlanResult =
  | { ok: true; plan: EnrolmentPlan }
  | { ok: false; error: EnrolmentPlanError };

export async function computeEnrolmentPlan(
  args: EnrolmentPlanArgs,
): Promise<EnrolmentPlanResult> {
  const { churchId, givingRecord, memberEmail } = args;

  let supa: ReturnType<typeof createServiceClient>;
  try {
    supa = createServiceClient();
  } catch {
    return {
      ok: false,
      error: {
        code: "internal",
        message: "Payments are not configured.",
        status: 503,
      },
    };
  }

  // 1. Resolve merchant.
  const { data: merchantRow } = await supa
    .schema("mooov")
    .from("churches")
    .select("merchant_id, status")
    .eq("id", churchId)
    .maybeSingle<{ merchant_id: string; status: string }>();

  if (
    !merchantRow ||
    !merchantRow.merchant_id ||
    (merchantRow.status && merchantRow.status !== "active")
  ) {
    return {
      ok: false,
      error: {
        code: "church_not_connected",
        message:
          "This church has not finished setting up online payments yet. Please contact the church directly.",
        status: 503,
      },
    };
  }
  const merchantId = merchantRow.merchant_id;

  // 2. Resolve member. Prefer FK on the giving row, fall back to (email, churchId).
  const member =
    givingRecord.member_id != null
      ? await db
          .getMemberById(givingRecord.member_id, churchId)
          .catch(() => null)
      : await db.getMemberByEmail(memberEmail, churchId).catch(() => null);

  if (!member) {
    return {
      ok: false,
      error: {
        code: "member_not_found",
        message:
          "Could not resolve your member profile. Please contact your church secretary.",
        status: 404,
      },
    };
  }
  const customerRef = `mbr_${member.id}`;

  // 3. Resolve the church giving template that this member_giving row was
  // created from. A church can have several active templates (e.g.
  // "Annual Subscription" + "Festival Contribution"); givingRecord.giving_id
  // points at the specific template to use. Picking churchGivingList[0]
  // would silently apply the wrong template's cadence + amount, which
  // is exactly the bug that drove the "60 quarterly vs 24 monthly"
  // discrepancy on St Mary's Church.
  const churchGivingList = await db.getChurchGiving(churchId);
  const givingTemplate =
    churchGivingList.find((row) => row.id === givingRecord.giving_id) ??
    churchGivingList[0] ??
    null;
  if (!givingTemplate || givingTemplate.allow_instalments !== true) {
    return {
      ok: false,
      error: {
        code: "instalments_not_enabled",
        message: "Monthly subscriptions are not enabled for this church.",
        status: 409,
      },
    };
  }

  // 4. Resolve giving year + year position.
  const currentYear = await db.getCurrentChurchYear(churchId);
  if (!currentYear) {
    return {
      ok: false,
      error: {
        code: "no_giving_year",
        message:
          "Your church has not configured a giving year yet. Please contact your church secretary.",
        status: 409,
      },
    };
  }

  const memberGivingList = await db.getMemberGiving(churchId, { memberEmail });
  const paidThisYear = memberGivingList.some(
    (d) =>
      !d.is_advance &&
      d.status === "paid" &&
      d.period_start.slice(0, 10) <= currentYear.end_date.slice(0, 10) &&
      d.period_end.slice(0, 10) >= currentYear.start_date.slice(0, 10),
  );

  const yearPosition = computeYearPosition({
    yearStartDate: currentYear.start_date,
    yearEndDate: currentYear.end_date,
    dateOfInitiation: member.date_of_membership ?? null,
    hasPaidCurrentYear: paidThisYear,
    hasOutstandingCurrentYear: !paidThisYear,
  });

  // 5. Pick the strategy. Caller > default, but always honour church config.
  const defaultStrategy: GivingSplitStrategy =
    yearPosition.quadrant === "pre_year" ||
    yearPosition.quadrant === "at_year_start"
      ? "even_full_year"
      : yearPosition.quadrant === "mid_year_new_initiate"
        ? "pro_rata"
        : "reslice_remaining";

  let strategy: GivingSplitStrategy = args.strategy ?? defaultStrategy;
  if (!isStrategyEnabledForChurch(strategy, givingTemplate)) {
    strategy = defaultStrategy;
  }
  if (
    strategy === "catch_up_lump_then_monthly" &&
    yearPosition.monthsElapsed > givingTemplate.catch_up_max_months
  ) {
    return {
      ok: false,
      error: {
        code: "catch_up_exceeds_cap",
        message: `You're more than ${givingTemplate.catch_up_max_months} months into the year. Please speak to your treasurer to set up a tailored payment plan.`,
        status: 409,
        details: { catch_up_max_months: givingTemplate.catch_up_max_months },
      },
    };
  }

  // 5b. Pick cadence. The church template's instalment_frequency is the
  // default; the member can override via the giving page picker, but only
  // among cadences the church has enabled. v1 keeps the option set simple
  // (monthly + quarterly) — the only two values instalment_frequency
  // takes today.
  const templateCadence: GivingCadence =
    givingTemplate.instalment_frequency === "quarterly" ? "quarterly" : "monthly";
  const cadenceOptions: GivingCadence[] =
    templateCadence === "quarterly"
      ? ["quarterly", "monthly"]
      : ["monthly", "quarterly"];
  const cadence: GivingCadence = args.cadence
    ? cadenceOptions.includes(args.cadence)
      ? args.cadence
      : templateCadence
    : templateCadence;

  // 6. Build the per-cycle plan.
  const annualAmount = givingRecord.full_year_amount ?? givingRecord.amount;
  const today = new Date().toISOString().slice(0, 10);
  const schedule = buildSchedule({
    annualAmount,
    today,
    yearStartDate: currentYear.start_date,
    yearEndDate: currentYear.end_date,
    monthsElapsed: yearPosition.monthsElapsed,
    monthsRemaining: yearPosition.monthsRemaining,
    monthsTotal: yearPosition.monthsTotal,
    strategy,
    cadence,
  });

  if (schedule.cycleCount === 0 || schedule.firstCycleAmount <= 0) {
    return {
      ok: false,
      error: {
        code: "schedule_build_failed",
        message:
          "Could not work out a payment schedule for the current year. Please contact your church secretary.",
        status: 500,
      },
    };
  }

  const autoRenew =
    args.autoRenew === undefined ? givingTemplate.auto_renew_default : args.autoRenew;

  // Decide which Mooov surface fits this plan. Stripe Subscriptions bill
  // the same amount every cycle, so they only fit when every row in our
  // schedule has the same per-cycle amount AND the member wants
  // auto-renew (an open-ended subscription is, by definition, perpetual
  // until cancelled). Variable-amount strategies (catch-up lump, balloon)
  // and fixed-term opt-outs stay on the saved-charge surface.
  const firstCycleMinor = Math.round(schedule.firstCycleAmount * 100);
  const allCyclesEqual = schedule.rows.every(
    (row) => Math.round(row.amount * 100) === firstCycleMinor,
  );
  const mooovFlow: GivingMooovFlow =
    autoRenew && allCyclesEqual
      ? "open_ended_subscription"
      : "saved_charge_fixed_term";

  return {
    ok: true,
    plan: {
      merchantId,
      member,
      churchGiving: givingTemplate,
      churchYear: currentYear,
      yearPosition,
      strategy,
      autoRenew,
      cadence,
      cadenceOptions,
      customerRef,
      schedule,
      annualAmount,
      currency: (givingRecord.currency ?? "GBP").toUpperCase(),
      mooovFlow,
      monthlyAmount:
        mooovFlow === "open_ended_subscription"
          ? schedule.firstCycleAmount
          : null,
      subscriptionInterval:
        mooovFlow === "open_ended_subscription" ? "month" : null,
      subscriptionIntervalCount:
        mooovFlow === "open_ended_subscription"
          ? cadence === "quarterly"
            ? 3
            : 1
          : null,
    },
  };
}

/**
 * Human-readable rationale for why the helper picked this strategy.
 * Drives the "Why this plan?" line in the member portal preview dialog.
 */
export function describeStrategy(
  strategy: GivingSplitStrategy,
  yearPosition: YearPosition,
): string {
  switch (strategy) {
    case "even_full_year":
      return yearPosition.quadrant === "pre_year"
        ? "Spread evenly across the upcoming year."
        : "Spread evenly across the giving year.";
    case "pro_rata":
      return "Pro-rated for the remainder of the year — only pay for the months you've been a member.";
    case "catch_up_lump_then_monthly":
      return "Today's payment covers the months already elapsed in the year, then a smaller standard amount each month.";
    case "monthly_then_balloon":
      return "Standard monthly amount each cycle, with a single larger top-up on the final month.";
    case "reslice_remaining":
      return "Your full annual giving spread evenly across the months still to go.";
  }
}
