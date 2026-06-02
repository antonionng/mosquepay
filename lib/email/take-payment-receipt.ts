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
  // Pass the lodge id so we can pull the display name into the receipt
  // header. Falls back to "your lodge" if the lookup fails.
  lodgeId?: string | null;
  /** Optional dedupe key (payment_id) so re-fires don't duplicate. */
  paymentId?: string | null;
};

function methodLabel(method: TakePaymentReceiptArgs["paymentMethod"]) {
  return method === "cash" ? "Cash" : "Card (QR)";
}

function categoryLabel(category: string | null) {
  if (!category) return null;
  if (category === "general") return "General lodge funds";
  if (category === "charity") return "Charity";
  if (category === "dining") return "Dining";
  if (category === "raffle") return "Raffle";
  return category.charAt(0).toUpperCase() + category.slice(1);
}

export async function sendTakePaymentReceipt(args: TakePaymentReceiptArgs) {
  if (!args.toEmail) return { sent: false };

  let lodgeName = "your lodge";
  if (args.lodgeId) {
    try {
      const lodge = await db.getLodgeById(args.lodgeId);
      if (lodge?.name) lodgeName = lodge.name;
    } catch {
      // Non-fatal — fall back to generic copy.
    }
  }

  const amountString = `${(args.currency || "GBP").toUpperCase()} ${args.amountMajor.toFixed(2)}`;
  const facts: string[] = [
    `Amount: ${amountString}`,
    `Method: ${methodLabel(args.paymentMethod)}`,
  ];
  const cat = categoryLabel(args.category);
  if (cat) facts.push(`Category: ${cat}`);
  if (args.reference) facts.push(`Reference: ${args.reference}`);
  if (args.description) facts.push(`For: ${args.description}`);
  if (args.recordedByEmail) facts.push(`Recorded by: ${args.recordedByEmail}`);

  const paragraphs: string[] = [
    `We've recorded your payment to ${lodgeName}. This email confirms the entry; please keep it for your records.`,
    facts.join(" · "),
  ];
  if (args.giftAidEligible && args.category === "charity") {
    paragraphs.push(
      "Because you have an active Gift Aid declaration with this lodge, we've logged this donation against your reclaim batch automatically.",
    );
  }

  const html = renderSimpleMessageEmail({
    eyebrow: "Payment received",
    title: `Receipt: ${amountString}`,
    preview: `Receipt for ${amountString} to ${lodgeName}.`,
    greeting: `Dear ${args.toName},`,
    paragraphs,
    note:
      "If anything looks wrong on this receipt, please reply to this email or contact your lodge treasurer.",
  });

  const result = await sendWithLog({
    lodgeId: args.lodgeId ?? null,
    toEmail: args.toEmail,
    toName: args.toName,
    emailType: "payment_receipt_take_payment",
    entityType: "payment",
    entityId: args.paymentId ?? null,
    dedupeKey: args.paymentId,
    subject: `Receipt: ${amountString} to ${lodgeName}`,
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
