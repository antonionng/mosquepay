// lib/dues/enrolment-plan.ts
//
// Pure orchestrator that resolves everything needed to show OR start a
// saved-charge dues subscription enrolment for a single member-dues row:
// merchant, member, lodge dues template, current masonic year, year
// position, default strategy, and the per-cycle instalment plan.
//
// Same code path used by:
//
//   * POST /api/dues/subscription-preview
//       Returns the plan to the member portal so the "Set up instalments"
//       confirmation dialog can show a real schedule (cycles, amounts,
//       dates, total) BEFORE redirecting the member to Mooov hosted
//       Checkout. The Mooov/Stripe surface only knows about cycle 1 +
//       saved-card setup, so all multi-cycle UX has to live in LP.
//
//   * POST /api/dues/pay (mode: "subscription")
//       Calls this helper, then writes the plan into dues_schedules +
//       member_dues_instalments and posts the enrolment intent to
//       Mooov. Pulled out so preview and pay can never disagree.
//
// Side-effect free: this function reads database rows but never writes.
// The dues_schedules row, instalment rows, and Mooov payment_attempt
// row are written by the caller (lib/dues/pay/route.ts) only on the
// real-charge path.

import * as db from "@/lib/db";
import { createServiceClient } from "@/lib/supabase/server";
import { computeYearPosition, type YearPosition } from "@/lib/dues/year-position";
import {
  buildSchedule,
  isStrategyEnabledForLodge,
  type DuesCadence,
} from "@/lib/dues/strategies";
import type {
  DuesSplitStrategy,
  LodgeDues,
  LodgeMasonicYear,
  Member,
  MemberDues,
} from "@/lib/db/types";

