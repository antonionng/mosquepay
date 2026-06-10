import { notFound } from "next/navigation";
import { headers } from "next/headers";
import * as db from "@/lib/db";
import * as mockDb from "@/lib/mock-db";
import { getAdminReadContext } from "@/lib/admin/read-context";
import { getDefaultChurchSlug } from "@/lib/tenant";
import { getServiceReadiness } from "@/lib/services/readiness";
import { churchScopedEventPath } from "@/lib/public-links";
import {
  isPubliclyVisible,
  PUBLIC_EVENT_TYPES,
} from "@/lib/events/public-visibility";
import { eligibleDonationRows } from "@/lib/gift-aid/eligible";
import { ServiceDetailClient, type ServiceVisibility } from "./service-detail-client";

function siteOrigin(forwardedHost: string | null, forwardedProto: string | null) {
  const env = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (env) return env.replace(/\/$/, "");
  if (forwardedHost) {
    const proto = forwardedProto ?? "https";
    return `${proto}://${forwardedHost}`;
  }
  return "http://localhost:3000";
}

export default async function AdminServiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await getAdminReadContext();
  const useMock = ctx.mode === "mock";
  const churchId = ctx.mode === "database" ? ctx.churchId : null;
  const churchSlug = ctx.mode === "database" ? ctx.churchSlug : getDefaultChurchSlug();

  const event = useMock
    ? mockDb.getEventById(id)
    : churchId
      ? await db.getEventById(id, churchId)
      : null;
  if (!event) notFound();

  const rsvps = useMock
    ? mockDb.getRsvpsByEventId(id)
    : churchId
      ? await db.getRsvpsByEventId(id, churchId)
      : [];

  // Guests are saved into a separate `event_guests` table at RSVP time
  // (see /api/notice/access and /api/payments/create-checkout-session).
  // Without this load the admin page can only show the count, not the
  // actual names/dietary the member typed in.
  const eventGuests =
    churchId && !useMock ? await db.getGuestsByEvent(id, churchId) : [];

  let notice: Awaited<ReturnType<typeof db.getServiceNotice>> | null = null;
  let sends: Awaited<ReturnType<typeof db.listServiceNoticeSends>> = [];
  if (churchId) {
    notice = await db.getServiceNotice(id, churchId);
    sends = await db.listServiceNoticeSends(churchId, id, 5);
  }
  const noticeSentCount = sends.reduce((a, s) => a + s.sent_count, 0);

  const churchDefaults = churchId ? await db.getChurchFeeDefaults(churchId) : null;

  // Money raised against this service + lifetime church total. Both are
  // summed from the canonical `payments` table so the figure matches what
  // the treasurer sees in /admin/payments. Pending rows (in-flight QR /
  // unsettled cash) are included separately so the duty officer can see
  // money on the way in alongside money already on the ledger.
  const eventPayments =
    churchId && !useMock
      ? await db.getPaymentsByEventId(id, churchId)
      : [];
  const churchPaymentsAll =
    churchId && !useMock ? await db.getPayments(churchId) : [];

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
          acc.serviceFee += p.service_fee_amount ?? 0;
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
        serviceFee: 0,
        guestTicket: 0,
        refunded: 0,
      },
    );
  }

  const serviceFinance = bucketTotals(eventPayments);
  const churchFinance = bucketTotals(churchPaymentsAll);
  const churchAllTimeTotal =
    churchFinance.succeededTotal + churchFinance.pendingTotal;

  // Reconciliation: collected payments taken on (or within a day of) the
  // service date that are NOT attributed to any service. These are the
  // takings most likely meant for this evening that someone forgot to tag,
  // so the treasurer can bulk-associate them before closing. We widen to
  // ±1 day to catch late-night / timezone edges around the event date.
  const collectedStatuses = new Set(["succeeded", "completed", "paid"]);
  const serviceDay = event.event_date.slice(0, 10);
  const dayOffset = (iso: string, days: number) => {
    const d = new Date(`${iso}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  };
  const allowedDays = new Set([
    dayOffset(serviceDay, -1),
    serviceDay,
    dayOffset(serviceDay, 1),
  ]);
  const unattributedSameDay = churchPaymentsAll.filter(
    (p) =>
      !p.event_id &&
      collectedStatuses.has(p.status) &&
      typeof p.created_at === "string" &&
      allowedDays.has(p.created_at.slice(0, 10)),
  );
  const unattributed = {
    count: unattributedSameDay.length,
    total: unattributedSameDay.reduce(
      (s, p) => s + Math.max(0, p.total_amount - (p.refund_amount ?? 0)),
      0,
    ),
  };

  // Services list for the "associate to a different service / detach" picker
  // inside the reconciliation panel and the per-payment edit controls.
  const eventOptions = churchId
    ? (await db.getEvents(churchId).catch(() => []))
        .map((e) => ({ id: e.id, title: e.title, event_date: e.event_date }))
        .sort((a, b) => b.event_date.localeCompare(a.event_date))
    : [];

  // Per-service Gift Aid close state (migration 059). Donor-linked donations
  // for this event are what the per-service batch will sweep. Treasurer sees
  // the totals before they hit Close. Migration 060 adds a preview of how
  // many new declarations will ship to UGLE with the pack.
  const eventDonations =
    churchId && !useMock ? await db.getDonationsByEvent(id, churchId) : [];
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
  const giftAidDeclarations =
    churchId && !useMock ? await db.getGiftAidDeclarations(churchId) : [];
  const giftAidEligibleRows =
    churchId && !useMock
      ? eligibleDonationRows(eventDonations, giftAidDeclarations)
      : [];
  const giftAidEligibleAmount = giftAidEligibleRows.reduce(
    (sum, row) => sum + row.eligible_amount,
    0,
  );

  // Compute "new declarations since previous batch" for the preview UI.
  // We use the same lib that the close endpoint will use at submit time
  // so the preview matches what actually gets sent.
  let newDeclarationsPreview = 0;
  let closedBatchId: string | null = null;
  let closedBatchDeclarationsCount = 0;
  let reliefChestDeliveredAt: string | null = null;
  if (churchId && !useMock) {
    try {
      const { resolveDeclarationsForBatch } = await import(
        "@/lib/gift-aid/new-declarations"
      );
      const previewBatch = {
        created_at: new Date().toISOString(),
        id: "preview",
      };
      const preview = await resolveDeclarationsForBatch({
        churchId,
        newBatch: previewBatch,
        donorDeclarationIds: giftAidEligibleRows
          .map((d) => d.gift_aid_declaration_id)
          .filter((id): id is string => Boolean(id)),
      });
      newDeclarationsPreview = preview.links.filter(
        (link) => link.inclusion_reason === "new_in_window"
      ).length;
    } catch {
      /* non-fatal: panel still renders without preview */
    }
    // If the service is already closed, surface the resulting batch + the
    // declarations count on the panel so the treasurer can download.
    const serviceClosed =
      "service_closed_at" in event
        ? ((event as { service_closed_at: string | null })
            .service_closed_at ?? null)
        : null;
    if (serviceClosed) {
      try {
        const collections = await db.getServiceCollections(churchId, {
          eventId: id,
        });
        const collectionWithBatch = collections.find(
          (c) => c.gift_aid_claim_batch_id,
        );
        reliefChestDeliveredAt =
          collections.find((c) => c.gift_aid_pack_delivered_at)
            ?.gift_aid_pack_delivered_at ?? null;
        if (collectionWithBatch?.gift_aid_claim_batch_id) {
          closedBatchId = collectionWithBatch.gift_aid_claim_batch_id;
          const batches = await db.getGiftAidClaimBatches(churchId);
          const batch = batches.find((b) => b.id === closedBatchId);
          closedBatchDeclarationsCount = batch?.declarations_count ?? 0;
        }
      } catch {
        /* non-fatal */
      }
    }
  }

  const closeState = {
    service_closed_at:
      "service_closed_at" in event
        ? ((event as { service_closed_at: string | null }).service_closed_at ??
          null)
        : null,
    service_closed_by_email:
      "service_closed_by_email" in event
        ? ((event as { service_closed_by_email: string | null })
            .service_closed_by_email ?? null)
        : null,
    charity_amount: charityDonorAmount,
    charity_count: charityDonorCount,
    gift_aid_eligible_amount: giftAidEligibleAmount,
    gift_aid_eligible_count: giftAidEligibleRows.length,
    new_declarations_preview: newDeclarationsPreview,
    closed_batch_id: closedBatchId,
    closed_batch_declarations_count: closedBatchDeclarationsCount,
    gift_aid_pack_delivered_at: reliefChestDeliveredAt,
    currency: "GBP",
  };

  const readiness = getServiceReadiness({
    event_date: event.event_date,
    enable_rsvp: event.enable_rsvp,
    enable_dining_rsvp: event.enable_dining_rsvp,
    dining_price: event.dining_price,
    enable_payments: event.enable_payments,
    enable_charity_donation: event.enable_charity_donation,
    charity_name: event.charity_name,
    enable_service_fee: event.enable_service_fee,
    service_fee_amount: event.service_fee_amount,
    enable_guest_tickets: event.enable_guest_tickets,
    guest_ticket_price: event.guest_ticket_price,
    published: event.published,
    hasNotice: Boolean(notice),
    noticeSentCount,
    churchDefaults,
  });

  const reqHeaders = await headers();
  const origin = siteOrigin(
    reqHeaders.get("x-forwarded-host") ?? reqHeaders.get("host"),
    reqHeaders.get("x-forwarded-proto")
  );
  const publicPath = churchScopedEventPath(churchSlug, event.slug);
  const publicUrl = `${origin}${publicPath}`;
  const previewPath = `/preview/services/${event.id}`;

  // Mirror `isPubliclyVisible` so the admin UI never advertises a "Visit"
  // affordance that would 404. Three buckets so we can render the right
  // copy/CTA combo on the detail page:
  //   - draft         → not published yet
  //   - members_only  → published, but the public route still 404s
  //                     (regular service without feature_on_website, or
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
  let visibility: ServiceVisibility;
  let visibilityReason: string | null = null;
  if (!event.published) {
    visibility = "draft";
  } else if (publiclyVisible) {
    visibility = "public";
  } else {
    visibility = "members_only";
    if (guestPolicy === "closed") {
      visibilityReason =
        "Guest policy is set to closed, so this service will never appear on the public site.";
    } else if (!publicByType) {
      visibilityReason =
        "Regular services, churches of instruction, committees and emergencies stay private by default. Turn on \u201CFeature on website\u201D to publish it on the public church site.";
    }
  }

  return (
    <ServiceDetailClient
      service={JSON.parse(JSON.stringify(event))}
      rsvps={JSON.parse(JSON.stringify(rsvps))}
      guests={JSON.parse(JSON.stringify(eventGuests))}
      payments={JSON.parse(JSON.stringify(eventPayments))}
      readiness={JSON.parse(JSON.stringify(readiness))}
      notice={
        notice
          ? {
              id: notice.id,
              issue_date: notice.issue_date,
              menu_items: notice.menu_items ?? [],
              agenda_items: notice.agenda_items ?? [],
              dining_time: notice.dining_time,
              newcomer_contact_name: notice.newcomer_contact_name,
              newcomer_contacts: notice.newcomer_contacts ?? [],
              next_service_date: notice.next_service_date,
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
      churchDefaults={churchDefaults}
      finance={{
        service: serviceFinance,
        churchAllTime: churchAllTimeTotal,
        currency: "GBP",
      }}
      closeState={closeState}
      unattributed={unattributed}
      sameDayUntagged={JSON.parse(JSON.stringify(unattributedSameDay))}
      events={eventOptions}
    />
  );
}
