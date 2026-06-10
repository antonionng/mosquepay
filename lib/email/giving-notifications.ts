// lib/email/giving-notifications.ts
//
// Member + treasurer email notifications driven by the giving
// subscription lifecycle and admin-side giving-method changes.
//
// Wiring map:
//
//   subscription.activated        member receipt + treasurer alert
//   subscription.invoice_paid     member receipt
//   subscription.invoice_failed   member nudge (every fail)
//                                 treasurer alert (1, 3, 5)
//   subscription.canceled         member confirmation + treasurer FYI
//   admin sets BACS               member: "we've recorded you as BACS"
//   admin marks paid in full      member: "your giving are settled"
//   admin waives fee              member: "your giving are waived"
//
// Each sender funnels through sendWithLog so the email_log table
// captures every send and the dedupe index protects against Mooov
// redelivers.

import {
  renderSimpleMessageEmail,
  renderNotificationEmail,
} from "@/lib/email/templates";
import { sendWithLog } from "@/lib/email/send-with-log";
import { resolveTreasurerRecipients } from "@/lib/email/recipients";
import type {
  GivingSchedule,
  Church,
  Member,
  MemberGiving,
} from "@/lib/db/types";

function formatGbp(amountMajor: number, currency = "GBP") {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amountMajor);
}

function formatDate(value: string | Date | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function siteUrl() {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://churchpay.co.uk"
  ).replace(/\/$/, "");
}

function memberPortalUrl() {
  return `${siteUrl()}/member/giving`;
}

function cadenceAdverb(cadence: string | null | undefined): string {
  if (cadence === "quarterly") return "every 3 months";
  return "every month";
}

// ---------------------------------------------------------------------------
// Subscription activated
// ---------------------------------------------------------------------------

export async function notifyGivingSubscriptionActivated({
  churchId,
  church,
  member,
  schedule,
  givingRecord,
  cycleAmount,
}: {
  churchId: string;
  church: Pick<Church, "id" | "name"> | null;
  member: Pick<Member, "id" | "email" | "full_name">;
  schedule: Pick<
    GivingSchedule,
    "id" | "cadence" | "mooov_subscription_id" | "next_charge_at"
  >;
  givingRecord: Pick<MemberGiving, "id" | "amount" | "currency">;
  cycleAmount: number;
}) {
  const churchName = church?.name ?? "your church";
  const currency = (givingRecord.currency || "GBP").toUpperCase();
  const cycleAdverb = cadenceAdverb(schedule.cadence);
  const cycleAmountStr = formatGbp(cycleAmount, currency);
  const annualStr = formatGbp(givingRecord.amount, currency);
  const dedupe =
    schedule.mooov_subscription_id ?? `sub_${schedule.id}_activated`;

  // ---------- Member ----------
  const memberHtml = renderSimpleMessageEmail({
    eyebrow: "Subscription active",
    title: `Your giving plan is live`,
    preview: `${cycleAmountStr} ${cycleAdverb} for ${churchName} giving.`,
    greeting: `Dear ${member.full_name},`,
    paragraphs: [
      `Thanks for setting up online giving with ${churchName}. Your subscription is active and the first cycle has been charged.`,
      `${cycleAmountStr} will be collected ${cycleAdverb}, covering ${annualStr} of giving for the year. You can pause, change, or cancel any time from your member portal.`,
    ],
    cta: { label: "Manage my giving", href: memberPortalUrl() },
    note: "If anything looks wrong, reply to this email or speak to your church treasurer.",
  });

  await sendWithLog({
    churchId,
    toEmail: member.email,
    toName: member.full_name,
    memberId: member.id,
    emailType: "giving_subscription_activated_member",
    entityType: "giving_schedule",
    entityId: schedule.id,
    dedupeKey: `member_${dedupe}`,
    subject: `Your ${churchName} giving subscription is active`,
    html: memberHtml,
    metadata: {
      schedule_id: schedule.id,
      cycle_amount: cycleAmount,
      cadence: schedule.cadence,
    },
  });

  // ---------- Treasurer ----------
  const treasurers = await resolveTreasurerRecipients(
    churchId,
    "giving_subscription_activated",
  );
  if (treasurers.length === 0) return;
  const treasurerHtml = renderNotificationEmail({
    eyebrow: "New giving subscription",
    title: `${member.full_name} just enrolled`,
    preview: `${cycleAmountStr} ${cycleAdverb} via online subscription.`,
    intro: `${member.full_name} (${member.email}) has set up a giving subscription with ${churchName}. The first cycle has cleared.`,
    rows: [
      { label: "Member", value: `${member.full_name} (${member.email})` },
      { label: "Cadence", value: cycleAdverb },
      { label: "Cycle amount", value: cycleAmountStr },
      { label: "Annual covered", value: annualStr },
      {
        label: "Next charge",
        value: schedule.next_charge_at
          ? formatDate(schedule.next_charge_at)
          : "TBD",
      },
    ],
    message:
      "View the full schedule, cycle history, or cancel from the admin giving panel.",
  });
  for (const t of treasurers) {
    await sendWithLog({
      churchId,
      toEmail: t.email,
      toName: t.fullName,
      adminUserId: t.adminUserId,
      emailType: "giving_subscription_activated_treasurer",
      entityType: "giving_schedule",
      entityId: schedule.id,
      dedupeKey: `treasurer_${t.email.toLowerCase()}_${dedupe}`,
      subject: `${member.full_name} enrolled in giving subscription`,
      html: treasurerHtml,
      metadata: {
        schedule_id: schedule.id,
        member_id: member.id,
        member_email: member.email,
      },
    });
  }
}

