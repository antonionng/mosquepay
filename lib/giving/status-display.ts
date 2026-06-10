// lib/giving/status-display.ts
//
// Shared display copy + colours for giving_schedules.status. Used by both
// the member-portal status card (app/(member)/member/giving) and the
// admin views (admin/members/[id], admin/giving/schedules,
// admin/treasurer). Keep audience copy DIFFERENT — these helpers only
// own the badge label, swatch, and pluralisable counts. Member-facing
// CTAs ("Verify card") and admin-facing CTAs ("Cancel subscription")
// stay in their own components.

import type { GivingScheduleStatus } from "@/lib/db/types";

export interface ScheduleStatusDisplay {
  label: string;
  // Tailwind variant tags. Matches our existing Badge variant prop +
  // accent border classes used by the portal card.
  badgeVariant: "success" | "warning" | "default" | "destructive";
  accentClasses: string;
  // Treasurer-facing one-liner explaining the status.
  description: string;
  // True when the status implies someone (member or treasurer) needs
  // to take action. Drives banners, sort order on the schedules list.
  needsAttention: boolean;
}

const TABLE: Record<GivingScheduleStatus, ScheduleStatusDisplay> = {
  pending: {
    label: "Awaiting setup",
    badgeVariant: "default",
    accentClasses: "border-slate-200 bg-slate-50",
    description:
      "Member has minted an enrolment intent but the first charge hasn't completed yet.",
    needsAttention: false,
  },
  active: {
    label: "Active",
    badgeVariant: "success",
    accentClasses: "border-emerald-200 bg-emerald-50/40",
    description: "Subscription is healthy. Cron is charging on cadence.",
    needsAttention: false,
  },
  action_required: {
    label: "Action needed",
    badgeVariant: "warning",
    accentClasses: "border-amber-200 bg-amber-50/50",
    description:
      "Member's bank requested 3DS verification. They have a resume link until the cron retries.",
    needsAttention: true,
  },
  past_due: {
    label: "Past due",
    badgeVariant: "warning",
    accentClasses: "border-amber-200 bg-amber-50/50",
    description:
      "Most recent charge failed. Cron will retry on the next tick; member sees a dunning notice.",
    needsAttention: true,
  },
  paused: {
    label: "Paused",
    badgeVariant: "default",
    accentClasses: "border-slate-300 bg-slate-50",
    description:
      "Too many consecutive failures. Cron has stopped charging until manually resumed.",
    needsAttention: true,
  },
  cancelled: {
    label: "Cancelled",
    badgeVariant: "destructive",
    accentClasses: "border-rose-200 bg-rose-50/40",
    description:
      "Member or treasurer cancelled this schedule. No further charges.",
    needsAttention: false,
  },
  completed: {
    label: "Completed",
    badgeVariant: "default",
    accentClasses: "border-slate-200 bg-slate-50",
    description: "All cycles paid for the giving year.",
    needsAttention: false,
  },
  active_stripe: {
    label: "Active (Stripe Subs)",
    badgeVariant: "success",
    accentClasses: "border-emerald-200 bg-emerald-50/40",
    description:
      "Migrated to Stripe Subscription pass-through. Cron is no longer driving cycles.",
    needsAttention: false,
  },
};

export function getScheduleStatusDisplay(
  status: GivingScheduleStatus
): ScheduleStatusDisplay {
  return TABLE[status] ?? TABLE.pending;
}

// Sort order for the admin schedules list: needs-attention first, then
// active, then everything else by created_at desc.
export const STATUS_SORT_PRIORITY: Record<GivingScheduleStatus, number> = {
  action_required: 0,
  past_due: 1,
  paused: 2,
  pending: 3,
  active: 4,
  active_stripe: 5,
  completed: 6,
  cancelled: 7,
};
