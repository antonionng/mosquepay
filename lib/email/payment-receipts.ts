// lib/email/payment-receipts.ts
//
// Receipts for "money cleared online" events: giving paid in full,
// donations, event RSVPs/dining payments, and standing-QR captures.
// All driven by Mooov's payment.captured webhook (after the per-intent
// projector has written public.payments + downstream rows).
//
// The projectors run regardless of email config so book-keeping is
// never blocked. This sender is best-effort on top.

import * as db from "@/lib/db";
import { renderSimpleMessageEmail } from "@/lib/email/templates";
import { sendWithLog } from "@/lib/email/send-with-log";
import type { Church } from "@/lib/db/types";

function formatGbp(amountMajor: number, currency = "GBP") {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amountMajor);
}

function siteUrl() {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://churchpay.co.uk"
  ).replace(/\/$/, "");
}

export type OnlineReceiptKind =
  | "giving_full"
  | "donation"
  | "event"
  | "standing_qr";

const KIND_COPY: Record<
  OnlineReceiptKind,
  { eyebrow: string; titlePrefix: string; cta: string; href: string }
> = {
  giving_full: {
    eyebrow: "Giving paid",
    titlePrefix: "Giving receipt",
    cta: "View my giving",
    href: "/member/giving",
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
    cta: "Open the church portal",
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
  churchId,
  church,
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
  churchId: string;
  church: Pick<Church, "id" | "name"> | null;
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

  let churchName = church?.name ?? null;
  if (!churchName) {
    try {
      const row = await db.getChurchById(churchId);
      churchName = row?.name ?? "your church";
    } catch {
      churchName = "your church";
    }
  }

  const amountStr = formatGbp(amountMajor, currency);
  const copy = KIND_COPY[kind];
  const title = `${copy.titlePrefix}: ${amountStr}`;
  const html = renderSimpleMessageEmail({
    eyebrow: copy.eyebrow,
    title,
    preview: `${amountStr} to ${churchName}.`,
    greeting: `Dear ${toName ?? "Member"},`,
    paragraphs: [
      `We've received your payment of ${amountStr} to ${churchName}.`,
      description,
    ],
    cta: { label: copy.cta, href: `${siteUrl()}${copy.href}` },
    note: "Keep this email for your records — your full history is also visible in the member portal.",
  });

  await sendWithLog({
    churchId,
    toEmail,
    toName,
    memberId,
    emailType: `payment_receipt_${kind}`,
    entityType: "payment",
    entityId: mooovPaymentId,
    dedupeKey: mooovPaymentId,
    subject: `${copy.titlePrefix}: ${amountStr} to ${churchName}`,
    html,
    metadata: {
      ...(metadata ?? {}),
      amount_major: amountMajor,
      currency,
      kind,
    },
  });
}