// ---------------------------------------------------------------------------
// Subscription cycle paid (per-cycle receipt to member)
// ---------------------------------------------------------------------------

export async function notifyGivingCyclePaid({
  churchId,
  church,
  member,
  schedule,
  amountMajor,
  currency,
  invoiceDedupeKey,
  cyclePaidNumber,
  cyclesTotal,
  nextChargeAt,
}: {
  churchId: string;
  church: Pick<Church, "id" | "name"> | null;
  member: Pick<Member, "id" | "email" | "full_name">;
  schedule: Pick<GivingSchedule, "id" | "cadence">;
  amountMajor: number;
  currency: string;
  /** Synthetic mooov_payment_id (sub_inv_<invoiceId>) used for dedupe. */
  invoiceDedupeKey: string;
  cyclePaidNumber: number;
  cyclesTotal: number | null;
  nextChargeAt: string | null;
}) {
  const churchName = church?.name ?? "your church";
  const amountStr = formatGbp(amountMajor, currency);
  const cycleAdverb = cadenceAdverb(schedule.cadence);

  const html = renderSimpleMessageEmail({
    eyebrow: "Cycle collected",
    title: `Receipt: ${amountStr}`,
    preview: `${amountStr} collected for your ${churchName} giving.`,
    greeting: `Dear ${member.full_name},`,
    paragraphs: [
      `We've collected ${amountStr} for your ${churchName} giving subscription.`,
      cyclesTotal != null
        ? `Cycle ${cyclePaidNumber} of ${cyclesTotal} for the giving year. Next charge: ${formatDate(nextChargeAt)}.`
        : `Next charge: ${formatDate(nextChargeAt)} (${cycleAdverb}).`,
    ],
    cta: { label: "View my giving", href: memberPortalUrl() },
    note: "Keep this email for your records — your full cycle history is also visible in the member portal.",
  });

  await sendWithLog({
    churchId,
    toEmail: member.email,
    toName: member.full_name,
    memberId: member.id,
    emailType: "giving_subscription_invoice_paid_member",
    entityType: "giving_schedule",
    entityId: schedule.id,
    dedupeKey: invoiceDedupeKey,
    subject: `Receipt: ${amountStr} to ${churchName}`,
    html,
    metadata: {
      schedule_id: schedule.id,
      amount_major: amountMajor,
      cycle_paid_number: cyclePaidNumber,
    },
  });
}

// ---------------------------------------------------------------------------
// Subscription invoice failed (member nudge + treasurer escalation)
// ---------------------------------------------------------------------------

