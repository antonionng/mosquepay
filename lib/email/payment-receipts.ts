// lib/email/payment-receipts.ts
//
// Receipts for "money cleared online" events: dues paid in full,
// donations, event RSVPs/dining payments, and standing-QR captures.
// All driven by Mooov's payment.captured webhook (after the per-intent
// projector has written public.payments + downstream rows).
//
// The projectors run regardless of email config so book-keeping is
// never blocked. This sender is best-effort on top.

import * as db from "@/lib/db";
import { renderSimpleMessageEmail } from "@/lib/email/templates";
import { sendWithLog } from "@/lib/email/send-with-log";
import type { Lodge } from "@/lib/db/types";

function formatGbp(amountMajor: number, currency = "GBP") {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amountMajor);
}

function siteUrl() {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://lodgepayments.co.uk"
  ).replace(/\/$/, "");
}

export type OnlineReceiptKind =
  | "dues_full"
  | "donation"
  | "event"
  | "standing_qr";

const KIND_COPY: Record<
  OnlineReceiptKind,
  { eyebrow: string; titlePrefix: string; cta: string; href: string }
> = {
  dues_full: {
    eyebrow: "Dues paid",
    titlePrefix: "Dues receipt",
    cta: "View my dues",
    href: "/member/dues",
  },
  donation: {
    eyebrow: "Donation received",
    titlePrefix: "Donation receipt",
    cta: "View charity",
    href: "/member",
  },
  event: {
    eyebrow: "Booking confirmed",
    titlePrefix: "Event receipt",
    cta: "View my events",
    href: "/member",
  },
  standing_qr: {
    eyebrow: "Payment received",
    titlePrefix: "Receipt",
    cta: "Open the lodge portal",
    href: "/member",
  },
};

/**
 * Send a payment receipt for any online (Mooov-routed) capture.
 *
 * Dedupe is on `mooov_payment_id` so Mooov redelivers and the
 * subscription-pass-through dual-emit (subscription.invoice_paid +
 * payment.captured for the same money) cannot trigger a second
 * receipt.
 */
export async function sendOnlinePaymentReceipt({
  lodgeId,
  lodge,
  toEmail,
  toName,
  memberId,
  amountMajor,
  currency,
  kind,
  description,
  mooovPaymentId,
  metadata,
}: {
  lodgeId: string;
  lodge: Pick<Lodge, "id" | "name"> | null;
  toEmail: string;
  toName: string | null;
  memberId: string | null;
  amountMajor: number;
  currency: string;
  kind: OnlineReceiptKind;
  description: string;
  mooovPaymentId: string;
  metadata?: Record<string, unknown>;
}) {
  if (!toEmail) return;

  let lodgeName = lodge?.name ?? null;
  if (!lodgeName) {
    try {
      const row = await db.getLodgeById(lodgeId);
      lodgeName = row?.name ?? "your lodge";
    } catch {
      lodgeName = "your lodge";
    }
  }

  const amountStr = formatGbp(amountMajor, currency);
  const copy = KIND_COPY[kind];
  const title = `${copy.titlePrefix}: ${amountStr}`;
  const html = renderSimpleMessageEmail({
    eyebrow: copy.eyebrow,
    title,
    preview: `${amountStr} to ${lodgeName}.`,
    greeting: `Dear ${toName ?? "Brother"},`,
    paragraphs: [
      `We've received your payment of ${amountStr} to ${lodgeName}.`,
      description,
    ],
    cta: { label: copy.cta, href: `${siteUrl()}${copy.href}` },
    note: "Keep this email for your records — your full history is also visible in the member portal.",
  });

  await sendWithLog({
    lodgeId,
    toEmail,
    toName,
    memberId,
    emailType: `payment_receipt_${kind}`,
    entityType: "payment",
    entityId: mooovPaymentId,
    dedupeKey: mooovPaymentId,
    subject: `${copy.titlePrefix}: ${amountStr} to ${lodgeName}`,
    html,
    metadata: {
      ...(metadata ?? {}),
      amount_major: amountMajor,
      currency,
      kind,
    },
  });
}
