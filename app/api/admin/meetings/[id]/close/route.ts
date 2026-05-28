// Close a meeting and prepare its Gift Aid claim pack.
//
// The treasurer hits "Close meeting" after the festive board. We:
//
//   1. Aggregate the meeting's payments into a `meeting_collections` row
//      (cash, card, donor-linked, anonymous, GASDS eligible).
//   2. Pull every Gift Aid eligible donation attached to this event_id
//      and bundle them into a fresh `gift_aid_claim_batch` with the
//      meeting date as both period_start and period_end.
//   3. Link the meeting collection to the new batch so reports can show
//      "submitted to Relief Chest".
//   4. Stamp `meeting_closed_at` + the optional close note on the event
//      so the meeting can't be silently re-closed.
//
// What this endpoint does NOT do:
//   - Actually email the Relief Chest. That's an opt-in second step; we
//     return the batch id and let the existing claim pack export flow do
//     the heavy lifting via the admin Gift Aid screen.
//   - Re-open a closed meeting. Re-opens are intentionally manual to keep
//     the chain of custody clean.

import { NextRequest, NextResponse } from "next/server";
import * as db from "@/lib/db";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import { getLodgeSlugFromRequest } from "@/lib/tenant";
import {
  requireAdminApiAuth,
  requireAdminApiPermission,
} from "@/lib/auth/api";
import { getCurrentAdminScope } from "@/lib/auth/permissions";
import { writeAuditLog } from "@/lib/audit";
import { eligibleDonationRows } from "@/lib/gift-aid/eligible";
import { resolveDeclarationsForBatch } from "@/lib/gift-aid/new-declarations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GASDS_ANNUAL_LIMIT = 8000;