export async function notifyGivingCycleFailed({
  churchId,
  church,
  member,
  schedule,
  consecutiveFailures,
  failureCode,
  failureCategory,
  invoiceDedupeKey,
}: {
  churchId: string;
  church: Pick<Church, "id" | "name"> | null;
  member: Pick<Member, "id" | "email" | "full_name">;
  schedule: Pick<GivingSchedule, "id" | "cadence" | "mooov_subscription_id">;
  consecutiveFailures: number;
  failureCode: string | null;
  failureCategory: string | null;
  /** Mooov invoice id derived dedupe key. */
  invoiceDedupeKey: string;
}) {
  const churchName = church?.name ?? "your church";

  // ---------- Member ----------
  const memberHtml = renderSimpleMessageEmail({
    eyebrow: "Payment problem",
    title: `Your giving payment failed`,
    preview: `${churchName} couldn't collect this cycle's giving.`,
    greeting: `Dear ${member.full_name},`,
    paragraphs: [
      `We tried to collect your latest ${churchName} giving cycle but the payment was declined by your bank.`,
      `This often resolves itself when you update the card on file or your bank releases a hold. We'll automatically retry; if three attempts fail in a row your subscription will be paused and your treasurer notified.`,
    ],
    cta: { label: "Update payment details", href: memberPortalUrl() },
    note: failureCode
      ? `Reason from your bank: ${failureCode}${failureCategory ? ` (${failureCategory})` : ""}.`
      : "If you'd like to pay another way (BACS, cheque, cash), reply to this email and your treasurer will set it up.",
  });
  await sendWithLog({
    churchId,
    toEmail: member.email,
    toName: member.full_name,
    memberId: member.id,
    emailType: "giving_subscription_invoice_failed_member",
    entityType: "giving_schedule",
    entityId: schedule.id,
    dedupeKey: `member_${invoiceDedupeKey}`,
    subject: `Action needed: ${churchName} giving payment failed`,
    html: memberHtml,
    metadata: {
      schedule_id: schedule.id,
      consecutive_failures: consecutiveFailures,
      failure_code: failureCode,
    },
  });

  // ---------- Treasurer escalation ----------
  // Threshold policy: 1st fail = quiet member nudge only, 3rd fail =
  // escalate, 5th fail = pause + escalate. We send to treasurers on
  // 1, 3, and 5 so they can intervene early (the design comment in
  // the webhook said the same thing).
  const escalateLevels = new Set([1, 3, 5]);
  if (!escalateLevels.has(consecutiveFailures)) return;
  const treasurers = await resolveTreasurerRecipients(
    churchId,
    "giving_subscription_invoice_failed",
  );
  if (treasurers.length === 0) return;

  const severity =
    consecutiveFailures >= 5
      ? "Subscription paused"
      : consecutiveFailures >= 3
        ? "Repeated failures"
        : "First failure";

  const treasurerHtml = renderNotificationEmail({
    eyebrow: severity,
    title: `${member.full_name}'s giving payment failed`,
    preview: `Failure ${consecutiveFailures}/5 — ${churchName} giving subscription.`,
    intro: `Mooov reported a failed cycle charge on ${member.full_name}'s subscription. The member has been emailed automatically.`,
    rows: [
      { label: "Member", value: `${member.full_name} (${member.email})` },
      {
        label: "Consecutive failures",
        value: `${consecutiveFailures} of 5 (pause threshold)`,
      },
      ...(failureCode
        ? [{ label: "Failure code", value: failureCode }]
        : []),
      ...(failureCategory
        ? [{ label: "Failure category", value: failureCategory }]
        : []),
    ],
    message:
      consecutiveFailures >= 5
        ? "The subscription is now paused. Open the admin giving panel to resume manually once the member confirms a fix."
        : "Open the admin giving panel to inspect cycle history or contact the member directly.",
  });
  for (const t of treasurers) {
    await sendWithLog({
      churchId,
      toEmail: t.email,
      toName: t.fullName,
      adminUserId: t.adminUserId,
      emailType: "giving_subscription_invoice_failed_treasurer",
      entityType: "giving_schedule",
      entityId: schedule.id,
      dedupeKey: `treasurer_${t.email.toLowerCase()}_${invoiceDedupeKey}`,
      subject: `${severity}: ${member.full_name} giving failed (${consecutiveFailures}/5)`,
      html: treasurerHtml,
      metadata: {
        schedule_id: schedule.id,
        member_id: member.id,
        consecutive_failures: consecutiveFailures,
        failure_code: failureCode,
      },
    });
  }
}

// ---------------------------------------------------------------------------
// Subscription canceled
// ---------------------------------------------------------------------------

