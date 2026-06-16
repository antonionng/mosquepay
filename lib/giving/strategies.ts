// lib/giving/strategies.ts
//
// Pure functions that turn (annual amount, year position, chosen strategy)
// into the array of instalment rows to insert into member_giving_instalments.
// The cron later reads each row's `amount` to drive its /v1/charges/saved
// call — so variable-amount schedules (catch-up lump, balloon, reslice)
// "just work" without any change to the Mooov surface.
//
// All amounts are GBP major units (£1.00 = 1.00 numeric). Amounts are
// rounded to 2dp; the last instalment absorbs any sub-penny remainder so
// the schedule sums exactly to the annual total.

import type { GivingSplitStrategy } from "@/lib/db/types";
import { calculateProRataGiving } from "@/lib/giving/pro-rata";

export type InstalmentRow = {
  sequence: number;
  due_date: string;
  amount: number;
};

export type GivingCadence = "monthly" | "quarterly";

export type BuildScheduleInput = {
  /** Full annual amount. */
  annualAmount: number;
  /** Today's date (yyyy-mm-dd). Drives the first cycle date. */
  today: string;
  /** Mosque giving year. */
  yearStartDate: string;
  yearEndDate: string;
  /** Number of full elapsed calendar months from year-start to today. */
  monthsElapsed: number;
  /** Number of months from today (inclusive) to year-end. */
  monthsRemaining: number;
  /** Total months in the year (typically 12). */
  monthsTotal: number;
  /** Strategy. Pre-year / at-year-start callers should pass "even_full_year". */
  strategy: GivingSplitStrategy;
  /**
   * Billing cadence. monthly = 1 month between cycles, quarterly = 3.
   * Defaults to monthly for back-compat with callers that haven't been
   * updated yet.
   */
  cadence?: GivingCadence;
};

export type BuildScheduleResult = {
  rows: InstalmentRow[];
  /** Total billed across all rows. Should equal annualAmount (modulo 1 cent rounding). */
  total: number;
  /** Convenience: the first cycle's amount. Used as the enrolment intent amount. */
  firstCycleAmount: number;
  /** Convenience: number of cycles. */
  cycleCount: number;
};

const PENCE = 100;

function toMinor(major: number): number {
  return Math.round(major * PENCE);
}

function toMajor(minor: number): number {
  return Math.round(minor) / PENCE;
}

