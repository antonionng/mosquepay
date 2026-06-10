// lib/giving/year-position.ts
//
// Where is a given member, on a given day, relative to their church's
// giving year? The four-quadrant model that drives the giving UX:
//
//                      | Pre-year / at-start    | Mid-year
//   -------------------+------------------------+----------------------
//   New member         | even_full_year         | mid_year_new (pro-rata)
//   Existing member    | even_full_year         | mid_year_existing_behind
//
// "New" = first giving year as a member (date_of_membership falls inside
// the current year). "Existing" = welcomed in a prior year and therefore
// expected to have paid prior years' giving.
//
// "At-start" is anything before today crosses one calendar month past the
// year start. After that we treat it as mid-year.
//
// Pure function. No db access. Caller passes the data already loaded.

export type GivingQuadrant =
  | "pre_year"
  | "at_year_start"
  | "mid_year_new_initiate"
  | "mid_year_existing_behind"
  | "paid_up_current_year";

export type YearPositionInput = {
  /** ISO date (yyyy-mm-dd or full timestamp). Defaults to "today" UTC. */
  today?: string;
  yearStartDate: string;
  yearEndDate: string;
  /** ISO date of the member's membership, if known. */
  dateOfInitiation: string | null;
  /** True when a member_giving row covering the current year is paid. */
  hasPaidCurrentYear: boolean;
  /** True when a member_giving row covering the current year exists but is unpaid. */
  hasOutstandingCurrentYear: boolean;
};

export type YearPosition = {
  quadrant: GivingQuadrant;
  /** Number of full elapsed calendar months from year-start to today. */
  monthsElapsed: number;
  /** Number of full calendar months from today (inclusive) to year-end. */
  monthsRemaining: number;
  /** Total months in the year (12 in nearly all cases). */
  monthsTotal: number;
  /** True when today is before the year start. */
  beforeYearStart: boolean;
};

const MS_PER_DAY = 86_400_000;

function parseIsoDay(value: string): Date {
  return new Date(`${value.slice(0, 10)}T12:00:00.000Z`);
}

function monthsBetween(from: Date, to: Date): number {
  const years = to.getUTCFullYear() - from.getUTCFullYear();
  const months = to.getUTCMonth() - from.getUTCMonth();
  const dayAdjust = to.getUTCDate() < from.getUTCDate() ? -1 : 0;
  return Math.max(0, years * 12 + months + dayAdjust);
}

export function computeYearPosition(input: YearPositionInput): YearPosition {
  const today = parseIsoDay(input.today ?? new Date().toISOString());
  const yearStart = parseIsoDay(input.yearStartDate);
  const yearEnd = parseIsoDay(input.yearEndDate);

  const monthsTotal = Math.max(
    1,
    Math.round((yearEnd.getTime() - yearStart.getTime()) / (MS_PER_DAY * 30.4375))
  );

  const beforeYearStart = today.getTime() < yearStart.getTime();
  const monthsElapsed = beforeYearStart ? 0 : monthsBetween(yearStart, today);
  const monthsRemaining = Math.max(0, monthsTotal - monthsElapsed);

  if (input.hasPaidCurrentYear) {
    return {
      quadrant: "paid_up_current_year",
      monthsElapsed,
      monthsRemaining,
      monthsTotal,
      beforeYearStart,
    };
  }

  if (beforeYearStart) {
    return {
      quadrant: "pre_year",
      monthsElapsed,
      monthsRemaining,
      monthsTotal,
      beforeYearStart,
    };
  }

  // Within the first calendar month of the year we treat enrolment as
  // "at year start" — no catch-up logic, full 12 cycles ahead.
  if (monthsElapsed < 1) {
    return {
      quadrant: "at_year_start",
      monthsElapsed,
      monthsRemaining,
      monthsTotal,
      beforeYearStart,
    };
  }

  // Mid-year. Branch on whether the member is new (welcomed this year)
  // or existing.
  const isNewInitiate = (() => {
    if (!input.dateOfInitiation) return false;
    const membership = parseIsoDay(input.dateOfInitiation);
    return membership.getTime() >= yearStart.getTime();
  })();

  return {
    quadrant: isNewInitiate ? "mid_year_new_initiate" : "mid_year_existing_behind",
    monthsElapsed,
    monthsRemaining,
    monthsTotal,
    beforeYearStart,
  };
}

/**
 * Compute the next giving year's start/end given the current one. Used by
 * the pay-in-advance flow when the next year's row has not yet been
 * configured by the church admin.
 */
export function nextYearBounds(currentStart: string, currentEnd: string): {
  startDate: string;
  endDate: string;
  label: string;
} {
  const start = parseIsoDay(currentStart);
  const end = parseIsoDay(currentEnd);
  const nextStart = new Date(start);
  nextStart.setUTCFullYear(nextStart.getUTCFullYear() + 1);
  const nextEnd = new Date(end);
  nextEnd.setUTCFullYear(nextEnd.getUTCFullYear() + 1);
  const startYear = nextStart.getUTCFullYear();
  const endYear = nextEnd.getUTCFullYear();
  return {
    startDate: nextStart.toISOString().slice(0, 10),
    endDate: nextEnd.toISOString().slice(0, 10),
    label: `${startYear}/${String(endYear).slice(-2)}`,
  };
}
