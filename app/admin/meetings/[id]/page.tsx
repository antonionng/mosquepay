import { notFound } from "next/navigation";
import { headers } from "next/headers";
import * as db from "@/lib/db";
import * as mockDb from "@/lib/mock-db";
import { getAdminReadContext } from "@/lib/admin/read-context";
import { getDefaultLodgeSlug } from "@/lib/tenant";
import { getMeetingReadiness } from "@/lib/meetings/readiness";
import { lodgeScopedEventPath } from "@/lib/public-links";
import {
  isPubliclyVisible,
  PUBLIC_EVENT_TYPES,
} from "@/lib/events/public-visibility";
import { MeetingDetailClient, type MeetingVisibility } from "./meeting-detail-client";

function siteOrigin(forwardedHost: string | null, forwardedProto: string | null) {
  const env = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (env) return env.replace(/\/$/, "");
  if (forwardedHost) {
    const proto = forwardedProto ?? "https";
    return `${proto}://${forwardedHost}`;
  }
  return "http://localhost:3000";
}

export default async function AdminMeetingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await getAdminReadContext();
  const useMock = ctx.mode === "mock";
  const lodgeId = ctx.mode === "database" ? ctx.lodgeId : null;
  const lodgeSlug = ctx.mode === "database" ? ctx.lodgeSlug : getDefaultLodgeSlug();

  const event = useMock
    ? mockDb.getEventById(id)
    : lodgeId
      ? await db.getEventById(id, lodgeId)
      : null;
  if (!event) notFound();

  const rsvps = useMock
    ? mockDb.getRsvpsByEventId(id)
    : lodgeId
      ? await db.getRsvpsByEventId(id, lodgeId)
      : [];

  // Guests are saved into a separate `event_guests` table at RSVP time
  // (see /api/summons/access and /api/payments/create-checkout-session).
  // Without this load the admin page can only show the count, not the
  // actual names/dietary the brother typed in.
  const eventGuests =
    lodgeId && !useMock ? await db.getGuestsByEvent(id, lodgeId) : [];

  let summons: Awaited<ReturnType<typeof db.getEventSummons>> | null = null;
  let sends: Awaited<ReturnType<typeof db.listEventSummonsSends>> = [];
  if (lodgeId) {
    summons = await db.getEventSummons(id, lodgeId);
    sends = await db.listEventSummonsSends(lodgeId, id, 5);
  }
  const summonsSentCount = sends.reduce((a, s) => a + s.sent_count, 0);

  const lodgeDefaults = lodgeId ? await db.getLodgeFeeDefaults(lodgeId) : null;

  // Money raised against this meeting + lifetime lodge total. Both are
  // summed from the canonical `payments` table so the figure matches what
  // the treasurer sees in /admin/payments. Pending rows (in-flight QR /
  // unsettled cash) are included separately so the duty officer can see
  // money on the way in alongside money already on the ledger.
  const eventPayments =
    lodgeId && !useMock
      ? await db.getPaymentsByEventId(id, lodgeId)
      : [];
  const lodgePaymentsAll =
    lodgeId && !useMock ? await db.getPayments(lodgeId) : [];

  function bucketTotals(payments: Awaited<ReturnType<typeof db.getPayments>>) {
    const succeededSet = new Set([
      "succeeded",
      "completed",
      "paid",
      "partially_refunded",
    ]);
    return payments.reduce(
      (acc, p) => {
        const isSucceeded = succeededSet.has(p.status);
        const isPending = p.status === "pending";
        if (!isSucceeded && !isPending) return acc;
        const net = Math.max(0, p.total_amount - (p.refund_amount ?? 0));
        if (isSucceeded) {
          acc.succeededTotal += net;
          acc.charity += p.charity_amount ?? 0;
          acc.dining += p.dining_amount ?? 0;
          acc.raffle += p.raffle_amount ?? 0;
          acc.meetingFee += p.meeting_fee_amount ?? 0;
          acc.guestTicket += p.guest_ticket_amount ?? 0;
          acc.refunded += p.refund_amount ?? 0;
          acc.succeededCount += 1;
        } else {
          acc.pendingTotal += p.total_amount;
          acc.pendingCount += 1;
        }
        return acc;
      },
      {
        succeededTotal: 0,
        pendingTotal: 0,
        succeededCount: 0,
        pendingCount: 0,
        charity: 0,
        dining: 0,
        raffle: 0,
        meetingFee: 0,
        guestTicket: 0,
        refunded: 0,
      },
    );
  }

  const meetingFinance = bucketTotals(eventPayments);
  const lodgeFinance = bucketTotals(lodgePaymentsAll);
  const lodgeAllTimeTotal =
    lodgeFinance.succeededTotal + lodgeFinance.pendingTotal;

  // Heads-up for reconciliation: collected payments taken on the meeting date
  // that are NOT attributed to any meeting. These are the takings most likely
  // meant for this evening that someone forgot to tag, so the treasurer can
  // re-attribute them before closing.
  const collectedStatuses = new Set(["succeeded", "completed", "paid"]);
  const meetingDay = event.event_date.slice(0, 10);
  const unattributedSameDay = lodgePaymentsAll.filter(
    (p) =>
      !p.event_id &&
      collectedStatuses.has(p.status) &&
      typeof p.created_at === "string" &&
      p.created_at.slice(0, 10) === meetingDay,
  );
  const unattributed = {
    count: unattributedSameDay.length,
    total: unattributedSameDay.reduce(
      (s, p) => s + Math.max(0, p.total_amount - (p.refund_amount ?? 0)),
      0,
    ),
  };

  // Per-meeting Gift Aid close state (migration 059). Donor-linked donations
  // for this event are what the per-meeting batch will sweep. Treasurer sees
  // the totals before they hit Close. Migration 060 adds a preview of how
  // many new declarations will ship to UGLE with the pack.
  const eventDonations =
    lodgeId && !useMock ? await db.getDonationsByEvent(id, lodgeId) : [];
  const charityDonorAmount = eventDonations.reduce(
    (sum, d) => sum + Number(d.amount ?? 0),
    0,
  );
  // "Donor-linked" counts only charity donations that carry a donor email,
  // i.e. the ones that can be Gift Aid reclaimed once a declaration is on
  // file. Anonymous cash still adds to the income figure above but isn't a
  // donor-linked gift.
  const charityDonorCount = eventDonations.filter(
    (d) => typeof d.donor_email === "string" && d.donor_email.trim().length > 0,
  ).length;

  // Compute "new declarations since previous batch" for the preview UI.
  // We use the same lib that the close endpoint will use at submit time
  // so the preview matches what actually gets sent.
  let newDeclarationsPreview = 0;
  let closedBatchId: string | null = null;
  let closedBatchDeclarationsCount = 0;
  let reliefChestDeliveredAt: string | null = null;
  if (lodgeId && !useMock) {
    try {
      const { resolveDeclarationsForBatch } = await import(
        "@/lib/gift-aid/new-declarations"
      );
      const previewBatch = {
        created_at: new Date().toISOString(),
        id: "preview",
      };
      const preview = await resolveDeclarationsForBatch({
        lodgeId,
        newBatch: previewBatch,
        donorDeclarationIds: eventDonations
          .map((d) => d.gift_aid_declaration_id)
          .filter((id): id is string => Boolean(id)),
      });
      newDeclarationsPreview = preview.links.filter(
        (link) => link.inclusion_reason === "new_in_window"
      ).length;
    } catch {
      /* non-fatal: panel still renders without preview */
    }
    // If the meeting is already closed, surface the resulting batch + the
    // declarations count on the panel so the treasurer can download.
    const meetingClosed =
      "meeting_closed_at" in event
        ? ((event as { meeting_closed_at: string | null })
            .meeting_closed_at ?? null)
        : null;
    if (meetingClosed) {
      try {
        const collections = await db.getMeetingCollections(lodgeId, {
          eventId: id,
        });
        const collectionWithBatch = collections.find(
          (c) => c.gift_aid_claim_batch_id,
        );
        reliefChestDeliveredAt =
          collections.find((c) => c.relief_chest_delivered_at)
            ?.relief_chest_delivered_at ?? null;
        if (collectionWithBatch?.gift_aid_claim_batch_id) {
          closedBatchId = collectionWithBatch.gift_aid_claim_batch_id;
          const batches = await db.getGiftAidClaimBatches(lodgeId);
          const batch = batches.find((b) => b.id === closedBatchId);
          closedBatchDeclarationsCount = batch?.declarations_count ?? 0;
        }
      } catch {
        /* non-fatal */
      }
    }
  }

  const closeState = {
    meeting_closed_at:
      "meeting_closed_at" in event
        ? ((event as { meeting_closed_at: string | null }).meeting_closed_at ??
          null)
        : null,
    meeting_closed_by_email:
      "meeting_closed_by_email" in event
        ? ((event as { meeting_closed_by_email: string | null })
            .meeting_closed_by_email ?? null)
        : null,
    charity_amount: charityDonorAmount,
    charity_count: charityDonorCount,
    new_declarations_preview: newDeclarationsPreview,
    closed_batch_id: closedBatchId,
    closed_batch_declarations_count: closedBatchDeclarationsCount,
    relief_chest_delivered_at: reliefChestDeliveredAt,
    currency: "GBP",
  };

  const readiness = getMeetingReadiness({
    event_date: event.event_date,
    enable_rsvp: event.enable_rsvp,
    enable_dining_rsvp: event.enable_dining_rsvp,
    dining_price: event.dining_price,
    enable_payments: event.enable_payments,
    enable_charity_donation: event.enable_charity_donation,
    charity_name: event.charity_name,
    enable_meeting_fee: event.enable_meeting_fee,
    meeting_fee_amount: event.meeting_fee_amount,
    enable_guest_tickets: event.enable_guest_tickets,
    guest_ticket_price: event.guest_ticket_price,
    published: event.published,
    hasSummons: Boolean(summons),
    summonsSentCount,
    lodgeDefaults,
  });

  const reqHeaders = await headers();
  const origin = siteOrigin(
    reqHeaders.get("x-forwarded-host") ?? reqHeaders.get("host"),
    reqHeaders.get("x-forwarded-proto")
  );
  const publicPath = lodgeScopedEventPath(lodgeSlug, event.slug);
  const publicUrl = `${origin}${publicPath}`;
  const previewPath = `/preview/meetings/${event.id}`;

  // Mirror `isPubliclyVisible` so the admin UI never advertises a "Visit"
  // affordance that would 404. Three buckets so we can render the right
  // copy/CTA combo on the detail page:
  //   - draft         → not published yet
  //   - members_only  → published, but the public route still 404s
  //                     (regular meeting without feature_on_website, or
  //                     guest_policy === 'closed')
  //   - public        → both flags align, the public URL renders
  const guestPolicy =
    "guest_policy" in event
      ? (event.guest_policy as "blue_table" | "white_table" | "closed")
      : "blue_table";
  const featureOnWebsite =
    "feature_on_website" in event
      ? Boolean(event.feature_on_website)
      : false;
  const publicByType = PUBLIC_EVENT_TYPES.has(event.event_type);
  const publiclyVisible = isPubliclyVisible({
    published: event.published,
    guest_policy: guestPolicy,
    event_type: event.event_type,
    feature_on_website: featureOnWebsite,
  });
  let visibility: MeetingVisibility;
  let visibilityReason: string | null = null;
  if (!event.published) {
    visibility = "draft";
  } else if (publiclyVisible) {
    visibility = "public";
  } else {
    visibility = "members_only";
    if (guestPolicy === "closed") {
      visibilityReason =
        "Guest policy is set to closed, so this meeting will never appear on the public site.";
    } else if (!publicByType) {
      visibilityReason =
        "Regular meetings, lodges of instruction, committees and emergencies stay private by default. Turn on \u201CFeature on website\u201D to publish it on the public lodge site.";
    }
  }

  return (
    <MeetingDetailClient
      meeting={JSON.parse(JSON.stringify(event))}
      rsvps={JSON.parse(JSON.stringify(rsvps))}
      guests={JSON.parse(JSON.stringify(eventGuests))}
      payments={JSON.parse(JSON.stringify(eventPayments))}
      readiness={JSON.parse(JSON.stringify(readiness))}
      summons={
        summons
          ? {
              id: summons.id,
              issue_date: summons.issue_date,
              menu_items: summons.menu_items ?? [],
              agenda_items: summons.agenda_items ?? [],
              dining_time: summons.dining_time,
              visiting_officer_name: summons.visiting_officer_name,
              visiting_officers: summons.visiting_officers ?? [],
              next_meeting_date: summons.next_meeting_date,
            }
          : null
      }
      sends={JSON.parse(JSON.stringify(sends))}
      publicUrl={publicUrl}
      publicPath={publicPath}
      previewPath={previewPath}
      visibility={visibility}
      visibilityReason={visibilityReason}
      canFeatureOnWebsite={!publicByType && guestPolicy !== "closed"}
      lodgeDefaults={lodgeDefaults}
      finance={{
        meeting: meetingFinance,
        lodgeAllTime: lodgeAllTimeTotal,
        currency: "GBP",
      }}
      closeState={closeState}
      unattributed={unattributed}
    />
  );
}
