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
import {
  splitAmountByCategory,
  splitAmountByLineItems,
  type LineItemInput,
} from "./categorize";

export type ProjectCapturedInput = {
  lodgeId: string;
  mooovPaymentId: string;
  amountMajor: number;
  currency: string;
  category: string | null;
  // Optional itemised basket. When present and non-empty, the ledger sub-
  // amount split is computed per line item (raffle + charity + dining on one
  // payment) instead of dumping the whole total into `category`. The full
  // total still lands in total_amount; charity lines still log a donation.
  lineItems?: LineItemInput[] | null;
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
  const hasLineItems = Array.isArray(input.lineItems) && input.lineItems.length > 0;
  const splits = hasLineItems
    ? splitAmountByLineItems(input.lineItems as LineItemInput[])
    : splitAmountByCategory(input.amountMajor, input.category);

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
    meeting_fee_amount: splits.meeting_fee_amount,
    guest_ticket_amount: splits.guest_ticket_amount,
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

  // Record charity income as a donation row so the per-meeting Gift Aid
  // panel + close batch can see it. We do this for EVERY charity entry,
  // not just payers who already have a declaration on file: many lodges
  // collect on the night and upload signed declarations (or import donor
  // profiles) later. The claim batcher matches donation -> declaration by
  // email at close time (lib/gift-aid/eligible.ts), so an email-bearing
  // donation recorded now becomes reclaimable the moment a matching
  // declaration is added -- no re-tagging required.
  //
  // The row is linked to input.eventId so it rolls up to the meeting's
  // "Charity income on file" figure and is swept into the per-meeting Gift
  // Aid batch on close. Anonymous cash (no payer email) is still recorded
  // as charity income with gift_aid_status='unknown' so it shows on the
  // collection (and counts toward GASDS), it just can't be GA-reclaimed.
  // Log a donation whenever any charity money is present. For a single-
  // category payment this is exactly the old "category === charity" rule
  // (charity_amount is only > 0 then); for an itemised basket it picks up
  // the charity line even when the basket also contains raffle/dining.
  let donationId: string | null = null;
  if (splits.charity_amount > 0) {
    const hasDeclaration = Boolean(input.giftAidDeclarationId);
    const giftAidStatus = hasDeclaration
      ? "declared"
      : input.payerEmail
        ? "eligible"
        : "unknown";
    try {
      const donation = await db.addDonation(input.lodgeId, {
        event_id: input.eventId,
        payment_id: payment.id,
        donor_name: input.payerName,
        donor_email: input.payerEmail ?? "",
        amount: splits.charity_amount,
        currency: currency.toLowerCase(),
        source:
          input.paymentMethod === "cash"
            ? "in_person_take_payment_cash"
            : "in_person_take_payment",
        status: "completed",
        gift_aid_declaration_id: input.giftAidDeclarationId,
        gift_aid_status: giftAidStatus,
        gift_aid_eligible_amount: hasDeclaration ? splits.charity_amount : 0,
      });
      donationId = donation?.id ?? null;
    } catch (err) {
      console.error(
        "project-captured: charity donation insert failed (non-fatal)",
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
