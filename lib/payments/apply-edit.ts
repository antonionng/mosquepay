// Shared "edit a payment record (not the amount)" logic.
//
// Used by the single-payment PATCH endpoint and the service bulk-associate
// endpoint so both recategorise + (re)link to a service identically, and both
// keep the charity donation / Gift Aid ledger in step.
//
// Rules:
//   - total_amount, refunds and status are NEVER changed here.
//   - Recategorising re-splits total_amount into the chosen category bucket.
//   - Charity sync: to-charity mints a linked donation (auto-linking an active
//     declaration); still-charity updates amount + service link; away-from-
//     charity removes the auto-created donation.
//   - We refuse to reduce/remove a donation that's already in a Gift Aid claim
//     batch so we never diverge from what was filed.

import * as db from "@/lib/db";
import type { Payment } from "@/lib/db/types";
import { splitAmountByCategory } from "@/lib/take-payment/categorize";

export type DonationAction = "created" | "updated" | "deleted" | "none";

export type ApplyPaymentEditOptions = {
  /** When provided, recategorise: re-split total_amount into this category. */
  category?: string;
  /** When true, set event_id to `eventId` (which may be null to detach). */
  changeEvent?: boolean;
  /** The validated event id to link, or null to detach. Caller validates it
   *  belongs to the mosque. */
  eventId?: string | null;
};

export type ApplyPaymentEditResult =
  | { ok: true; donationAction: DonationAction; updated: Payment }
  | { ok: false; status: number; error: string };

export async function applyPaymentEdit(
  mosqueId: string,
  payment: Payment,
  opts: ApplyPaymentEditOptions,
): Promise<ApplyPaymentEditResult> {
  const updates: Record<string, unknown> = {};

  if (opts.changeEvent) {
    updates.event_id = opts.eventId ?? null;
  }

  if (typeof opts.category === "string") {
    const splits = splitAmountByCategory(payment.total_amount, opts.category);
    updates.dining_amount = splits.dining_amount;
    updates.charity_amount = splits.charity_amount;
    updates.raffle_amount = splits.raffle_amount;
    updates.service_fee_amount = splits.service_fee_amount;
    updates.guest_ticket_amount = splits.guest_ticket_amount;
  }

  if (Object.keys(updates).length === 0) {
    return { ok: false, status: 400, error: "No supported fields provided." };
  }

  const newCharity =
    "charity_amount" in updates
      ? Number(updates.charity_amount)
      : Number(payment.charity_amount ?? 0);
  const newEventId = (
    "event_id" in updates ? updates.event_id : payment.event_id ?? null
  ) as string | null;

  const linkedDonations = await db
    .getDonationsByPaymentId(payment.id, mosqueId)
    .catch(() => []);
  const existingDonation = linkedDonations[0] ?? null;

  const removingCharity =
    newCharity <= 0 && Number(payment.charity_amount ?? 0) > 0;
  const reducingClaimed =
    existingDonation &&
    (existingDonation.gift_aid_claim_batch_id ||
      existingDonation.gift_aid_claimed_at) &&
    (removingCharity || newCharity < Number(existingDonation.amount ?? 0));
  if (reducingClaimed) {
    return {
      ok: false,
      status: 409,
      error:
        "This payment's charity donation is already in a Gift Aid claim batch. Adjust it from the Gift Aid screen before recategorising.",
    };
  }

  const updated = await db.updatePayment(payment.id, mosqueId, updates);
  if (!updated) {
    return { ok: false, status: 500, error: "Could not update payment." };
  }

  let donationAction: DonationAction = "none";
  try {
    if (newCharity > 0) {
      if (existingDonation) {
        await db.updateDonation(existingDonation.id, mosqueId, {
          amount: newCharity,
          event_id: newEventId,
          gift_aid_eligible_amount: existingDonation.gift_aid_declaration_id
            ? newCharity
            : 0,
        });
        donationAction = "updated";
      } else {
        const email = payment.user_email ?? "";
        const declaration = email
          ? await db
              .getActiveGiftAidDeclarationByEmail(mosqueId, email)
              .catch(() => null)
          : null;
        const giftAidStatus = declaration
          ? "declared"
          : email
            ? "eligible"
            : "unknown";
        await db.addDonation(mosqueId, {
          event_id: newEventId,
          payment_id: payment.id,
          donor_name: payment.user_name ?? null,
          donor_email: email,
          amount: newCharity,
          currency: (payment.currency || "GBP").toLowerCase(),
          source:
            payment.payment_method === "cash"
              ? "in_person_take_payment_cash"
              : "in_person_take_payment",
          status: "completed",
          gift_aid_declaration_id: declaration?.id ?? null,
          gift_aid_status: giftAidStatus,
          gift_aid_eligible_amount: declaration ? newCharity : 0,
        });
        donationAction = "created";
      }
    } else if (existingDonation) {
      await db.deleteDonation(existingDonation.id, mosqueId);
      donationAction = "deleted";
    }
  } catch (err) {
    console.error("applyPaymentEdit: donation sync failed (non-fatal)", {
      payment_id: payment.id,
      message: err instanceof Error ? err.message : String(err),
    });
  }

  return { ok: true, donationAction, updated };
}
