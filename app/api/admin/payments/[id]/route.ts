// PATCH /api/admin/payments/[id]
//
// Lightweight admin edit endpoint for an existing payments row. Currently
// supports two adjustments treasurers ask for after the fact:
//
//   1. Attach (or detach) the payment to a meeting (event_id).
//   2. Re-categorise the payment (category) — this also re-runs the
//      category->sub-amount splitter so the per-fee breakdown stays
//      consistent. The total_amount is never changed.
//
// We deliberately do NOT support changing the user_email, amount, or
// status here. Refunds go through the dedicated refund flow; amount edits
// would invalidate any Mooov/Stripe ledger we projected from, which is
// the wrong direction. If a wrong amount lands, void and re-take.

import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import { rejectIfMockDisabled } from "@/lib/db/reject-mock";
import * as db from "@/lib/db";
import { getAdminReadContext } from "@/lib/admin/read-context";
import {
  requireAdminApiAuth,
  requireAdminApiPermission,
} from "@/lib/auth/api";
import { writeAuditLog } from "@/lib/audit";
import { splitAmountByCategory } from "@/lib/take-payment/categorize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const _rejectMock = rejectIfMockDisabled();
  if (_rejectMock) return _rejectMock;

  const unauthorized = await requireAdminApiAuth();
  if (unauthorized) return unauthorized;

  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Database not configured." },
      { status: 503 },
    );
  }

  const { id } = await params;
  const ctx = await getAdminReadContext();
  if (ctx.mode !== "database" || !ctx.lodgeId) {
    return NextResponse.json({ error: "Lodge not selected." }, { status: 404 });
  }
  const lodgeId = ctx.lodgeId;

  const forbidden = await requireAdminApiPermission("payments:write", lodgeId);
  if (forbidden) return forbidden;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const payment = await db.getPaymentById(id, lodgeId);
  if (!payment) {
    return NextResponse.json({ error: "Payment not found." }, { status: 404 });
  }

  const updates: Record<string, unknown> = {};

  // Attach / detach event. `null` (or empty string) detaches; a uuid attaches
  // after we confirm the event belongs to this lodge.
  if ("event_id" in body) {
    const raw = body.event_id;
    if (raw === null || (typeof raw === "string" && raw.trim() === "")) {
      updates.event_id = null;
    } else if (typeof raw === "string") {
      const eventRow = await db.getEventById(raw.trim(), lodgeId);
      if (!eventRow) {
        return NextResponse.json(
          { error: "Selected meeting not found in this lodge." },
          { status: 400 },
        );
      }
      updates.event_id = eventRow.id;
    } else {
      return NextResponse.json(
        { error: "event_id must be a uuid string or null." },
        { status: 400 },
      );
    }
  }

  // Optional re-categorise. We rebuild the sub-amounts from total_amount so
  // the breakdown stays consistent with the new category. This deliberately
  // does NOT touch refund_amount — refunds remain attached however they
  // were originally recorded.
  if (typeof body.category === "string") {
    const splits = splitAmountByCategory(payment.total_amount, body.category);
    updates.dining_amount = splits.dining_amount;
    updates.charity_amount = splits.charity_amount;
    updates.raffle_amount = splits.raffle_amount;
    updates.meeting_fee_amount = splits.meeting_fee_amount;
    updates.guest_ticket_amount = splits.guest_ticket_amount;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: "No supported fields provided." },
      { status: 400 },
    );
  }

  // Work out the post-edit charity figure and meeting link so we can keep
  // the donations/Gift Aid ledger in step with a recategorise. The charity
  // sub-amount drives whether this payment should have a matching donation
  // row; the event link keeps the donation rolling up to the right meeting.
  const newCharity =
    "charity_amount" in updates
      ? Number(updates.charity_amount)
      : Number(payment.charity_amount ?? 0);
  const newEventId = (
    "event_id" in updates ? updates.event_id : payment.event_id ?? null
  ) as string | null;

  const linkedDonations = await db
    .getDonationsByPaymentId(id, lodgeId)
    .catch(() => []);
  const existingDonation = linkedDonations[0] ?? null;

  // Guard: never silently disturb a donation that's already been swept into
  // a Gift Aid claim batch (or marked claimed). The treasurer must resolve
  // that from the Gift Aid screen first, otherwise we'd risk diverging from
  // what was filed with HMRC / the Relief Chest.
  const removingCharity = newCharity <= 0 && Number(payment.charity_amount ?? 0) > 0;
  const reducingClaimed =
    existingDonation &&
    (existingDonation.gift_aid_claim_batch_id ||
      existingDonation.gift_aid_claimed_at) &&
    (removingCharity || newCharity < Number(existingDonation.amount ?? 0));
  if (reducingClaimed) {
    return NextResponse.json(
      {
        error:
          "This payment's charity donation is already in a Gift Aid claim batch. Adjust it from the Gift Aid screen before recategorising.",
      },
      { status: 409 },
    );
  }

  const updated = await db.updatePayment(id, lodgeId, updates);
  if (!updated) {
    return NextResponse.json(
      { error: "Could not update payment." },
      { status: 500 },
    );
  }

  // Reconcile the charity donation ledger with the new payment shape.
  let donationAction: "created" | "updated" | "deleted" | "none" = "none";
  try {
    if (newCharity > 0) {
      if (existingDonation) {
        // Keep amount + meeting link in sync; preserve any declaration link
        // and refresh the eligible amount when one is on file.
        await db.updateDonation(existingDonation.id, lodgeId, {
          amount: newCharity,
          event_id: newEventId,
          gift_aid_eligible_amount: existingDonation.gift_aid_declaration_id
            ? newCharity
            : 0,
        });
        donationAction = "updated";
      } else {
        // Newly charity: mint a donation mirroring the take-payment projector
        // so the per-meeting Gift Aid panel + close batch pick it up.
        const email = payment.user_email ?? "";
        const declaration = email
          ? await db
              .getActiveGiftAidDeclarationByEmail(lodgeId, email)
              .catch(() => null)
          : null;
        const giftAidStatus = declaration
          ? "declared"
          : email
            ? "eligible"
            : "unknown";
        await db.addDonation(lodgeId, {
          event_id: newEventId,
          payment_id: id,
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
      // No longer charity: remove the auto-created donation (guarded above so
      // we only reach here when it isn't batched/claimed).
      await db.deleteDonation(existingDonation.id, lodgeId);
      donationAction = "deleted";
    }
  } catch (err) {
    console.error("payment recategorise: donation sync failed (non-fatal)", {
      payment_id: id,
      message: err instanceof Error ? err.message : String(err),
    });
  }

  await writeAuditLog({
    lodgeId,
    action: "updated",
    entityType: "payment",
    entityId: id,
    summary:
      "event_id" in updates && !("charity_amount" in updates)
        ? updates.event_id
          ? `Linked payment to event ${updates.event_id as string}`
          : "Detached payment from meeting"
        : "Re-categorised payment",
    metadata: { fields: Object.keys(updates), donation: donationAction },
  });

  return NextResponse.json({
    success: true,
    payment: updated,
    donation: donationAction,
  });
}
