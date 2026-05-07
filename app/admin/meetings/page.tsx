import * as db from "@/lib/db";
import * as mockDb from "@/lib/mock-db";
import { getAdminReadContext } from "@/lib/admin/read-context";
import { AdminMeetingsClient } from "./meetings-client";
import { getMeetingReadiness } from "@/lib/meetings/readiness";

export default async function AdminMeetingsPage() {
  const ctx = await getAdminReadContext();
  const useMock = ctx.mode === "mock";
  const lodgeId = ctx.mode === "database" ? ctx.lodgeId : null;

  const allEvents = useMock
    ? mockDb.getEvents()
    : lodgeId
      ? await db.getEvents(lodgeId)
      : [];

  const meetingTypes = ["regular_meeting", "lodge_meeting", "installation", "lodge_of_instruction", "committee", "emergency"];
  const meetings = allEvents.filter((e) => meetingTypes.includes(e.event_type));

  const rsvpMap: Record<
    string,
    Array<{
      id: string;
      user_name: string;
      user_email: string;
      user_phone: string | null;
      status: string;
      attending_ceremony: boolean;
      attending_dining: boolean;
      number_of_guests: number;
      dietary_requirements: string | null;
      special_requests: string | null;
      payment_required: boolean;
      payment_completed: boolean;
    }>
  > = {};
  const readinessMap: Record<string, ReturnType<typeof getMeetingReadiness>> = {};

  for (const m of meetings) {
    const rsvps = useMock
      ? mockDb.getRsvpsByEventId(m.id)
      : lodgeId
        ? await db.getRsvpsByEventId(m.id, lodgeId)
        : [];
    rsvpMap[m.id] = rsvps.map((r) => ({
      id: r.id,
      user_name: r.user_name,
      user_email: r.user_email,
      user_phone: r.user_phone,
      status: r.status,
      attending_ceremony: r.attending_ceremony,
      attending_dining: r.attending_dining,
      number_of_guests: r.number_of_guests,
      dietary_requirements: r.dietary_requirements,
      special_requests: r.special_requests,
      payment_required: r.payment_required,
      payment_completed: r.payment_completed,
    }));

    let hasSummons = false;
    let summonsSentCount = 0;
    if (lodgeId) {
      const summons = await db.getEventSummons(m.id, lodgeId);
      hasSummons = Boolean(summons);
      const sends = await db.listEventSummonsSends(lodgeId, m.id, 10);
      summonsSentCount = sends.reduce((a, s) => a + s.sent_count, 0);
    }

    readinessMap[m.id] = getMeetingReadiness({
      event_date: m.event_date,
      enable_rsvp: m.enable_rsvp,
      enable_dining_rsvp: m.enable_dining_rsvp,
      dining_price: m.dining_price,
      enable_payments: m.enable_payments,
      enable_charity_donation: m.enable_charity_donation,
      charity_name: m.charity_name,
      enable_meeting_fee: m.enable_meeting_fee,
      meeting_fee_amount: m.meeting_fee_amount,
      enable_guest_tickets: m.enable_guest_tickets,
      guest_ticket_price: m.guest_ticket_price,
      published: m.published,
      hasSummons,
      summonsSentCount,
    });
  }

  return (
    <AdminMeetingsClient
      meetings={JSON.parse(JSON.stringify(meetings))}
      rsvpMap={JSON.parse(JSON.stringify(rsvpMap))}
      readinessMap={JSON.parse(JSON.stringify(readinessMap))}
    />
  );
}
