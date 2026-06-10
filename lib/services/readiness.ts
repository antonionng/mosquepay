/**
 * Compute service "readiness" — what is missing before this service can run.
 * Used in the services list, selected service panel, and reporting.
 */

import { resolveEffectiveAmount } from "@/lib/fees/resolve";
import type { ChurchFeeDefaults } from "@/lib/fees/resolve";

export type ServiceReadinessInput = {
  event_date: string;
  enable_rsvp: boolean;
  enable_dining_rsvp: boolean;
  dining_price: number | null;
  enable_payments: boolean;
  enable_charity_donation: boolean;
  charity_name: string | null;
  enable_service_fee: boolean;
  service_fee_amount: number | null;
  enable_guest_tickets: boolean;
  guest_ticket_price: number | null;
  published: boolean;
  hasNotice: boolean;
  noticeSentCount: number;
  noticeStatus?: "none" | "draft" | "approved" | "sent";
  /**
   * Optional church-level fee defaults. When supplied, readiness treats a
   * `null` event amount as "inherits from default" rather than missing,
   * matching the behaviour of `lib/fees/resolve.ts`.
   */
  churchDefaults?: ChurchFeeDefaults | null;
};

export type ReadinessIssue = {
  key: string;
  message: string;
  severity: "info" | "warn" | "urgent";
};

export type ServiceReadiness = {
  status: "ready" | "needs_attention" | "blocked";
  issues: ReadinessIssue[];
  /** Compact summary string suitable for a chip. */
  label: string;
};

const NOW = () => Date.now();
const DAY = 86400000;

export function getServiceReadiness(
  input: ServiceReadinessInput
): ServiceReadiness {
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

  const noticeStatus =
    input.noticeStatus ?? (input.hasNotice ? "draft" : "none");
  if (isFuture && noticeStatus === "none") {
    issues.push({
      key: "no_notice",
      message: "Notice not drafted",
      severity: daysUntil <= 14 ? "urgent" : "warn",
    });
  } else if (isFuture && noticeStatus === "draft") {
    issues.push({
      key: "notice_unapproved",
      message: "Notice drafted but not yet approved",
      severity: daysUntil <= 14 ? "urgent" : "warn",
    });
  } else if (
    isFuture &&
    noticeStatus === "approved" &&
    input.noticeSentCount === 0
  ) {
    issues.push({
      key: "notice_unsent",
      message: "Notice approved but not yet sent",
      severity: daysUntil <= 7 ? "urgent" : "warn",
    });
  }

  const effectiveDining = resolveEffectiveAmount(
    input.dining_price,
    input.churchDefaults?.default_member_dining_amount
  );
  if (
    isFuture &&
    input.enable_dining_rsvp &&
    (effectiveDining == null || effectiveDining <= 0)
  ) {
    issues.push({
      key: "dining_no_price",
      message:
        "Dining enabled but no price set (and no church default to fall back on)",
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

  const effectiveLevy = resolveEffectiveAmount(
    input.service_fee_amount,
    input.churchDefaults?.default_member_levy_amount
  );
  if (
    isFuture &&
    input.enable_service_fee &&
    (effectiveLevy == null || effectiveLevy <= 0)
  ) {
    issues.push({
      key: "service_fee_no_amount",
      message:
        "Member levy enabled but no amount set (and no church default to fall back on)",
      severity: "warn",
    });
  }

  const effectiveGuestDining = resolveEffectiveAmount(
    input.guest_ticket_price,
    input.churchDefaults?.default_guest_dining_amount
  );
  if (
    isFuture &&
    input.enable_guest_tickets &&
    (effectiveGuestDining == null || effectiveGuestDining <= 0)
  ) {
    issues.push({
      key: "guest_no_price",
      message:
        "Guests enabled but no dining price (and no church default to fall back on)",
      severity: "warn",
    });
  }

  if (
    isFuture &&
    input.enable_payments &&
    !input.enable_dining_rsvp &&
    !input.enable_service_fee &&
    !input.enable_guest_tickets &&
    !input.enable_charity_donation
  ) {
    issues.push({
      key: "payments_no_items",
      message: "Payments enabled but no payable items configured",
      severity: "info",
    });
  }

  let status: ServiceReadiness["status"] = "ready";
  if (issues.some((i) => i.severity === "urgent")) status = "blocked";
  else if (issues.length > 0) status = "needs_attention";

  let label = "Ready";
  if (status === "blocked") label = `${issues.length} blocker${issues.length === 1 ? "" : "s"}`;
  else if (status === "needs_attention")
    label = `${issues.length} to do`;

  return { status, issues, label };
}

export const READINESS_CLASSES: Record<ServiceReadiness["status"], string> = {
  ready: "border-emerald-200 bg-emerald-50 text-emerald-900",
  needs_attention: "border-amber-200 bg-amber-50 text-amber-900",
  blocked: "border-red-200 bg-red-50 text-red-900",
};
