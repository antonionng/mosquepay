import * as db from "@/lib/db";
import * as mockDb from "@/lib/mock-db";
import { getAdminReadContext } from "@/lib/admin/read-context";
import { AdminServicesClient } from "./services-client";
import { getServiceReadiness } from "@/lib/services/readiness";

export const dynamic = "force-dynamic";

export default async function AdminServicesPage() {
  const ctx = await getAdminReadContext();
  const useMock = ctx.mode === "mock";
  const mosqueId = ctx.mode === "database" ? ctx.mosqueId : null;

  const allEvents = useMock
    ? mockDb.getEvents()
    : mosqueId
      ? await db.getEvents(mosqueId)
      : [];

  const serviceTypes = ["regular_service", "mosque_service", "special_service", "mosque_of_instruction", "committee", "emergency"];
  const services = allEvents.filter((e) => serviceTypes.includes(e.event_type));

  const mosqueDefaults = mosqueId ? await db.getMosqueFeeDefaults(mosqueId) : null;

  // Fetch every payment for the mosque once and bucket by event_id so each
  // service row can show "£X raised". Pulling once is cheap (payments are
  // a small table per mosque) and saves N round trips on the list page.
  const allPayments =
    mosqueId && !useMock ? await db.getPayments(mosqueId) : [];
  const SUCCEEDED_STATUS = new Set([
    "succeeded",
    "completed",
    "paid",
    "partially_refunded",
  ]);
  const financeMap: Record<
    string,
    { raised: number; pending: number; count: number }
  > = {};
  for (const p of allPayments) {
    if (!p.event_id) continue;
    const bucket = financeMap[p.event_id] ?? {
      raised: 0,
      pending: 0,
      count: 0,
    };
    if (SUCCEEDED_STATUS.has(p.status)) {
      bucket.raised += Math.max(0, p.total_amount - (p.refund_amount ?? 0));
      bucket.count += 1;
    } else if (p.status === "pending") {
      bucket.pending += p.total_amount;
    }
    financeMap[p.event_id] = bucket;
  }

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
  const readinessMap: Record<string, ReturnType<typeof getServiceReadiness>> = {};

  for (const m of services) {
    const rsvps = useMock
      ? mockDb.getRsvpsByEventId(m.id)
      : mosqueId
        ? await db.getRsvpsByEventId(m.id, mosqueId)
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
      raffle_wine_pledged:
        (r as { raffle_wine_pledged?: boolean }).raffle_wine_pledged ?? false,
      raffle_wine_bottles:
        (r as { raffle_wine_bottles?: number }).raffle_wine_bottles ?? 0,
      raffle_wine_note:
        (r as { raffle_wine_note?: string | null }).raffle_wine_note ?? null,
    }));

    let hasNotice = false;
    let noticeSentCount = 0;
    if (mosqueId) {
      const notice = await db.getServiceNotice(m.id, mosqueId);
      hasNotice = Boolean(notice);
      const sends = await db.listServiceNoticeSends(mosqueId, m.id, 10);
      noticeSentCount = sends.reduce((a, s) => a + s.sent_count, 0);
    }

    readinessMap[m.id] = getServiceReadiness({
      event_date: m.event_date,
      enable_rsvp: m.enable_rsvp,
      enable_dining_rsvp: m.enable_dining_rsvp,
      dining_price: m.dining_price,
      enable_payments: m.enable_payments,
      enable_charity_donation: m.enable_charity_donation,
      charity_name: m.charity_name,
      enable_service_fee: m.enable_service_fee,
      service_fee_amount: m.service_fee_amount,
      enable_guest_tickets: m.enable_guest_tickets,
      guest_ticket_price: m.guest_ticket_price,
      published: m.published,
      hasNotice,
      noticeSentCount,
      noticeStatus: m.notice_status as
        | "none"
        | "draft"
        | "approved"
        | "sent"
        | undefined,
      mosqueDefaults,
    });
  }

  return (
    <AdminServicesClient
      services={JSON.parse(JSON.stringify(services))}
      rsvpMap={JSON.parse(JSON.stringify(rsvpMap))}
      readinessMap={JSON.parse(JSON.stringify(readinessMap))}
      financeMap={financeMap}
    />
  );
}
