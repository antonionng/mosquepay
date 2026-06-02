// lib/email/dues-notifications.ts
//
// Member + treasurer email notifications driven by the dues
// subscription lifecycle and admin-side dues-method changes.
//
// Wiring map:
//
//   subscription.activated        member receipt + treasurer alert
//   subscription.invoice_paid     member receipt
//   subscription.invoice_failed   member nudge (every fail)
//                                 treasurer alert (1, 3, 5)
//   subscription.canceled         member confirmation + treasurer FYI
//   admin sets BACS               member: "we've recorded you as BACS"
//   admin marks paid in full      member: "your dues are settled"
//   admin waives fee              member: "your dues are waived"
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
  DuesSchedule,
  Lodge,
  Member,
  MemberDues,
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
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://lodgepayments.co.uk"
  ).replace(/\/$/, "");
}

function memberPortalUrl() {
  return `${siteUrl()}/member/dues`;
}

function cadenceAdverb(cadence: string | null | undefined): string {
  if (cadence === "quarterly") return "every 3 months";
  return "every month";
}

// ---------------------------------------------------------------------------
// Subscription activated
// ---------------------------------------------------------------------------

export async function notifyDuesSubscriptionActivated({
  lodgeId,
  lodge,
  member,
  schedule,
  duesRecord,
  cycleAmount,
}: {
  lodgeId: string;
  lodge: Pick<Lodge, "id" | "name"> | null;
  member: Pick<Member, "id" | "email" | "full_name">;
  schedule: Pick<
    DuesSchedule,
    "id" | "cadence" | "mooov_subscription_id" | "next_charge_at"
  >;
  duesRecord: Pick<MemberDues, "id" | "amount" | "currency">;
  cycleAmount: number;
}) {
  const lodgeName = lodge?.name ?? "your lodge";
  const currency = (duesRecord.currency || "GBP").toUpperCase();
  const cycleAdverb = cadenceAdverb(schedule.cadence);
  const cycleAmountStr = formatGbp(cycleAmount, currency);
  const annualStr = formatGbp(duesRecord.amount, currency);
  const dedupe =
    schedule.mooov_subscription_id ?? `sub_${schedule.id}_activated`;

  // ---------- Member ----------
  const memberHtml = renderSimpleMessageEmail({
    eyebrow: "Subscription active",
    title: `Your dues plan is live`,
    preview: `${cycleAmountStr} ${cycleAdverb} for ${lodgeName} dues.`,
    greeting: `Dear ${member.full_name},`,
    paragraphs: [
      `Thanks for setting up online dues with ${lodgeName}. Your subscription is active and the first cycle has been charged.`,
      `${cycleAmountStr} will be collected ${cycleAdverb}, covering ${annualStr} of dues for the year. You can pause, change, or cancel any time from your member portal.`,
    ],
    cta: { label: "Manage my dues", href: memberPortalUrl() },
    note: "If anything looks wrong, reply to this email or speak to your lodge treasurer.",
  });

  await sendWithLog({
    lodgeId,
    toEmail: member.email,
    toName: member.full_name,
    memberId: member.id,
    emailType: "dues_subscription_activated_member",
    entityType: "dues_schedule",
    entityId: schedule.id,
    dedupeKey: `member_${dedupe}`,
    subject: `Your ${lodgeName} dues subscription is active`,
    html: memberHtml,
    metadata: {
      schedule_id: schedule.id,
      cycle_amount: cycleAmount,
      cadence: schedule.cadence,
    },
  });

  // ---------- Treasurer ----------
  const treasurers = await resolveTreasurerRecipients(
    lodgeId,
    "dues_subscription_activated",
  );
  if (treasurers.length === 0) return;
  const treasurerHtml = renderNotificationEmail({
    eyebrow: "New dues subscription",
    title: `${member.full_name} just enrolled`,
    preview: `${cycleAmountStr} ${cycleAdverb} via online subscription.`,
    intro: `${member.full_name} (${member.email}) has set up a dues subscription with ${lodgeName}. The first cycle has cleared.`,
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
      "View the full schedule, cycle history, or cancel from the admin dues panel.",
  });
  for (const t of treasurers) {
    await sendWithLog({
      lodgeId,
      toEmail: t.email,
      toName: t.fullName,
      adminUserId: t.adminUserId,
      emailType: "dues_subscription_activated_treasurer",
      entityType: "dues_schedule",
      entityId: schedule.id,
      dedupeKey: `treasurer_${t.email.toLowerCase()}_${dedupe}`,
      subject: `${member.full_name} enrolled in dues subscription`,
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

export async function notifyDuesCyclePaid({
  lodgeId,
  lodge,
  member,
  schedule,
  amountMajor,
  currency,
  invoiceDedupeKey,
  cyclePaidNumber,
  cyclesTotal,
  nextChargeAt,
}: {
  lodgeId: string;
  lodge: Pick<Lodge, "id" | "name"> | null;
  member: Pick<Member, "id" | "email" | "full_name">;
  schedule: Pick<DuesSchedule, "id" | "cadence">;
  amountMajor: number;
  currency: string;
  /** Synthetic mooov_payment_id (sub_inv_<invoiceId>) used for dedupe. */
  invoiceDedupeKey: string;
  cyclePaidNumber: number;
  cyclesTotal: number | null;
  nextChargeAt: string | null;
}) {
  const lodgeName = lodge?.name ?? "your lodge";
  const amountStr = formatGbp(amountMajor, currency);
  const cycleAdverb = cadenceAdverb(schedule.cadence);

  const html = renderSimpleMessageEmail({
    eyebrow: "Cycle collected",
    title: `Receipt: ${amountStr}`,
    preview: `${amountStr} collected for your ${lodgeName} dues.`,
    greeting: `Dear ${member.full_name},`,
    paragraphs: [
      `We've collected ${amountStr} for your ${lodgeName} dues subscription.`,
      cyclesTotal != null
        ? `Cycle ${cyclePaidNumber} of ${cyclesTotal} for the masonic year. Next charge: ${formatDate(nextChargeAt)}.`
        : `Next charge: ${formatDate(nextChargeAt)} (${cycleAdverb}).`,
    ],
    cta: { label: "View my dues", href: memberPortalUrl() },
    note: "Keep this email for your records — your full cycle history is also visible in the member portal.",
  });

  await sendWithLog({
    lodgeId,
    toEmail: member.email,
    toName: member.full_name,
    memberId: member.id,
    emailType: "dues_subscription_invoice_paid_member",
    entityType: "dues_schedule",
    entityId: schedule.id,
    dedupeKey: invoiceDedupeKey,
    subject: `Receipt: ${amountStr} to ${lodgeName}`,
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

export async function notifyDuesCycleFailed({
  lodgeId,
  lodge,
  member,
  schedule,
  consecutiveFailures,
  failureCode,
  failureCategory,
  invoiceDedupeKey,
}: {
  lodgeId: string;
  lodge: Pick<Lodge, "id" | "name"> | null;
  member: Pick<Member, "id" | "email" | "full_name">;
  schedule: Pick<DuesSchedule, "id" | "cadence" | "mooov_subscription_id">;
  consecutiveFailures: number;
  failureCode: string | null;
  failureCategory: string | null;
  /** Mooov invoice id derived dedupe key. */
  invoiceDedupeKey: string;
}) {
  const lodgeName = lodge?.name ?? "your lodge";

  // ---------- Member ----------
  const memberHtml = renderSimpleMessageEmail({
    eyebrow: "Payment problem",
    title: `Your dues payment failed`,
    preview: `${lodgeName} couldn't collect this cycle's dues.`,
    greeting: `Dear ${member.full_name},`,
    paragraphs: [
      `We tried to collect your latest ${lodgeName} dues cycle but the payment was declined by your bank.`,
      `This often resolves itself when you update the card on file or your bank releases a hold. We'll automatically retry; if three attempts fail in a row your subscription will be paused and your treasurer notified.`,
    ],
    cta: { label: "Update payment details", href: memberPortalUrl() },
    note: failureCode
      ? `Reason from your bank: ${failureCode}${failureCategory ? ` (${failureCategory})` : ""}.`
      : "If you'd like to pay another way (BACS, cheque, cash), reply to this email and your treasurer will set it up.",
  });
  await sendWithLog({
    lodgeId,
    toEmail: member.email,
    toName: member.full_name,
    memberId: member.id,
    emailType: "dues_subscription_invoice_failed_member",
    entityType: "dues_schedule",
    entityId: schedule.id,
    dedupeKey: `member_${invoiceDedupeKey}`,
    subject: `Action needed: ${lodgeName} dues payment failed`,
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
    lodgeId,
    "dues_subscription_invoice_failed",
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
    title: `${member.full_name}'s dues payment failed`,
    preview: `Failure ${consecutiveFailures}/5 — ${lodgeName} dues subscription.`,
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
        ? "The subscription is now paused. Open the admin dues panel to resume manually once the member confirms a fix."
        : "Open the admin dues panel to inspect cycle history or contact the member directly.",
  });
  for (const t of treasurers) {
    await sendWithLog({
      lodgeId,
      toEmail: t.email,
      toName: t.fullName,
      adminUserId: t.adminUserId,
      emailType: "dues_subscription_invoice_failed_treasurer",
      entityType: "dues_schedule",
      entityId: schedule.id,
      dedupeKey: `treasurer_${t.email.toLowerCase()}_${invoiceDedupeKey}`,
      subject: `${severity}: ${member.full_name} dues failed (${consecutiveFailures}/5)`,
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

export async function notifyDuesSubscriptionCanceled({
  lodgeId,
  lodge,
  member,
  schedule,
  cancelReason,
}: {
  lodgeId: string;
  lodge: Pick<Lodge, "id" | "name"> | null;
  member: Pick<Member, "id" | "email" | "full_name">;
  schedule: Pick<DuesSchedule, "id" | "mooov_subscription_id">;
  cancelReason: string | null;
}) {
  const lodgeName = lodge?.name ?? "your lodge";
  const dedupe =
    schedule.mooov_subscription_id ?? `sub_${schedule.id}_canceled`;

  const memberHtml = renderSimpleMessageEmail({
    eyebrow: "Subscription cancelled",
    title: `Your dues subscription has been cancelled`,
    preview: `${lodgeName} dues subscription cancelled.`,
    greeting: `Dear ${member.full_name},`,
    paragraphs: [
      `Your dues subscription with ${lodgeName} has been cancelled. Existing paid cycles stay paid; outstanding cycles flip to manual.`,
      `If this wasn't intentional, please contact your treasurer or set up a new plan from the member portal.`,
    ],
    cta: { label: "Manage my dues", href: memberPortalUrl() },
    note: cancelReason ? `Reason: ${cancelReason}` : undefined,
  });
  await sendWithLog({
    lodgeId,
    toEmail: member.email,
    toName: member.full_name,
    memberId: member.id,
    emailType: "dues_subscription_canceled_member",
    entityType: "dues_schedule",
    entityId: schedule.id,
    dedupeKey: `member_${dedupe}`,
    subject: `Your ${lodgeName} dues subscription was cancelled`,
    html: memberHtml,
    metadata: { schedule_id: schedule.id, cancel_reason: cancelReason },
  });

  const treasurers = await resolveTreasurerRecipients(
    lodgeId,
    "dues_subscription_canceled",
  );
  if (treasurers.length === 0) return;
  const treasurerHtml = renderNotificationEmail({
    eyebrow: "Subscription cancelled",
    title: `${member.full_name} cancelled`,
    preview: `${lodgeName} dues subscription cancelled.`,
    intro: `Their existing paid cycles stay paid; any outstanding instalments revert to manual.`,
    rows: [
      { label: "Member", value: `${member.full_name} (${member.email})` },
      ...(cancelReason ? [{ label: "Reason", value: cancelReason }] : []),
      { label: "Schedule", value: schedule.id },
    ],
  });
  for (const t of treasurers) {
    await sendWithLog({
      lodgeId,
      toEmail: t.email,
      toName: t.fullName,
      adminUserId: t.adminUserId,
      emailType: "dues_subscription_canceled_treasurer",
      entityType: "dues_schedule",
      entityId: schedule.id,
      dedupeKey: `treasurer_${t.email.toLowerCase()}_${dedupe}`,
      subject: `${member.full_name} cancelled their dues subscription`,
      html: treasurerHtml,
      metadata: { schedule_id: schedule.id, member_id: member.id },
    });
  }
}

// ---------------------------------------------------------------------------
// Admin set dues payment method (BACS / paid_in_full / fee_waived)
// ---------------------------------------------------------------------------

export async function notifyDuesMethodChanged({
  lodgeId,
  lodge,
  member,
  duesRecord,
  method,
  bacsMonthlyAmount,
  bacsReference,
  waiverReason,
  setBy,
  yearLabel,
}: {
  lodgeId: string;
  lodge: Pick<Lodge, "id" | "name"> | null;
  member: Pick<Member, "id" | "email" | "full_name">;
  duesRecord: Pick<MemberDues, "id" | "amount" | "currency">;
  method: "online_subscription" | "bacs" | "paid_in_full" | "fee_waived";
  bacsMonthlyAmount: number | null;
  bacsReference: string | null;
  waiverReason: string | null;
  setBy: string | null;
  yearLabel: string | null;
}) {
  const lodgeName = lodge?.name ?? "your lodge";
  const annualStr = formatGbp(duesRecord.amount, duesRecord.currency || "GBP");
  const yearTail = yearLabel ? ` for ${yearLabel}` : "";

  let title = "Your dues record has been updated";
  let eyebrow = "Dues update";
  let paragraphs: string[] = [];
  let note: string | undefined;
  switch (method) {
    case "bacs":
      eyebrow = "BACS recorded";
      title = `You're set up as a BACS payer`;
      paragraphs = [
        `Your treasurer at ${lodgeName} has recorded that you pay this year's dues by BACS standing order${yearTail}.`,
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
      title = `Your dues are settled`;
      paragraphs = [
        `Your treasurer at ${lodgeName} has marked your dues${yearTail} as paid in full (${annualStr}).`,
        `Thank you — no further action is required for this year.`,
      ];
      break;
    case "fee_waived":
      eyebrow = "Fee waived";
      title = `Your dues have been waived`;
      paragraphs = [
        `Your treasurer at ${lodgeName} has waived your dues${yearTail}.`,
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
    cta: { label: "View my dues", href: memberPortalUrl() },
    note,
  });

  await sendWithLog({
    lodgeId,
    toEmail: member.email,
    toName: member.full_name,
    memberId: member.id,
    emailType: `dues_method_changed_${method}_member`,
    entityType: "member_dues",
    entityId: duesRecord.id,
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
    lodgeId,
    `dues_method_changed_${method}`,
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
        : `${member.full_name}'s dues waived`;
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
    eyebrow: "Dues update",
    title: adminTitle,
    preview: adminTitle,
    intro: `Recorded against ${lodgeName} — keeping the admin team in sync.`,
    rows: adminRows,
    message:
      "Manage this member's dues method or undo from the admin members page.",
  });

  for (const t of adminRecipients) {
    await sendWithLog({
      lodgeId,
      toEmail: t.email,
      toName: t.fullName,
      adminUserId: t.adminUserId,
      emailType: `dues_method_changed_${method}_admin`,
      entityType: "member_dues",
      entityId: duesRecord.id,
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
