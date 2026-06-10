const MS_PER_DAY = 86400000;

function parseDate(iso: string): Date {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00.000Z`);
  if (Number.isNaN(d.getTime())) {
    throw new Error(`Invalid date: ${iso}`);
  }
  return d;
}

function daysInclusive(start: Date, end: Date): number {
  const diff = Math.floor((end.getTime() - start.getTime()) / MS_PER_DAY);
  return Math.max(0, diff + 1);
}

export type ProRataInput = {
  fullYearAmount: number;
  yearStartDate: string;
  yearEndDate: string;
  joinDate: string;
};

export type ProRataResult = {
  amount: number;
  fullYearAmount: number;
  daysRemaining: number;
  totalDaysInYear: number;
  fraction: number;
  periodStart: string;
  periodEnd: string;
};

export function calculateProRataGiving(input: ProRataInput): ProRataResult {
  const yearStart = parseDate(input.yearStartDate);
  const yearEnd = parseDate(input.yearEndDate);
  const join = parseDate(input.joinDate);

  const periodStart =
    join.getTime() > yearStart.getTime() ? join : yearStart;
  const periodEnd = yearEnd;

  const totalDaysInYear = daysInclusive(yearStart, yearEnd);
  const daysRemaining = daysInclusive(periodStart, periodEnd);

  const fraction =
    totalDaysInYear > 0
      ? Math.min(1, Math.max(0, daysRemaining / totalDaysInYear))
      : 0;

  const raw = input.fullYearAmount * fraction;
  const amount = Math.round(raw * 100) / 100;

  return {
    amount,
    fullYearAmount: input.fullYearAmount,
    daysRemaining,
    totalDaysInYear,
    fraction,
    periodStart: periodStart.toISOString().slice(0, 10),
    periodEnd: periodEnd.toISOString().slice(0, 10),
  };
}

export function defaultChurchYearBounds(reference = new Date()): {
  startDate: string;
  endDate: string;
  label: string;
} {
  const month = reference.getUTCMonth();
  const year = reference.getUTCFullYear();
  const startYear = month >= 8 ? year : year - 1;
  const endYear = startYear + 1;
  return {
    label: `${startYear}/${String(endYear).slice(-2)}`,
    startDate: `${startYear}-09-01`,
    endDate: `${endYear}-08-31`,
  };
}