export async function notifyGivingSubscriptionCanceled({
  churchId,
  church,
  member,
  schedule,
  cancelReason,
}: {
  churchId: string;
  church: Pick<Church, "id" | "name"> | null;
  member: Pick<Member, "id" | "email" | "full_name">;
  schedule: Pick<GivingSchedule, "id" | "mooov_subscription_id">;
  cancelReason: string | null;
}) {
  const churchName = church?.name ?? "your church";
  const dedupe =
    schedule.mooov_subscription_id ?? `sub_${schedule.id}_canceled`;

  const memberHtml = renderSimpleMessageEmail({
    eyebrow: "Subscription cancelled",
    title: `Your giving subscription has been cancelled`,
    preview: `${churchName} giving subscription cancelled.`,
    greeting: `Dear ${member.full_name},`,
    paragraphs: [
      `Your giving subscription with ${churchName} has been cancelled. Existing paid cycles stay paid; outstanding cycles flip to manual.`,
      `If this wasn't intentional, please contact your treasurer or set up a new plan from the member portal.`,
    ],
    cta: { label: "Manage my giving", href: memberPortalUrl() },
    note: cancelReason ? `Reason: ${cancelReason}` : undefined,
  });
  await sendWithLog({
    churchId,
    toEmail: member.email,
    toName: member.full_name,
    memberId: member.id,
    emailType: "giving_subscription_canceled_member",
    entityType: "giving_schedule",
    entityId: schedule.id,
    dedupeKey: `member_${dedupe}`,
    subject: `Your ${churchName} giving subscription was cancelled`,
    html: memberHtml,
    metadata: { schedule_id: schedule.id, cancel_reason: cancelReason },
  });

  const treasurers = await resolveTreasurerRecipients(
    churchId,
    "giving_subscription_canceled",
  );
  if (treasurers.length === 0) return;
  const treasurerHtml = renderNotificationEmail({
    eyebrow: "Subscription cancelled",
    title: `${member.full_name} cancelled`,
    preview: `${churchName} giving subscription cancelled.`,
    intro: `Their existing paid cycles stay paid; any outstanding instalments revert to manual.`,
    rows: [
      { label: "Member", value: `${member.full_name} (${member.email})` },
      ...(cancelReason ? [{ label: "Reason", value: cancelReason }] : []),
      { label: "Schedule", value: schedule.id },
    ],
  });
  for (const t of treasurers) {
    await sendWithLog({
      churchId,
      toEmail: t.email,
      toName: t.fullName,
      adminUserId: t.adminUserId,
      emailType: "giving_subscription_canceled_treasurer",
      entityType: "giving_schedule",
      entityId: schedule.id,
      dedupeKey: `treasurer_${t.email.toLowerCase()}_${dedupe}`,
      subject: `${member.full_name} cancelled their giving subscription`,
      html: treasurerHtml,
      metadata: { schedule_id: schedule.id, member_id: member.id },
    });
  }
}

// ---------------------------------------------------------------------------
// Admin set giving payment method (BACS / paid_in_full / fee_waived)
// ---------------------------------------------------------------------------

