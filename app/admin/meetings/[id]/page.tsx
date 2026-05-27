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
    />
  );
}