function taxYearForDate(value: string) {
  const date = new Date(value);
  const year = date.getUTCFullYear();
  const startsNextTaxYear =
    date.getUTCMonth() > 3 ||
    (date.getUTCMonth() === 3 && date.getUTCDate() >= 6);
  const start = startsNextTaxYear ? year : year - 1;
  return `${start}-${String(start + 1).slice(2)}`;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const unauthorized = await requireAdminApiAuth();
  if (unauthorized) return unauthorized;
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Database not configured." },
      { status: 503 }
    );
  }
  const { id: eventId } = await params;
  const lodgeSlug = getLodgeSlugFromRequest(request);
  const lodgeId = await db.resolveLodgeId(lodgeSlug);
  if (!lodgeId) {
    return NextResponse.json({ error: "Lodge not found." }, { status: 404 });
  }
  const forbidden = await requireAdminApiPermission("charity:write", lodgeId);
  if (forbidden) return forbidden;

  const event = await db.getEventById(eventId, lodgeId);
  if (!event) {
    return NextResponse.json({ error: "Meeting not found." }, { status: 404 });
  }
  if (event.meeting_closed_at) {
    return NextResponse.json(
      { error: "Meeting has already been closed." },
      { status: 409 }
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    notes?: unknown;
    collection_type?: unknown;
    title?: unknown;
    // Optional manual amount overrides (e.g. coins not tracked individually).
    cash_amount?: unknown;
    card_amount?: unknown;
    anonymous_cash_amount?: unknown;
  };
  const closeNotes =
    typeof body.notes === "string" && body.notes.trim()
      ? body.notes.trim()
      : null;

  const [eventPayments, eventDonations, declarations] = await Promise.all([
    db.getPaymentsByEventId(eventId, lodgeId).catch(() => []),
    db.getDonationsByEvent(eventId, lodgeId).catch(() => []),
    db.getGiftAidDeclarations(lodgeId),
  ]);

  // Aggregate per-payment-method splits using the existing payment row
  // columns. Cash entries from the take-payment surface land in
  // payment_method='cash' with their categorical split populated; QR card
  // entries land as 'card_qr'. Other historical methods (stripe, etc.) we
  // treat as card_amount for the collection display.
  let cashAmount = 0;
  let cardAmount = 0;
  let donorLinkedAmount = 0;
  for (const payment of eventPayments) {
    if (payment.status !== "succeeded") continue;
    const total = Number(payment.total_amount ?? 0);
    const charity = Number(payment.charity_amount ?? 0);
    if (payment.payment_method === "cash") cashAmount += total;
    else cardAmount += total;
    if (payment.user_email && charity > 0) donorLinkedAmount += charity;
  }
  // Anonymous cash = cash charity income with no payer email attached.
  // GASDS lets the lodge reclaim the BR tax on small anonymous cash
  // donations up to £8,000 a year. Treasurer can override the auto-figure
  // via the body if their on-the-day cash basket was bigger than the
  // logged take-payment entries.
  const autoAnonymous = Math.max(0, cashAmount - donorLinkedAmount);
  const anonymousCashAmount = (() => {
    if (typeof body.anonymous_cash_amount === "number") {
      return Math.max(0, body.anonymous_cash_amount);
    }
    return autoAnonymous;
  })();

  const collectionDate = event.event_date;
  const taxYear = taxYearForDate(collectionDate);
  const existingCollections = await db
    .getMeetingCollections(lodgeId, { taxYear })
    .catch(() => []);
  const usedAllowance = existingCollections.reduce(
    (sum, collection) => sum + Number(collection.gasds_eligible_amount ?? 0),
    0
  );
  const gasdsEligibleAmount = Math.min(
    anonymousCashAmount,
    Math.max(0, GASDS_ANNUAL_LIMIT - usedAllowance)
  );

  const scope = await getCurrentAdminScope();
  const actorEmail =
    scope.kind === "dummy" ||
    scope.kind === "platform" ||
    scope.kind === "lodge"
      ? scope.email
      : null;

  // Pull only declarations that are not revoked, then join donations to
  // find what's HMRC eligible for this meeting. Re-using the same logic
  // the admin Gift Aid screen does keeps "what gets claimed" consistent
  // regardless of whether the treasurer batches monthly or per meeting.
  const eligibleForBatch = eligibleDonationRows(
    eventDonations,
    declarations
  );
  const giftAidEligibleAmount = eligibleForBatch.reduce(
    (sum, row) => sum + row.eligible_amount,
    0
  );

  // 1. Meeting collection row.
  let collection;
  try {
    collection = await db.createMeetingCollection(lodgeId, {
      event_id: eventId,
      campaign_id: null,
      collection_date: collectionDate,
      collection_type:
        typeof body.collection_type === "string"
          ? body.collection_type
          : "festive_board",
      title:
        typeof body.title === "string" && body.title.trim()
          ? body.title.trim()
          : `${event.title} (closed)`,
      cash_amount: cashAmount,
      card_amount: cardAmount,
      donor_linked_amount: donorLinkedAmount,
      anonymous_cash_amount: anonymousCashAmount,
      gift_aid_reclaimable_amount: giftAidEligibleAmount * 0.25,
      gasds_eligible_amount: gasdsEligibleAmount,
      gasds_tax_year: taxYear,
      notes: closeNotes,
      recorded_by_email: actorEmail,
      gift_aid_claim_batch_id: null,
      relief_chest_delivered_at: null,
      relief_chest_delivered_to: null,
    });
  } catch (err) {
    console.error("meeting close: collection insert failed", {
      event_id: eventId,
      message: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: "Could not record meeting collection." },
      { status: 500 }
    );
  }

  // 2. Gift Aid claim batch. We create the batch even when there are no
  // eligible donations IF there are new declarations to ship to UGLE --
  // the Relief Chest wants copies of every signed declaration regardless
  // of whether the lodge has anything to reclaim this meeting.
  let batch = null;
  let attachedDeclarationsCount = 0;
  // Probe what's new since the previous batch so we can decide whether to
  // create an "empty" batch (no donations, declarations only). We pass a
  // stub `created_at` of now() since the real batch will be inserted
  // moments later and resolveDeclarationsForBatch only uses created_at
  // for the upper window bound.
  const probeNowIso = new Date().toISOString();
  const probe = await resolveDeclarationsForBatch({
    lodgeId,
    newBatch: { created_at: probeNowIso, id: "" },
    donorDeclarationIds: eligibleForBatch
      .map((row) => row.gift_aid_declaration_id)
      .filter((id): id is string => Boolean(id)),
  });
  const willShipDeclarations = probe.links.length > 0;

  if (eligibleForBatch.length > 0 || willShipDeclarations) {
    try {
      batch = await db.createGiftAidClaimBatch(lodgeId, {
        claim_reference: `MEET-${collectionDate}-${eventId.slice(0, 8)}`,
        period_start: collectionDate,
        period_end: collectionDate,
        status: "draft",
        donation_count: eligibleForBatch.length,
        eligible_amount: giftAidEligibleAmount,
        reclaimable_amount: giftAidEligibleAmount * 0.25,
        exported_at: null,
        filed_at: null,
        paid_at: null,
        notes: `Per-meeting close for ${event.title} on ${collectionDate}.`,
        created_by_email: actorEmail,
      });
      if (eligibleForBatch.length > 0) {
        await db.createGiftAidClaimItems(
          lodgeId,
          eligibleForBatch.map((row) => ({
            claim_batch_id: batch!.id,
            donation_id: row.id,
            gift_aid_declaration_id: row.gift_aid_declaration_id,
            donor_name: row.donor_name,
            donor_email: row.donor_email,
            donation_date: row.created_at.slice(0, 10),
            source: row.source,
            eligible_amount: row.eligible_amount,
            reclaimable_amount: row.eligible_amount * 0.25,
          }))
        );
        await Promise.all(
          eligibleForBatch.map((row) =>
            db.updateDonation(row.id, lodgeId, {
              gift_aid_claim_batch_id: batch!.id,
            })
          )
        );
      }
      // Re-resolve against the real batch.created_at to keep the window
      // exact, then write the linkage. We swallow link failures so an
      // unbacked declaration storage failure doesn't break the close.
      try {
        const resolved = await resolveDeclarationsForBatch({
          lodgeId,
          newBatch: { created_at: batch.created_at, id: batch.id },
          donorDeclarationIds: eligibleForBatch
            .map((row) => row.gift_aid_declaration_id)
            .filter((id): id is string => Boolean(id)),
        });
        if (resolved.links.length > 0) {
          await db.linkDeclarationsToClaimBatch(
            lodgeId,
            batch.id,
            resolved.links
          );
          await db.setClaimBatchDeclarationsCount(
            batch.id,
            lodgeId,
            resolved.links.length
          );
          attachedDeclarationsCount = resolved.links.length;
        }
      } catch (err) {
        console.error("meeting close: declaration linkage failed", {
          batch_id: batch.id,
          message: err instanceof Error ? err.message : String(err),
        });
      }
      await db.attachClaimBatchToMeetingCollection(collection.id, lodgeId, {
        gift_aid_claim_batch_id: batch.id,
      });
    } catch (err) {
      console.error("meeting close: claim batch insert failed", {
        event_id: eventId,
        collection_id: collection.id,
        message: err instanceof Error ? err.message : String(err),
      });
      return NextResponse.json(
        { error: "Could not create Gift Aid batch." },
        { status: 500 }
      );
    }
  }

  // 3. Stamp the event closed.
  try {
    await db.markEventMeetingClosed(eventId, lodgeId, {
      meeting_closed_at: new Date().toISOString(),
      meeting_closed_by_email: actorEmail,
      meeting_close_notes: closeNotes,
    });
  } catch (err) {
    console.warn("meeting close: event stamp failed (non-fatal)", {
      event_id: eventId,
      message: err instanceof Error ? err.message : String(err),
    });
  }

  await writeAuditLog({
    lodgeId,
    action: "meeting_closed",
    entityType: "event",
    entityId: eventId,
    summary: `Closed meeting ${event.title}${batch ? ` and created Gift Aid batch ${batch.claim_reference}` : ""}.`,
    metadata: {
      collection_id: collection.id,
      claim_batch_id: batch?.id ?? null,
      gift_aid_eligible_amount: giftAidEligibleAmount,
      gift_aid_donor_count: eligibleForBatch.length,
      gasds_eligible_amount: gasdsEligibleAmount,
      new_declarations_count: attachedDeclarationsCount,
    },
  });

  return NextResponse.json({
    collection,
    claim_batch: batch,
    gift_aid_donor_count: eligibleForBatch.length,
    gift_aid_eligible_amount: giftAidEligibleAmount,
    reclaimable_amount: giftAidEligibleAmount * 0.25,
    new_declarations_count: attachedDeclarationsCount,
  });
}
