import { notFound } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import * as db from "@/lib/db";
import * as mockDb from "@/lib/mock-db";
import { getAdminReadContext } from "@/lib/admin/read-context";
import { EventForm } from "@/components/forms/event-form";
import { AttendanceCheckin } from "@/components/admin/attendance-checkin";
import { formatDate } from "@/lib/utils";
import {
  Calendar,
  MapPin,
  Clock,
  Users,
  AlertTriangle,
  Banknote,
  Heart,
  Gift,
  ArrowLeft,
} from "lucide-react";
import { CopyPaymentLink } from "@/components/admin/copy-payment-link";

export default async function EditEventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await getAdminReadContext();
  const useMock = ctx.mode === "mock";
  const lodgeId = ctx.mode === "database" ? ctx.lodgeId : null;
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

  const payments = useMock
    ? mockDb.getPayments()
    : lodgeId
      ? await db.getPayments(lodgeId)
      : [];

  const eventPayments = payments.filter((p) => p.event_id === id);

  const eventDate = event.event_date as string;
  const isPast = new Date(eventDate) < new Date();
  const rsvpDeadline = event.rsvp_deadline as string | null;
  const deadlineExpired = rsvpDeadline ? new Date(rsvpDeadline) < new Date() : false;
  const maxAttendees = (event.max_attendees as number | null) ?? null;
  const rsvpCount = rsvps.length;
  const atCapacity = maxAttendees !== null && rsvpCount >= maxAttendees;

  const succeededPayments = eventPayments.filter((p) => p.status === "succeeded");
  const pendingPayments = eventPayments.filter((p) => p.status === "pending");
  const totalRevenue = succeededPayments.reduce((s, p) => s + p.total_amount, 0);
  const diningRevenue = succeededPayments.reduce((s, p) => s + p.dining_amount, 0);
  const charityRevenue = succeededPayments.reduce((s, p) => s + p.charity_amount, 0);
  const raffleRevenue = succeededPayments.reduce((s, p) => s + p.raffle_amount, 0);
  const outstandingAmount = pendingPayments.reduce((s, p) => s + p.total_amount, 0);
  const giftAidEligible = charityRevenue * 0.25;

  const rsvpList = rsvps.map((r) => ({
    id: r.id,
    user_name: r.user_name,
    user_email: r.user_email,
    status: r.status,
  }));

  const defaultValues = {
    title: event.title as string,
    slug: event.slug as string,
    description: (event.description as string) ?? "",
    event_type: event.event_type as "lodge_meeting" | "lodge_of_instruction" | "social" | "charity",
    event_date: eventDate ? new Date(eventDate).toISOString().slice(0, 16) : "",
    event_time: (event.event_time as string) ?? "",
    location: (event.location as string) ?? "",
    temple_room: (event.temple_room as string) ?? "",
    dress_code: (event.dress_code as string) ?? "",
    enable_rsvp: event.enable_rsvp !== false,
    enable_payments: event.enable_payments === true,
    enable_dining_rsvp: event.enable_dining_rsvp === true,
    dining_price: event.dining_price as number | undefined,
    dining_description: (event.dining_description as string) ?? "",
    enable_charity_donation: event.enable_charity_donation === true,
    charity_name: (event.charity_name as string) ?? "",
    charity_description: (event.charity_description as string) ?? "",
    enable_raffle_donation: event.enable_raffle_donation === true,
    raffle_description: (event.raffle_description as string) ?? "",
    enable_meeting_fee: event.enable_meeting_fee === true,
    meeting_fee_amount: event.meeting_fee_amount ?? undefined,
    meeting_fee_description: event.meeting_fee_description ?? "",
    enable_guest_tickets: event.enable_guest_tickets === true,
    guest_ticket_price: event.guest_ticket_price ?? undefined,
    guest_ticket_description: event.guest_ticket_description ?? "",
    published: event.published !== false,
  };

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-center gap-3">
        <Button asChild variant="secondary" size="sm">
          <Link href="/admin/meetings">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to meetings
          </Link>
        </Button>
        {event.enable_payments && (
          <CopyPaymentLink slug={event.slug} />
        )}
      </div>

      <h1 className="mb-2 text-3xl font-semibold tracking-tight text-dash-text">
        {event.title as string}
      </h1>

      <div className="mb-8 flex flex-wrap items-center gap-3">
        <span className="flex items-center gap-1.5 text-sm text-dash-muted">
          <Calendar className="h-4 w-4" />
          {formatDate(eventDate)}
        </span>
        {event.location && (
          <span className="flex items-center gap-1.5 text-sm text-dash-muted">
            <MapPin className="h-4 w-4" />
            {event.location as string}
          </span>
        )}
        {event.event_time && (
          <span className="flex items-center gap-1.5 text-sm text-dash-muted">
            <Clock className="h-4 w-4" />
            {event.event_time as string}
          </span>
        )}
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
          isPast
            ? "bg-slate-100 text-slate-700"
            : "bg-blue-50 text-blue-800"
        }`}>
          {isPast ? "Past" : "Upcoming"}
        </span>
      </div>

      {/* RSVP Deadline & Capacity */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {rsvpDeadline && (
          <div className="admin-surface p-5">
            <div className="flex items-center justify-between">
              <span className="text-sm text-dash-muted">RSVP Deadline</span>
              {deadlineExpired ? (
                <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-800 uppercase tracking-wider">
                  Expired
                </span>
              ) : (
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 uppercase tracking-wider">
                  Open
                </span>
              )}
            </div>
            <p className="mt-3 text-lg font-semibold text-dash-text">{formatDate(rsvpDeadline)}</p>
          </div>
        )}

        <div className="admin-surface p-5">
          <div className="flex items-center justify-between">
            <span className="text-sm text-dash-muted">RSVPs</span>
            <Users className="h-4 w-4 text-dash-muted" />
          </div>
          <p className="mt-3 text-lg font-semibold text-dash-text">
            {rsvpCount}{maxAttendees !== null ? ` / ${maxAttendees}` : ""}
          </p>
          {maxAttendees !== null && (
            <>
              <div className="mt-2 h-1.5 rounded-full bg-dash-border overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    atCapacity
                      ? "bg-gradient-to-r from-rose-500 to-rose-400"
                      : "bg-gradient-to-r from-blue-500 to-blue-400"
                  }`}
                  style={{ width: `${Math.min(100, Math.round((rsvpCount / maxAttendees) * 100))}%` }}
                />
              </div>
              {atCapacity && (
                <div className="mt-2 flex items-center gap-1.5 text-xs text-amber-700">
                  <AlertTriangle className="h-3 w-3" />
                  At capacity. Waitlist active
                </div>
              )}
            </>
          )}
        </div>

        <div className="admin-surface p-5">
          <div className="flex items-center justify-between">
            <span className="text-sm text-dash-muted">Payment Status</span>
            <Banknote className="h-4 w-4 text-dash-muted" />
          </div>
          <p className="mt-3 text-lg font-semibold text-emerald-700">
            £{totalRevenue.toFixed(2)}
          </p>
          {pendingPayments.length > 0 && (
            <p className="mt-1 text-xs text-amber-700">
              {pendingPayments.length} pending (£{outstandingAmount.toFixed(2)})
            </p>
          )}
        </div>
      </div>

      {/* Attendance Check-in */}
      {event.enable_rsvp && (
        <div className="mb-8">
          <AttendanceCheckin eventId={id} rsvps={rsvpList} />
        </div>
      )}

      {/* Post-Event Reconciliation */}
      {isPast && (
        <div className="admin-surface mb-8 p-6">
          <h2 className="text-lg font-semibold text-dash-text mb-5">Post-Event Reconciliation</h2>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-6">
            <div className="rounded-xl border border-dash-border bg-dash-surface-subtle p-4">
              <div className="flex items-center gap-2 text-sm text-dash-muted mb-2">
                <Users className="h-4 w-4" /> Attendees vs RSVPs
              </div>
              <p className="text-2xl font-semibold text-dash-text">{rsvpCount}</p>
              <p className="text-xs text-dash-muted mt-1">RSVPs received</p>
            </div>
            <div className="rounded-xl border border-dash-border bg-dash-surface-subtle p-4">
              <div className="flex items-center gap-2 text-sm text-dash-muted mb-2">
                <Banknote className="h-4 w-4" /> Total Revenue
              </div>
              <p className="text-2xl font-semibold text-emerald-700">
                £{totalRevenue.toFixed(2)}
              </p>
              <p className="text-xs text-dash-muted mt-1">
                {succeededPayments.length} payments
              </p>
            </div>
            <div className="rounded-xl border border-dash-border bg-dash-surface-subtle p-4">
              <div className="flex items-center gap-2 text-sm text-dash-muted mb-2">
                <AlertTriangle className="h-4 w-4" /> Outstanding
              </div>
              <p className={`text-2xl font-semibold ${outstandingAmount > 0 ? "text-amber-700" : "text-emerald-700"}`}>
                £{outstandingAmount.toFixed(2)}
              </p>
              <p className="text-xs text-dash-muted mt-1">
                {pendingPayments.length} unpaid
              </p>
            </div>
            <div className="rounded-xl border border-dash-border bg-dash-surface-subtle p-4">
              <div className="flex items-center gap-2 text-sm text-dash-muted mb-2">
                <Heart className="h-4 w-4" /> Gift Aid Eligible
              </div>
              <p className="text-2xl font-semibold text-purple-700">
                £{giftAidEligible.toFixed(2)}
              </p>
              <p className="text-xs text-dash-muted mt-1">25% of charity donations</p>
            </div>
          </div>

          <h3 className="text-sm font-medium text-dash-text mb-3">Revenue Breakdown</h3>
          <div className="admin-table-shell">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Category</th>
                  <th className="text-right">Amount</th>
                  <th className="text-right">% of Total</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <span className="flex items-center gap-2">
                      <Banknote className="h-3.5 w-3.5 text-blue-600" /> Dining
                    </span>
                  </td>
                  <td className="text-right text-dash-text">£{diningRevenue.toFixed(2)}</td>
                  <td className="text-right text-dash-muted">
                    {totalRevenue > 0 ? Math.round((diningRevenue / totalRevenue) * 100) : 0}%
                  </td>
                </tr>
                <tr>
                  <td>
                    <span className="flex items-center gap-2">
                      <Heart className="h-3.5 w-3.5 text-emerald-600" /> Charity
                    </span>
                  </td>
                  <td className="text-right text-dash-text">£{charityRevenue.toFixed(2)}</td>
                  <td className="text-right text-dash-muted">
                    {totalRevenue > 0 ? Math.round((charityRevenue / totalRevenue) * 100) : 0}%
                  </td>
                </tr>
                <tr>
                  <td>
                    <span className="flex items-center gap-2">
                      <Gift className="h-3.5 w-3.5 text-amber-600" /> Raffle
                    </span>
                  </td>
                  <td className="text-right text-dash-text">£{raffleRevenue.toFixed(2)}</td>
                  <td className="text-right text-dash-muted">
                    {totalRevenue > 0 ? Math.round((raffleRevenue / totalRevenue) * 100) : 0}%
                  </td>
                </tr>
              </tbody>
              <tfoot>
                <tr className="border-t border-dash-border">
                  <td className="font-semibold text-dash-text">Total</td>
                  <td className="text-right font-semibold text-dash-text">£{totalRevenue.toFixed(2)}</td>
                  <td className="text-right text-dash-muted">100%</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Edit Form */}
      <div className="admin-surface p-6">
        <h2 className="text-lg font-semibold text-dash-text mb-5">Edit Event Details</h2>
        <EventForm eventId={id} defaultValues={defaultValues} />
      </div>
    </div>
  );
}
