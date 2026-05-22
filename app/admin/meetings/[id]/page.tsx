import { notFound } from "next/navigation";
import { headers } from "next/headers";
import * as db from "@/lib/db";
import * as mockDb from "@/lib/mock-db";
import { getAdminReadContext } from "@/lib/admin/read-context";
import { getDefaultLodgeSlug } from "@/lib/tenant";
import { getMeetingReadiness } from "@/lib/meetings/readiness";
import { lodgeScopedEventPath } from "@/lib/public-links";
import { MeetingDetailClient } from "./meeting-detail-client";

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
  });

  const reqHeaders = await headers();
  const origin = siteOrigin(
    reqHeaders.get("x-forwarded-host") ?? reqHeaders.get("host"),
    reqHeaders.get("x-forwarded-proto")
  );
  const publicPath = lodgeScopedEventPath(lodgeSlug, event.slug);
  const publicUrl = `${origin}${publicPath}`;

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
    />
  );
}
