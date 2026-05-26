// Project a captured take-payment (QR or cash) into public.payments +
// optionally public.donations.
//
// This is the single point that writes the projected ledger row for any
// take-payment intent, used by:
//   * The Mooov webhook handler when a card_qr payment captures.
//   * The /api/admin/take-payment/cash endpoint when an admin records cash.
//
// Both paths share the same attribution rules (member name/email, Gift Aid
// auto-logging for charity + active declaration) so the projection stays
// consistent regardless of how the money arrived.

import * as db from "@/lib/db";
import { splitAmountByCategory, isCharityCategory } from "./categorize";

export type ProjectCapturedInput = {
  lodgeId: string;
  mooovPaymentId: string;
  amountMajor: number;
  currency: string;
  category: string | null;
  reference: string | null;
  eventId: string | null;
  charityName: string | null;
  // Unified payer attribution. payerName/email/phone work for both members
  // and guests; member/guest ids land in the projected metadata so the row
  // can deep-link back to whichever directory the payer came from.
  payerName: string | null;
  payerEmail: string | null;
  memberId?: string | null;
  guestId?: string | null;
  giftAidDeclarationId: string | null;
  giftAidEligible: boolean;
  completedAt?: string;
  // Source-specific flags for the public.payments row.
  paymentMethod: "card_qr" | "cash";
  recordedByEmail?: string | null;
  paymentMethodNote?: string | null;
};

export type ProjectCapturedResult = {
  paymentId: string;
  donationId: string | null;
  alreadyExisted: boolean;
};

export async function projectTakePaymentCaptured(
  input: ProjectCapturedInput,
): Promise<ProjectCapturedResult> {
  // Idempotency: if a payments row already exists for this mooov_payment_id
  // (webhook redelivery, double-tap on cash submit) we return the existing
  // row and skip the donation insert too. Cash callers should additionally
  // dedupe at the payment_attempts layer via idempotency_key.
  const existing = await db.getPaymentByMooovId(input.mooovPaymentId);
  if (existing) {
    return {
      paymentId: existing.id,
      donationId: null,
      alreadyExisted: true,
    };
  }

  const completedAt = input.completedAt ?? new Date().toISOString();
  const currency = (input.currency || "GBP").toUpperCase();
  const splits = splitAmountByCategory(input.amountMajor, input.category);

  const payment = await db.addPayment(input.lodgeId, {
    rsvp_id: null,
    event_id: input.eventId,
    user_email: input.payerEmail ?? "",
    user_name: input.payerName ?? input.reference ?? null,
    stripe_payment_intent_id: null,
    stripe_charge_id: null,
    stripe_customer_id: null,
    mooov_payment_id: input.mooovPaymentId,
    dining_amount: splits.dining_amount,
    charity_amount: splits.charity_amount,
    raffle_amount: splits.raffle_amount,
    meeting_fee_amount: 0,
    guest_ticket_amount: 0,
    total_amount: input.amountMajor,
    currency,
    charity_name: input.charityName,
    status: "succeeded",
    refund_amount: 0,
    refund_reason: null,
    payment_method: input.paymentMethod,
    payment_method_note: input.paymentMethodNote ?? null,
    recorded_by_email: input.recordedByEmail ?? null,
    completed_at: completedAt,
  });

  // Auto-log Gift Aid for charity entries when the attributed member has an
  // active declaration on this lodge. Mirrors the QR path exactly so cash
  // donors don't fall off the GA reclaim batch just because they happened
  // to bring notes instead of a card.
  let donationId: string | null = null;
  if (
    isCharityCategory(input.category) &&
    input.giftAidEligible &&
    input.giftAidDeclarationId &&
    input.payerEmail &&
    input.amountMajor > 0
  ) {
    try {
      const donation = await db.addDonation(input.lodgeId, {
        event_id: null,
        payment_id: payment.id,
        donor_name: input.payerName,
        donor_email: input.payerEmail,
        amount: input.amountMajor,
        currency: currency.toLowerCase(),
        source:
          input.paymentMethod === "cash"
            ? "in_person_take_payment_cash"
            : "in_person_take_payment",
        status: "completed",
        gift_aid_declaration_id: input.giftAidDeclarationId,
      });
      donationId = donation?.id ?? null;
    } catch (err) {
      console.error(
        "project-captured: gift aid donation insert failed (non-fatal)",
        {
          payment_id: payment.id,
          mooov_payment_id: input.mooovPaymentId,
          message: err instanceof Error ? err.message : String(err),
        },
      );
    }
  }

  return {
    paymentId: payment.id,
    donationId,
    alreadyExisted: false,
  };
}
