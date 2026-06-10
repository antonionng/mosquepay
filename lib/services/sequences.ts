import type { ServiceSequence } from "@/lib/db/types";

/**
 * Compute the date that the nth occurrence of a given weekday falls on
 * inside the given calendar month, in UTC. Returns null when the month
 * does not contain that occurrence (e.g. a 5th Saturday that does not
 * exist in February).
 *
 * weekOfMonth: 1..5 for nth occurrence, or -1 for the last occurrence.
 * dayOfWeek: 1 = Monday, 7 = Sunday (ISO style).
 */
export function nthWeekdayOfMonth(
  year: number,
  month: number,
  dayOfWeek: number,
  weekOfMonth: number
): Date | null {
  if (month < 1 || month > 12) return null;
  if (dayOfWeek < 1 || dayOfWeek > 7) return null;

  const targetJsDay = dayOfWeek === 7 ? 0 : dayOfWeek;
  const firstOfMonth = new Date(Date.UTC(year, month - 1, 1));
  const firstJsDay = firstOfMonth.getUTCDay();
  const offset = (targetJsDay - firstJsDay + 7) % 7;
  const firstOccurrenceDay = 1 + offset;

  const lastOfMonth = new Date(Date.UTC(year, month, 0));
  const daysInMonth = lastOfMonth.getUTCDate();

  if (weekOfMonth === -1) {
    let day = firstOccurrenceDay;
    while (day + 7 <= daysInMonth) day += 7;
    return new Date(Date.UTC(year, month - 1, day));
  }

  if (weekOfMonth < 1 || weekOfMonth > 5) return null;
  const day = firstOccurrenceDay + (weekOfMonth - 1) * 7;
  if (day > daysInMonth) return null;
  return new Date(Date.UTC(year, month - 1, day));
}

export type GeneratedSequenceDate = {
  /** YYYY-MM-DD in UTC. */
  date: string;
  /** ISO timestamp combining the date and the sequence default time. */
  iso: string;
  /** 1-based position inside the generated set. */
  position: number;
  /** Calendar month 1..12 used for slugging. */
  month: number;
  /** Calendar year used for slugging. */
  year: number;
};

function parseTimeToHours(time: string | null): { h: number; m: number } {
  if (!time) return { h: 18, m: 0 };
  const trimmed = time.trim().toLowerCase();
  const match = trimmed.match(
    /^(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)?$/
  );
  if (!match) return { h: 18, m: 0 };
  let h = Number(match[1]);
  const m = match[2] ? Number(match[2]) : 0;
  const meridiem = match[3];
  if (meridiem === "pm" && h < 12) h += 12;
  if (meridiem === "am" && h === 12) h = 0;
  if (h > 23 || m > 59) return { h: 18, m: 0 };
  return { h, m };
}

/**
 * Resolve the (week_of_month, day_of_week) pair to use for a given calendar
 * month, applying any per-month override on top of the sequence default.
 */
export function resolveMonthRule(
  sequence: Pick<
    ServiceSequence,
    "day_of_week" | "week_of_month" | "month_overrides"
  >,
  month: number
): { week_of_month: number; day_of_week: number } {
  const override = sequence.month_overrides?.[String(month)];
  const week =
    override?.week_of_month !== undefined
      ? override.week_of_month
      : sequence.week_of_month;
  const day =
    override?.day_of_week !== undefined
      ? override.day_of_week
      : sequence.day_of_week;
  return { week_of_month: week, day_of_week: day };
}

/**
 * Generate the dates a sequence will fall on between the given start
 * and end dates, inclusive. Both bounds are interpreted as UTC days.
 */