function addMonthsIso(iso: string, monthsToAdd: number): string {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00.000Z`);
  d.setUTCMonth(d.getUTCMonth() + monthsToAdd);
  return d.toISOString().slice(0, 10);
}

function evenSplit(totalMinor: number, count: number): number[] {
  if (count <= 0) return [];
  const base = Math.floor(totalMinor / count);
  const remainder = totalMinor - base * count;
  return Array.from({ length: count }, (_, i) =>
    i === count - 1 ? base + remainder : base
  );
}

export function buildSchedule(input: BuildScheduleInput): BuildScheduleResult {
  const annualMinor = toMinor(input.annualAmount);
  const cadence: GivingCadence = input.cadence ?? "monthly";
  // Months between consecutive cycles. monthly=1, quarterly=3.
  const cycleStrideMonths = cadence === "quarterly" ? 3 : 1;
  // Number of cycles in a full year given the cadence (12 monthly or 4 quarterly).
  const cyclesPerYear = cadence === "quarterly"
    ? Math.max(1, Math.round(input.monthsTotal / 3))
    : input.monthsTotal;
  // Number of cycles remaining from today (inclusive) to year-end given cadence.
  // monthly = monthsRemaining, quarterly = ceil(monthsRemaining / 3) so a
  // mid-year start still fits within the giving year.
  const cyclesRemaining = cadence === "quarterly"
    ? Math.max(1, Math.ceil(input.monthsRemaining / 3))
    : Math.max(1, input.monthsRemaining);
  // Standard per-cycle amount when the year is fully populated.
  const standardCycleMinor = Math.round(annualMinor / cyclesPerYear);
  // Number of "elapsed" cycles for catch-up / balloon strategies.
  const cyclesElapsed = cadence === "quarterly"
    ? Math.floor(input.monthsElapsed / 3)
    : input.monthsElapsed;

  switch (input.strategy) {
    case "even_full_year": {
      const amounts = evenSplit(annualMinor, cyclesPerYear);
      const rows = amounts.map((minor, idx) => ({
        sequence: idx + 1,
        due_date: addMonthsIso(input.today, idx * cycleStrideMonths),
        amount: toMajor(minor),
      }));
      return {
        rows,
        total: toMajor(amounts.reduce((sum, n) => sum + n, 0)),
        firstCycleAmount: toMajor(amounts[0] ?? 0),
        cycleCount: rows.length,
      };
    }

    case "pro_rata": {
      const proRata = calculateProRataGiving({
        fullYearAmount: input.annualAmount,
        yearStartDate: input.yearStartDate,
        yearEndDate: input.yearEndDate,
        joinDate: input.today,
      });
      const amounts = evenSplit(toMinor(proRata.amount), cyclesRemaining);
      const rows = amounts.map((minor, idx) => ({
        sequence: idx + 1,
        due_date: addMonthsIso(input.today, idx * cycleStrideMonths),
        amount: toMajor(minor),
      }));
      return {
        rows,
        total: toMajor(amounts.reduce((sum, n) => sum + n, 0)),
        firstCycleAmount: toMajor(amounts[0] ?? 0),
        cycleCount: rows.length,
      };
    }

    case "catch_up_lump_then_monthly": {
      // Today's enrolment intent collects the catch-up lump for prior
      // cycles PLUS this cycle's standard amount. Subsequent cycles run
      // at the standard rate until year-end.
      const remainingExclTodayCycles = Math.max(0, cyclesRemaining - 1);
      const catchUpMinor = standardCycleMinor * cyclesElapsed;
      const firstCycleMinor = catchUpMinor + standardCycleMinor;

      const tailAmounts = evenSplit(
        annualMinor - firstCycleMinor,
        remainingExclTodayCycles
      );
      const rows: InstalmentRow[] = [
        {
          sequence: 1,
          due_date: input.today.slice(0, 10),
          amount: toMajor(firstCycleMinor),
        },
        ...tailAmounts.map((minor, idx) => ({
          sequence: idx + 2,
          due_date: addMonthsIso(input.today, (idx + 1) * cycleStrideMonths),
          amount: toMajor(minor),
        })),
      ];
      return {
        rows,
        total: toMajor(
          firstCycleMinor + tailAmounts.reduce((sum, n) => sum + n, 0)
        ),
        firstCycleAmount: toMajor(firstCycleMinor),
        cycleCount: rows.length,
      };
    }

    case "monthly_then_balloon": {
      const remainingExclTodayCycles = Math.max(0, cyclesRemaining - 1);
      const tailCount = Math.max(1, remainingExclTodayCycles);
      const standardTail = tailCount - 1;
      const balloonMinor =
        annualMinor - standardCycleMinor - standardCycleMinor * standardTail;
      const rows: InstalmentRow[] = [
        {
          sequence: 1,
          due_date: input.today.slice(0, 10),
          amount: toMajor(standardCycleMinor),
        },
      ];
      for (let i = 0; i < standardTail; i++) {
        rows.push({
          sequence: i + 2,
          due_date: addMonthsIso(input.today, (i + 1) * cycleStrideMonths),
          amount: toMajor(standardCycleMinor),
        });
      }
      if (tailCount >= 1) {
        rows.push({
          sequence: rows.length + 1,
          due_date: addMonthsIso(input.today, tailCount * cycleStrideMonths),
          amount: toMajor(balloonMinor),
        });
      }
      return {
        rows,
        total: toMajor(
          rows.reduce((sum, r) => sum + toMinor(r.amount), 0)
        ),
        firstCycleAmount: toMajor(standardCycleMinor),
        cycleCount: rows.length,
      };
    }

    case "reslice_remaining": {
      const amounts = evenSplit(annualMinor, cyclesRemaining);
      const rows = amounts.map((minor, idx) => ({
        sequence: idx + 1,
        due_date: addMonthsIso(input.today, idx * cycleStrideMonths),
        amount: toMajor(minor),
      }));
      return {
        rows,
        total: toMajor(amounts.reduce((sum, n) => sum + n, 0)),
        firstCycleAmount: toMajor(amounts[0] ?? 0),
        cycleCount: rows.length,
      };
    }
  }
}

export function isStrategyEnabledForMosque(
  strategy: GivingSplitStrategy,
  mosque: {
    enable_strategy_catch_up_lump: boolean;
    enable_strategy_balloon: boolean;
    enable_strategy_reslice: boolean;
  }
): boolean {
  switch (strategy) {
    case "pro_rata":
    case "even_full_year":
      return true; // Always available; not mosque-controllable.
    case "catch_up_lump_then_monthly":
      return mosque.enable_strategy_catch_up_lump;
    case "monthly_then_balloon":
      return mosque.enable_strategy_balloon;
    case "reslice_remaining":
      return mosque.enable_strategy_reslice;
  }
}
