/**
 * Compute meeting "readiness" — what is missing before this meeting can run.
 * Used in the meetings list, selected meeting panel, and reporting.
 */

export type MeetingReadinessInput = {
  event_date: string;
  enable_rsvp: boolean;
  enable_dining_rsvp: boolean;
  dining_price: number | null;
  enable_payments: boolean;
  enable_charity_donation: boolean;
  charity_name: string | null;
  enable_meeting_fee: boolean;
  meeting_fee_amount: number | null;
  enable_guest_tickets: boolean;
  guest_ticket_price: number | null;
  published: boolean;
  hasSummons: boolean;
  summonsSentCount: number;
  summonsStatus?: "none" | "draft" | "approved" | "sent";
};

export type ReadinessIssue = {
  key: string;
  message: string;
  severity: "info" | "warn" | "urgent";
};

export type MeetingReadiness = {
  status: "ready" | "needs_attention" | "blocked";
  issues: ReadinessIssue[];
  /** Compact summary string suitable for a chip. */
  label: string;
};

const NOW = () => Date.now();
const DAY = 86400000;

export function getMeetingReadiness(
  input: MeetingReadinessInput
): MeetingReadiness {
  const issues: ReadinessIssue[] = [];

  const eventTs = new Date(input.event_date).getTime();
  const daysUntil = Math.floor((eventTs - NOW()) / DAY);
  const isFuture = daysUntil >= 0;

  if (isFuture && !input.published) {
    issues.push({
      key: "unpublished",
      message: "Not published on the public site",
      severity: "warn",
    });
  }

  const summonsStatus =
    input.summonsStatus ?? (input.hasSummons ? "draft" : "none");
  if (isFuture && summonsStatus === "none") {
    issues.push({
      key: "no_summons",
      message: "Summons not drafted",
      severity: daysUntil <= 14 ? "urgent" : "warn",
    });
  } else if (isFuture && summonsStatus === "draft") {
    issues.push({
      key: "summons_unapproved",
      message: "Summons drafted but not yet approved",
      severity: daysUntil <= 14 ? "urgent" : "warn",
    });
  } else if (
    isFuture &&
    summonsStatus === "approved" &&
    input.summonsSentCount === 0
  ) {
    issues.push({
      key: "summons_unsent",
      message: "Summons approved but not yet sent",
      severity: daysUntil <= 7 ? "urgent" : "warn",
    });
  }

  if (
    isFuture &&
    input.enable_dining_rsvp &&
    (input.dining_price === null || input.dining_price <= 0)
  ) {
    issues.push({
      key: "dining_no_price",
      message: "Dining enabled but no price set",
      severity: "warn",
    });
  }

  if (
    isFuture &&
    input.enable_charity_donation &&
    (!input.charity_name || input.charity_name.trim().length === 0)
  ) {
    issues.push({
      key: "charity_no_name",
      message: "Charity collection enabled but no campaign name",
      severity: "warn",
    });
  }

  if (
    isFuture &&
    input.enable_meeting_fee &&
    (input.meeting_fee_amount === null || input.meeting_fee_amount <= 0)
  ) {
    issues.push({
      key: "meeting_fee_no_amount",
      message: "Meeting fee enabled but no amount set",
      severity: "warn",
    });
  }

  if (
    isFuture &&
    input.enable_guest_tickets &&
    (input.guest_ticket_price === null || input.guest_ticket_price <= 0)
  ) {
    issues.push({
      key: "guest_no_price",
      message: "Guest tickets enabled but no price",
      severity: "warn",
    });
  }

  if (
    isFuture &&
    input.enable_payments &&
    !input.enable_dining_rsvp &&
    !input.enable_meeting_fee &&
    !input.enable_guest_tickets &&
    !input.enable_charity_donation
  ) {
    issues.push({
      key: "payments_no_items",
      message: "Payments enabled but no payable items configured",
      severity: "info",
    });
  }

  let status: MeetingReadiness["status"] = "ready";
  if (issues.some((i) => i.severity === "urgent")) status = "blocked";
  else if (issues.length > 0) status = "needs_attention";

  let label = "Ready";
  if (status === "blocked") label = `${issues.length} blocker${issues.length === 1 ? "" : "s"}`;
  else if (status === "needs_attention")
    label = `${issues.length} to do`;

  return { status, issues, label };
}

export const READINESS_CLASSES: Record<MeetingReadiness["status"], string> = {
  ready: "border-emerald-200 bg-emerald-50 text-emerald-900",
  needs_attention: "border-amber-200 bg-amber-50 text-amber-900",
  blocked: "border-red-200 bg-red-50 text-red-900",
};