export type EnrolmentPlanArgs = {
  lodgeId: string;
  duesRecord: MemberDues;
  memberEmail: string;
  /** Caller-chosen strategy. Falls back to the year-position default. */
  strategy?: DuesSplitStrategy;
  /** Caller-chosen auto-renew. Falls back to the lodge default. */
  autoRenew?: boolean;
  /**
   * Caller-chosen cadence (monthly / quarterly). Falls back to the
   * lodge dues template's instalment_frequency. The dues page surfaces
   * any cadence options the lodge has enabled so the member can pick.
   */
  cadence?: DuesCadence;
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
export type DuesMooovFlow =
  | "open_ended_subscription"
  | "saved_charge_fixed_term";

export type EnrolmentPlan = {
  merchantId: string;
  member: Member;
  lodgeDues: LodgeDues;
  masonicYear: LodgeMasonicYear;
  yearPosition: YearPosition;
  /** Strategy actually used (after lodge enable + cap checks). */
  strategy: DuesSplitStrategy;
  autoRenew: boolean;
  cadence: DuesCadence;
  /**
   * All cadences enabled by the lodge for this dues template, in the
   * order we want to surface them in the UI. Drives the cadence picker
   * on /member/dues. If the template only allows one cadence, this is
   * a single-element array.
   */
  cadenceOptions: DuesCadence[];
  customerRef: string;
  /** Schedule rows. cycle 1 is collected today by the enrolment intent. */
  schedule: ReturnType<typeof buildSchedule>;
  annualAmount: number;
  currency: string;
  /** Which Mooov surface to use for this enrolment. See DuesMooovFlow. */
  mooovFlow: DuesMooovFlow;
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
    | "lodge_not_connected"
    | "member_not_found"
    | "instalments_not_enabled"
    | "no_masonic_year"
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
  const { lodgeId, duesRecord, memberEmail } = args;

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
    .from("lodges")
    .select("merchant_id, status")
    .eq("id", lodgeId)
    .maybeSingle<{ merchant_id: string; status: string }>();

  if (
    !merchantRow ||
    !merchantRow.merchant_id ||
    (merchantRow.status && merchantRow.status !== "active")
  ) {
    return {
      ok: false,
      error: {
        code: "lodge_not_connected",
        message:
          "This lodge has not finished setting up online payments yet. Please contact the lodge directly.",
        status: 503,
      },
    };
  }
  const merchantId = merchantRow.merchant_id;

  // 2. Resolve member. Prefer FK on the dues row, fall back to (email, lodgeId).
  const member =
    duesRecord.member_id != null
      ? await db
          .getMemberById(duesRecord.member_id, lodgeId)
          .catch(() => null)
      : await db.getMemberByEmail(memberEmail, lodgeId).catch(() => null);

  if (!member) {
    return {
      ok: false,
      error: {
        code: "member_not_found",
        message:
          "Could not resolve your member profile. Please contact your lodge secretary.",
        status: 404,
      },
    };
  }
  const customerRef = `mbr_${member.id}`;

  // 3. Resolve the lodge dues template that this member_dues row was
  // created from. A lodge can have several active templates (e.g.
  // "Annual Subscription" + "Festival Contribution"); duesRecord.dues_id
  // points at the specific template to use. Picking lodgeDuesList[0]
  // would silently apply the wrong template's cadence + amount, which
  // is exactly the bug that drove the "60 quarterly vs 24 monthly"
  // discrepancy on Covenant Lodge.
  const lodgeDuesList = await db.getLodgeDues(lodgeId);
  const duesTemplate =
    lodgeDuesList.find((row) => row.id === duesRecord.dues_id) ??
    lodgeDuesList[0] ??
    null;
  if (!duesTemplate || duesTemplate.allow_instalments !== true) {
    return {
      ok: false,
      error: {
        code: "instalments_not_enabled",
        message: "Monthly subscriptions are not enabled for this lodge.",
        status: 409,
      },
    };
  }

  // 4. Resolve masonic year + year position.
  const currentYear = await db.getCurrentMasonicYear(lodgeId);
  if (!currentYear) {
    return {
      ok: false,
      error: {
        code: "no_masonic_year",
        message:
          "Your lodge has not configured a masonic year yet. Please contact your lodge secretary.",
        status: 409,
      },
    };
  }

  const memberDuesList = await db.getMemberDues(lodgeId, { memberEmail });
  const paidThisYear = memberDuesList.some(
    (d) =>
      !d.is_advance &&
      d.status === "paid" &&
      d.period_start.slice(0, 10) <= currentYear.end_date.slice(0, 10) &&
      d.period_end.slice(0, 10) >= currentYear.start_date.slice(0, 10),
  );

  const yearPosition = computeYearPosition({
    yearStartDate: currentYear.start_date,
    yearEndDate: currentYear.end_date,
    dateOfInitiation: member.date_of_initiation ?? null,
    hasPaidCurrentYear: paidThisYear,
    hasOutstandingCurrentYear: !paidThisYear,
  });

  // 5. Pick the strategy. Caller > default, but always honour lodge config.
  const defaultStrategy: DuesSplitStrategy =
    yearPosition.quadrant === "pre_year" ||
    yearPosition.quadrant === "at_year_start"
      ? "even_full_year"
      : yearPosition.quadrant === "mid_year_new_initiate"
        ? "pro_rata"
        : "reslice_remaining";

  let strategy: DuesSplitStrategy = args.strategy ?? defaultStrategy;
  if (!isStrategyEnabledForLodge(strategy, duesTemplate)) {
    strategy = defaultStrategy;
  }
  if (
    strategy === "catch_up_lump_then_monthly" &&
    yearPosition.monthsElapsed > duesTemplate.catch_up_max_months
  ) {
    return {
      ok: false,
      error: {
        code: "catch_up_exceeds_cap",
        message: `You're more than ${duesTemplate.catch_up_max_months} months into the year. Please speak to your treasurer to set up a tailored payment plan.`,
        status: 409,
        details: { catch_up_max_months: duesTemplate.catch_up_max_months },
      },
    };
  }

  // 5b. Pick cadence. The lodge template's instalment_frequency is the
  // default; the member can override via the dues page picker, but only
  // among cadences the lodge has enabled. v1 keeps the option set simple
  // (monthly + quarterly) — the only two values instalment_frequency
  // takes today.
  const templateCadence: DuesCadence =
    duesTemplate.instalment_frequency === "quarterly" ? "quarterly" : "monthly";
  const cadenceOptions: DuesCadence[] =
    templateCadence === "quarterly"
      ? ["quarterly", "monthly"]
      : ["monthly", "quarterly"];
  const cadence: DuesCadence = args.cadence
    ? cadenceOptions.includes(args.cadence)
      ? args.cadence
      : templateCadence
    : templateCadence;

  // 6. Build the per-cycle plan.
  const annualAmount = duesRecord.full_year_amount ?? duesRecord.amount;
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
          "Could not work out a payment schedule for the current year. Please contact your lodge secretary.",
        status: 500,
      },
    };
  }

  const autoRenew =
    args.autoRenew === undefined ? duesTemplate.auto_renew_default : args.autoRenew;

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
  const mooovFlow: DuesMooovFlow =
    autoRenew && allCyclesEqual
      ? "open_ended_subscription"
      : "saved_charge_fixed_term";

  return {
    ok: true,
    plan: {
      merchantId,
      member,
      lodgeDues: duesTemplate,
      masonicYear: currentYear,
      yearPosition,
      strategy,
      autoRenew,
      cadence,
      cadenceOptions,
      customerRef,
      schedule,
      annualAmount,
      currency: (duesRecord.currency ?? "GBP").toUpperCase(),
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
  strategy: DuesSplitStrategy,
  yearPosition: YearPosition,
): string {
  switch (strategy) {
    case "even_full_year":
      return yearPosition.quadrant === "pre_year"
        ? "Spread evenly across the upcoming year."
        : "Spread evenly across the masonic year.";
    case "pro_rata":
      return "Pro-rated for the remainder of the year — only pay for the months you've been a member.";
    case "catch_up_lump_then_monthly":
      return "Today's payment covers the months already elapsed in the year, then a smaller standard amount each month.";
    case "monthly_then_balloon":
      return "Standard monthly amount each cycle, with a single larger top-up on the final month.";
    case "reslice_remaining":
      return "Your full annual dues spread evenly across the months still to go.";
  }
}
