import type { MosqueGivingYear, MemberGiving } from "@/lib/db/types";

export type NextGivingStatus =
  | "owed_current_year"
  | "billed_current_year"
  | "no_giving_year"
  | "no_giving_template"
  | "waived_at_profile";

export type NextGivingSummary = {
  status: NextGivingStatus;
  /** ISO date when the next giving bill is expected to fall due. */
  nextDueDate: string | null;
  /** Label of the giving year the next bill relates to. */
  nextYearLabel: string | null;
  /** Expected amount for the next bill, if known (pre-pro-rata). */
  expectedAmount: number | null;
  /** Whether the member has a current-year outstanding record. */
  currentYearOutstanding: boolean;
  /** Reason captured against the profile-level waiver, when set. */
  waiverReason?: string | null;
};

function parseIsoDay(value: string): Date {
  return new Date(`${value.slice(0, 10)}T12:00:00.000Z`);
}

function addOneDay(value: string): string {
  const d = parseIsoDay(value);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Work out when a member's next annual giving bill should fall due, given the
 * mosque's current giving year and any giving records already on file.
 *
 * Rules (simple and predictable for treasurers):
 * 1. No giving year configured → status "no_giving_year".
 * 2. Member has no giving record covering the current year → bill is owed at
 *    the start of the current year (status "owed_current_year").
 * 3. Member already has a giving record for the current year → next bill is
 *    the day after the current year ends, i.e. the start of next year.
 */
export function computeNextGivingForMember(args: {
  currentYear: MosqueGivingYear | null;
  memberGiving: MemberGiving[];
  defaultAnnualAmount?: number | null;
  /** When true the member has a permanent profile-level giving waiver. */
  annualGivingWaived?: boolean;
  /** Reason recorded against the profile waiver. */
  annualGivingWaiverReason?: string | null;
}): NextGivingSummary {
  const { currentYear, memberGiving } = args;
  const defaultAmount = args.defaultAnnualAmount ?? null;

  if (args.annualGivingWaived) {
    return {
      status: "waived_at_profile",
      nextDueDate: null,
      nextYearLabel: currentYear?.label ?? null,
      expectedAmount: null,
      currentYearOutstanding: false,
      waiverReason: args.annualGivingWaiverReason ?? null,
    };
  }

  if (!currentYear) {
    const latest = [...memberGiving].sort((a, b) =>
      (b.period_end ?? "").localeCompare(a.period_end ?? "")
    )[0];
    return {
      status: "no_giving_year",
      nextDueDate: latest?.period_end ? addOneDay(latest.period_end) : null,
      nextYearLabel: null,
      expectedAmount: latest?.full_year_amount ?? latest?.amount ?? defaultAmount,
      currentYearOutstanding: false,
    };
  }

  const yearStart = currentYear.start_date.slice(0, 10);
  const yearEnd = currentYear.end_date.slice(0, 10);
  const annualAmount = currentYear.annual_giving_amount ?? defaultAmount;

  const coversCurrentYear = memberGiving.find((giving) => {
    if (!giving.period_start || !giving.period_end) return false;
    return (
      giving.period_start.slice(0, 10) <= yearEnd &&
      giving.period_end.slice(0, 10) >= yearStart &&
      giving.status !== "waived"
    );
  });

  if (!coversCurrentYear) {
    return {
      status: "owed_current_year",
      nextDueDate: yearStart,
      nextYearLabel: currentYear.label,
      expectedAmount: annualAmount,
      currentYearOutstanding: false,
    };
  }

  const outstanding =
    coversCurrentYear.status !== "paid" && coversCurrentYear.status !== "waived";

  return {
    status: "billed_current_year",
    nextDueDate: addOneDay(yearEnd),
    nextYearLabel: nextYearLabel(currentYear.label),
    expectedAmount: annualAmount,
    currentYearOutstanding: outstanding,
  };
}

function nextYearLabel(currentLabel: string): string | null {
  const match = currentLabel.match(/^(\d{2,4})\s*[\/\-]\s*(\d{2,4})$/);
  if (!match) return null;
  const startYear = Number(match[1].length === 2 ? `20${match[1]}` : match[1]);
  const endYear = Number(match[2].length === 2 ? `20${match[2]}` : match[2]);
  if (!Number.isFinite(startYear) || !Number.isFinite(endYear)) return null;
  return `${startYear + 1}/${String(endYear + 1).slice(-2)}`;
}