export async function notifyGivingMethodChanged({
  churchId,
  church,
  member,
  givingRecord,
  method,
  bacsMonthlyAmount,
  bacsReference,
  waiverReason,
  setBy,
  yearLabel,
}: {
  churchId: string;
  church: Pick<Church, "id" | "name"> | null;
  member: Pick<Member, "id" | "email" | "full_name">;
  givingRecord: Pick<MemberGiving, "id" | "amount" | "currency">;
  method: "online_subscription" | "bacs" | "paid_in_full" | "fee_waived";
  bacsMonthlyAmount: number | null;
  bacsReference: string | null;
  waiverReason: string | null;
  setBy: string | null;
  yearLabel: string | null;
}) {
  const churchName = church?.name ?? "your church";
  const annualStr = formatGbp(givingRecord.amount, givingRecord.currency || "GBP");
  const yearTail = yearLabel ? ` for ${yearLabel}` : "";

  let title = "Your giving record has been updated";
  let eyebrow = "Giving update";
  let paragraphs: string[] = [];
  let note: string | undefined;
  switch (method) {
    case "bacs":
      eyebrow = "BACS recorded";
      title = `You're set up as a BACS payer`;
      paragraphs = [
        `Your treasurer at ${churchName} has recorded that you pay this year's giving by BACS standing order${yearTail}.`,
        bacsMonthlyAmount != null
          ? `Agreed amount: ${formatGbp(bacsMonthlyAmount, "GBP")} per month, totalling ${annualStr} for the year.`
          : `Total for the year: ${annualStr}.`,
      ];
      if (bacsReference) {
        note = `Use this reference on your standing order: ${bacsReference}.`;
      }
      break;
    case "paid_in_full":
      eyebrow = "Paid in full";
      title = `Your giving are settled`;
      paragraphs = [
        `Your treasurer at ${churchName} has marked your giving${yearTail} as paid in full (${annualStr}).`,
        `Thank you — no further action is required for this year.`,
      ];
      break;
    case "fee_waived":
      eyebrow = "Fee waived";
      title = `Your giving have been waived`;
      paragraphs = [
        `Your treasurer at ${churchName} has waived your giving${yearTail}.`,
      ];
      if (waiverReason) {
        paragraphs.push(`Reason recorded: ${waiverReason}.`);
      }
      break;
    case "online_subscription":
      // Activation email is the better moment for this case; admins
      // tagging "online_subscription" without an actual subscription
      // is rare. Skip the member email to avoid noise.
      return;
  }

  const html = renderSimpleMessageEmail({
    eyebrow,
    title,
    preview: title,
    greeting: `Dear ${member.full_name},`,
    paragraphs,
    cta: { label: "View my giving", href: memberPortalUrl() },
    note,
  });

  await sendWithLog({
    churchId,
    toEmail: member.email,
    toName: member.full_name,
    memberId: member.id,
    emailType: `giving_method_changed_${method}_member`,
    entityType: "member_giving",
    entityId: givingRecord.id,
    // No dedupe — admin can legitimately re-fire (e.g. mark BACS,
    // change amount, mark BACS again).
    dedupeKey: null,
    subject: title,
    html,
    metadata: {
      method,
      bacs_monthly_amount: bacsMonthlyAmount,
      bacs_reference: bacsReference,
      waiver_reason: waiverReason,
      set_by: setBy,
    },
  });

  // Fan-out to the admin team so other officers see when one
  // treasurer / secretary tags a member off-platform. The receiving
  // role can mute the specific event in the Settings -> Notifications
  // tab if it's too chatty for them.
  const treasurers = await resolveTreasurerRecipients(
    churchId,
    `giving_method_changed_${method}`,
  );
  // Don't email the admin who just performed the action -- they
  // already know.
  const setByEmail = (setBy ?? "").toLowerCase();
  const adminRecipients = treasurers.filter(
    (t) => t.email.toLowerCase() !== setByEmail,
  );
  if (adminRecipients.length === 0) return;

  const adminTitle =
    method === "bacs"
      ? `${member.full_name} marked as BACS payer`
      : method === "paid_in_full"
        ? `${member.full_name} marked paid in full`
        : `${member.full_name}'s giving waived`;
  const adminRows: Array<{ label: string; value: string }> = [
    { label: "Member", value: `${member.full_name} (${member.email})` },
    {
      label: "Annual amount",
      value: annualStr + (yearLabel ? ` (${yearLabel})` : ""),
    },
  ];
  if (method === "bacs" && bacsMonthlyAmount != null) {
    adminRows.push({
      label: "Monthly amount",
      value: formatGbp(bacsMonthlyAmount, "GBP"),
    });
  }
  if (method === "bacs" && bacsReference) {
    adminRows.push({ label: "Reference", value: bacsReference });
  }
  if (method === "fee_waived" && waiverReason) {
    adminRows.push({ label: "Reason", value: waiverReason });
  }
  adminRows.push({ label: "Set by", value: setBy ?? "—" });

  const adminHtml = renderNotificationEmail({
    eyebrow: "Giving update",
    title: adminTitle,
    preview: adminTitle,
    intro: `Recorded against ${churchName} — keeping the admin team in sync.`,
    rows: adminRows,
    message:
      "Manage this member's giving method or undo from the admin members page.",
  });

  for (const t of adminRecipients) {
    await sendWithLog({
      churchId,
      toEmail: t.email,
      toName: t.fullName,
      adminUserId: t.adminUserId,
      emailType: `giving_method_changed_${method}_admin`,
      entityType: "member_giving",
      entityId: givingRecord.id,
      dedupeKey: null,
      subject: adminTitle,
      html: adminHtml,
      metadata: {
        method,
        member_id: member.id,
        bacs_monthly_amount: bacsMonthlyAmount,
        bacs_reference: bacsReference,
        waiver_reason: waiverReason,
        set_by: setBy,
      },
    });
  }
}

// Used by the receipts module too.
export const __email_helpers_for_test__ = {
  formatGbp,
  formatDate,
  cadenceAdverb,
};
