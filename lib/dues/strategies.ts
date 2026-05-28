// lib/dues/strategies.ts
//
// Pure functions that turn (annual amount, year position, chosen strategy)
// into the array of instalment rows to insert into member_dues_instalments.
// The cron later reads each row's `amount` to drive its /v1/charges/saved
// call — so variable-amount schedules (catch-up lump, balloon, reslice)
// "just work" without any change to the Mooov surface.
//
// All amounts are GBP major units (£1.00 = 1.00 numeric). Amounts are
// rounded to 2dp; the last instalment absorbs any sub-penny remainder so
// the schedule sums exactly to the annual total.

import type { DuesSplitStrategy } from "@/lib/db/types";
import { calculateProRataDues } from "@/lib/dues/pro-rata";

export type InstalmentRow = {
  sequence: number;
  due_date: string;
  amount: number;
};

export type BuildScheduleInput = {
  /** Full annual amount. */
  annualAmount: number;
  /** Today's date (yyyy-mm-dd). Drives the first cycle date. */
  today: string;
  /** Lodge masonic year. */
  yearStartDate: string;
  yearEndDate: string;
  /** Number of full elapsed calendar months from year-start to today. */
  monthsElapsed: number;
  /** Number of months from today (inclusive) to year-end. */
  monthsRemaining: number;
  /** Total months in the year (typically 12). */
  monthsTotal: number;
  /** Strategy. Pre-year / at-year-start callers should pass "even_full_year". */
  strategy: DuesSplitStrategy;
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
  const monthlyStandardMinor = Math.round(annualMinor / input.monthsTotal);

  switch (input.strategy) {
    case "even_full_year": {
      const amounts = evenSplit(annualMinor, input.monthsTotal);
      const rows = amounts.map((minor, idx) => ({
        sequence: idx + 1,
        due_date: addMonthsIso(input.today, idx),
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
      const proRata = calculateProRataDues({
        fullYearAmount: input.annualAmount,
        yearStartDate: input.yearStartDate,
        yearEndDate: input.yearEndDate,
        joinDate: input.today,
      });
      // Spread the pro-rata bill evenly across remaining months.
      const cycles = Math.max(1, input.monthsRemaining);
      const amounts = evenSplit(toMinor(proRata.amount), cycles);
      const rows = amounts.map((minor, idx) => ({
        sequence: idx + 1,
        due_date: addMonthsIso(input.today, idx),
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
      // months PLUS this month's standard cycle. Subsequent cycles run
      // at the standard monthly amount until year-end.
      const remainingExclTodayCycles = Math.max(0, input.monthsRemaining - 1);
      const catchUpMinor = monthlyStandardMinor * input.monthsElapsed;
      const firstCycleMinor = catchUpMinor + monthlyStandardMinor;

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
          due_date: addMonthsIso(input.today, idx + 1),
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
      // Today's intent collects this month's standard cycle. Subsequent
      // cycles run at the standard amount; the final cycle carries the
      // catch-up balloon for prior months on top.
      const remainingExclTodayCycles = Math.max(0, input.monthsRemaining - 1);
      const tailCount = Math.max(1, remainingExclTodayCycles);
      // All tail rows except the last carry the standard amount; the last
      // one carries the standard amount + the catch-up balloon.
      const standardTail = tailCount - 1;
      const balloonMinor =
        annualMinor - monthlyStandardMinor - monthlyStandardMinor * standardTail;
      const rows: InstalmentRow[] = [
        {
          sequence: 1,
          due_date: input.today.slice(0, 10),
          amount: toMajor(monthlyStandardMinor),
        },
      ];
      for (let i = 0; i < standardTail; i++) {
        rows.push({
          sequence: i + 2,
          due_date: addMonthsIso(input.today, i + 1),
          amount: toMajor(monthlyStandardMinor),
        });
      }
      if (tailCount >= 1) {
        rows.push({
          sequence: rows.length + 1,
          due_date: addMonthsIso(input.today, tailCount),
          amount: toMajor(balloonMinor),
        });
      }
      return {
        rows,
        total: toMajor(
          rows.reduce((sum, r) => sum + toMinor(r.amount), 0)
        ),
        firstCycleAmount: toMajor(monthlyStandardMinor),
        cycleCount: rows.length,
      };
    }

    case "reslice_remaining": {
      // No catch-up, no balloon: re-divide the full annual amount across
      // the remaining months (including today's). Result is a higher
      // flat monthly than the standard rate.
      const cycles = Math.max(1, input.monthsRemaining);
      const amounts = evenSplit(annualMinor, cycles);
      const rows = amounts.map((minor, idx) => ({
        sequence: idx + 1,
        due_date: addMonthsIso(input.today, idx),
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

export function isStrategyEnabledForLodge(
  strategy: DuesSplitStrategy,
  lodge: {
    enable_strategy_catch_up_lump: boolean;
    enable_strategy_balloon: boolean;
    enable_strategy_reslice: boolean;
  }
): boolean {
  switch (strategy) {
    case "pro_rata":
    case "even_full_year":
      return true; // Always available; not lodge-controllable.
    case "catch_up_lump_then_monthly":
      return lodge.enable_strategy_catch_up_lump;
    case "monthly_then_balloon":
      return lodge.enable_strategy_balloon;
    case "reslice_remaining":
      return lodge.enable_strategy_reslice;
  }
}
