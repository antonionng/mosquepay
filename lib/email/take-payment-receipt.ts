// Receipt email for take-payment entries (cash, and optionally QR card).
//
// Used by the cash endpoint after the projector successfully writes the
// ledger row. Best-effort: caller catches errors so a missing RESEND_API_KEY
// or rate-limit failure never blocks the API response — the cash is already
// in the books, the email is a nicety on top.
//
// Kept deliberately small. Treasurer can re-send a richer statement from
// the payment detail page later; this one is the "thanks, you paid" SMS
// equivalent over email.

import * as db from "@/lib/db";
import { renderSimpleMessageEmail } from "@/lib/email/templates";
import { sendWithLog } from "@/lib/email/send-with-log";

export type TakePaymentReceiptArgs = {
  toEmail: string;
  toName: string;
  amountMajor: number;
  currency: string;
  category: string | null;
  reference: string | null;
  description: string | null;
  paymentMethod: "cash" | "card_qr";
  recordedByEmail: string | null;
  giftAidEligible: boolean;
  // Pass the mosque id so we can pull the display name into the receipt
  // header. Falls back to "your mosque" if the lookup fails.
  mosqueId?: string | null;
  /** Optional dedupe key (payment_id) so re-fires don't duplicate. */
  paymentId?: string | null;
  /** Itemised breakdown for a split payment (raffle + charity + dining on one
   *  entry). When present the receipt lists each line; otherwise it falls back
   *  to the single Category line. */
  lineItems?: ReadonlyArray<{ category: string; amount: number }> | null;
};

function methodLabel(method: TakePaymentReceiptArgs["paymentMethod"]) {
  return method === "cash" ? "Cash" : "Card (QR)";
}

function categoryLabel(category: string | null) {
  if (!category) return null;
  if (category === "general") return "General mosque funds";
  if (category === "charity") return "Charity";
  if (category === "dining") return "Dining";
  if (category === "raffle") return "Raffle";
  return category.charAt(0).toUpperCase() + category.slice(1);
}

export async function sendTakePaymentReceipt(args: TakePaymentReceiptArgs) {
  if (!args.toEmail) return { sent: false };

  let mosqueName = "your mosque";
  if (args.mosqueId) {
    try {
      const mosque = await db.getMosqueById(args.mosqueId);
      if (mosque?.name) mosqueName = mosque.name;
    } catch {
      // Non-fatal — fall back to generic copy.
    }
  }

  const currencyCode = (args.currency || "GBP").toUpperCase();
  const amountString = `${currencyCode} ${args.amountMajor.toFixed(2)}`;
  const hasLineItems = Array.isArray(args.lineItems) && args.lineItems.length > 0;

  const facts: string[] = [
    `Amount: ${amountString}`,
    `Method: ${methodLabel(args.paymentMethod)}`,
  ];
  // For a split payment the per-line breakdown carries the categories, so we
  // skip the single Category fact and add a breakdown block below instead.
  if (!hasLineItems) {
    const cat = categoryLabel(args.category);
    if (cat) facts.push(`Category: ${cat}`);
  }
  if (args.reference) facts.push(`Reference: ${args.reference}`);
  if (args.description) facts.push(`For: ${args.description}`);
  if (args.recordedByEmail) facts.push(`Recorded by: ${args.recordedByEmail}`);

  const paragraphs: string[] = [
    `We've recorded your payment to ${mosqueName}. This email confirms the entry; please keep it for your records.`,
    facts.join(" · "),
  ];
  if (hasLineItems) {
    const lines = (args.lineItems ?? []).map(
      (li) =>
        `• ${categoryLabel(li.category) ?? li.category} — ${currencyCode} ${li.amount.toFixed(2)}`,
    );
    paragraphs.push(["Breakdown:", ...lines].join("\n"));
  }
  // Gift Aid note fires when the payer has an active declaration AND there's
  // charity money on the entry — either a single charity payment or a charity
  // line inside a split basket.
  const hasCharity = hasLineItems
    ? (args.lineItems ?? []).some((li) => li.category === "charity")
    : args.category === "charity";
  if (args.giftAidEligible && hasCharity) {
    paragraphs.push(
      "Because you have an active Gift Aid declaration with this mosque, we've logged this donation against your reclaim batch automatically.",
    );
  }

  const html = renderSimpleMessageEmail({
    eyebrow: "Payment received",
    title: `Receipt: ${amountString}`,
    preview: `Receipt for ${amountString} to ${mosqueName}.`,
    greeting: `Dear ${args.toName},`,
    paragraphs,
    note:
      "If anything looks wrong on this receipt, please reply to this email or contact your mosque treasurer.",
  });

  const result = await sendWithLog({
    mosqueId: args.mosqueId ?? null,
    toEmail: args.toEmail,
    toName: args.toName,
    emailType: "payment_receipt_take_payment",
    entityType: "payment",
    entityId: args.paymentId ?? null,
    dedupeKey: args.paymentId,
    subject: `Receipt: ${amountString} to ${mosqueName}`,
    html,
    text: `${paragraphs.join("\n\n")}\n`,
    metadata: {
      amount_major: args.amountMajor,
      currency: args.currency,
      category: args.category,
      method: args.paymentMethod,
      gift_aid_eligible: args.giftAidEligible,
    },
  });

  return { sent: result.ok };
}