export function generateSequenceDates(
  sequence: Pick<
    ServiceSequence,
    | "day_of_week"
    | "week_of_month"
    | "months"
    | "month_overrides"
    | "default_event_time"
  >,
  startDate: Date,
  endDate: Date
): GeneratedSequenceDate[] {
  if (endDate.getTime() < startDate.getTime()) return [];
  const time = parseTimeToHours(sequence.default_event_time);
  const months = [...new Set(sequence.months)].filter(
    (m) => m >= 1 && m <= 12
  );
  if (months.length === 0) return [];

  const startUtc = Date.UTC(
    startDate.getUTCFullYear(),
    startDate.getUTCMonth(),
    startDate.getUTCDate()
  );
  const endUtc = Date.UTC(
    endDate.getUTCFullYear(),
    endDate.getUTCMonth(),
    endDate.getUTCDate()
  );

  const out: GeneratedSequenceDate[] = [];
  for (
    let year = startDate.getUTCFullYear();
    year <= endDate.getUTCFullYear();
    year++
  ) {
    for (const month of months) {
      const rule = resolveMonthRule(sequence, month);
      const newcomer = nthWeekdayOfMonth(
        year,
        month,
        rule.day_of_week,
        rule.week_of_month
      );
      if (!newcomer) continue;
      const newcomerUtc = newcomer.getTime();
      if (newcomerUtc < startUtc || newcomerUtc > endUtc) continue;
      const iso = new Date(
        Date.UTC(year, month - 1, newcomer.getUTCDate(), time.h, time.m)
      ).toISOString();
      out.push({
        date: newcomer.toISOString().slice(0, 10),
        iso,
        position: 0,
        month,
        year,
      });
    }
  }

  out.sort((a, b) => (a.iso < b.iso ? -1 : a.iso > b.iso ? 1 : 0));
  return out.map((entry, index) => ({ ...entry, position: index + 1 }));
}

const DAY_LABELS: Record<number, string> = {
  1: "Monday",
  2: "Tuesday",
  3: "Wednesday",
  4: "Thursday",
  5: "Friday",
  6: "Saturday",
  7: "Sunday",
};

const MONTH_LABELS: Record<number, string> = {
  1: "January",
  2: "February",
  3: "March",
  4: "April",
  5: "May",
  6: "June",
  7: "July",
  8: "August",
  9: "September",
  10: "October",
  11: "November",
  12: "December",
};

function weekLabel(weekOfMonth: number): string {
  if (weekOfMonth === -1) return "Last";
  return (
    ["1st", "2nd", "3rd", "4th", "5th"][weekOfMonth - 1] ?? "Nth"
  );
}

export function describeSequence(
  sequence: Pick<
    ServiceSequence,
    "day_of_week" | "week_of_month" | "months" | "month_overrides"
  >
): string {
  const sortedMonths = sequence.months
    .slice()
    .filter((m) => m >= 1 && m <= 12)
    .sort((a, b) => a - b);

  type Group = { week: number; day: number; months: number[] };
  const groups: Group[] = [];
  for (const month of sortedMonths) {
    const rule = resolveMonthRule(sequence, month);
    const existing = groups.find(
      (g) => g.week === rule.week_of_month && g.day === rule.day_of_week
    );
    if (existing) {
      existing.months.push(month);
    } else {
      groups.push({
        week: rule.week_of_month,
        day: rule.day_of_week,
        months: [month],
      });
    }
  }

  if (groups.length === 0) return "No months selected";

  return groups
    .map((group) => {
      const week = weekLabel(group.week);
      const day = DAY_LABELS[group.day] ?? "day";
      const monthsLabel = group.months
        .map((m) => MONTH_LABELS[m] ?? String(m))
        .join(", ");
      return `${week} ${day} of ${monthsLabel}`;
    })
    .join("; ");
}

export function isNoticeNewcomerOverdue(
  eventDateIso: string,
  minNewcomerWeeks: number,
  now: Date = new Date()
): boolean {
  const eventTs = new Date(eventDateIso).getTime();
  const minNewcomerMs = minNewcomerWeeks * 7 * 86400000;
  return eventTs - now.getTime() < minNewcomerMs;
}

export function isWithinDraftWindow(
  eventDateIso: string,
  newcomerWeeks: number,
  now: Date = new Date()
): boolean {
  const eventTs = new Date(eventDateIso).getTime();
  if (eventTs <= now.getTime()) return false;
  const newcomerMs = newcomerWeeks * 7 * 86400000;
  return eventTs - now.getTime() <= newcomerMs;
}
