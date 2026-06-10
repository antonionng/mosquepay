import * as db from "@/lib/db";
import { getAdminReadContext } from "@/lib/admin/read-context";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { formatDate } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  CreditCard,
  Banknote,
  Heart,
  Gift,
  Calendar,
  ExternalLink,
} from "lucide-react";
import { AttachToServiceCard } from "./attach-to-service";

export const dynamic = "force-dynamic";

const STATUS_TONE: Record<string, "success" | "warning" | "destructive" | "secondary"> = {
  completed: "success",
  succeeded: "success",
  paid: "success",
  pending: "warning",
  failed: "destructive",
  refunded: "destructive",
  partially_refunded: "warning",
};

export default async function AdminPaymentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await getAdminReadContext();
  if (ctx.mode !== "database" || !ctx.churchId) {
    redirect("/admin/payments");
  }
  const churchId = ctx.churchId;

  const payment = await db.getPaymentById(id, churchId);
  if (!payment) notFound();

  const [event, rsvp, donations, auditLogs, allEvents] = await Promise.all([
    payment.event_id
      ? db.getEventById(payment.event_id, churchId)
      : Promise.resolve(null),
    payment.rsvp_id ? db.getRsvpById(payment.rsvp_id, churchId) : Promise.resolve(null),
    db.getDonationsByEmail(payment.user_email, churchId),
    db.listAuditLogsByEntity(churchId, "payment", id),
    db.getEvents(churchId),
  ]);

  // Picker window: every upcoming service + 180 days of recent history,
  // capped to the 30 closest. Wide enough that a treasurer attaching a
  // payment after the fact can still see a future special_service that was
  // scheduled months ahead. The lint disable is for the react-hooks/purity
  // rule which flags Date.now in a server component, where it's fine.
  // eslint-disable-next-line react-hooks/purity
  const nowMs = Date.now();
  const eventPickerOptions = allEvents
    .filter((evt) => {
      const ts = new Date(evt.event_date).getTime();
      if (!Number.isFinite(ts)) return false;
      if (ts < nowMs - 180 * 24 * 60 * 60 * 1000) return false;
      return true;
    })
    .sort((a, b) => {
      const aDist = Math.abs(new Date(a.event_date).getTime() - nowMs);
      const bDist = Math.abs(new Date(b.event_date).getTime() - nowMs);
      return aDist - bDist;
    })
    .slice(0, 30)
    .map((evt) => ({
      id: evt.id,
      title: evt.title,
      event_date: evt.event_date,
    }));

  const linkedDonation = donations.find((d) => d.payment_id === id) ?? null;

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="admin-page-head">
        <div className="min-w-0 flex-1">
          <h1 className="admin-page-title flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-dash-muted" />
            £{payment.total_amount.toFixed(2)} from {payment.user_name ?? payment.user_email}
          </h1>
          <p className="admin-page-copy">
            {payment.currency.toUpperCase()} · {formatDate(payment.created_at)}
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/admin/payments" className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Back to payments
          </Link>
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card variant="panel" className="space-y-4 p-5">
            <h2 className="flex items-center gap-2 text-base font-semibold text-dash-text">
              <Banknote className="h-4 w-4" /> Breakdown
            </h2>
            <div className="grid gap-4 sm:grid-cols-3">
              <SplitCard label="Dining" value={payment.dining_amount} />
              <SplitCard label="Charity" value={payment.charity_amount} hint={payment.charity_name ?? undefined} icon={Heart} />
              <SplitCard label="Raffle" value={payment.raffle_amount} icon={Gift} />
              <SplitCard label="Service fee" value={payment.service_fee_amount} />
              <SplitCard label="Guest tickets" value={payment.guest_ticket_amount} />
              <SplitCard
                label="Refunded"
                value={payment.refund_amount}
                tone="destructive"
              />
            </div>
            {payment.refund_reason ? (
              <p className="text-xs text-dash-text-muted">
                Refund reason: {payment.refund_reason}
              </p>
            ) : null}
          </Card>

          <Card variant="panel" className="space-y-2 p-5">
            <h2 className="text-base font-semibold text-dash-text">Mooov</h2>
            {payment.mooov_payment_id ? (
              <p className="break-all text-sm text-dash-text">
                Mooov reference: <span className="font-mono">{payment.mooov_payment_id}</span>
              </p>
            ) : payment.stripe_payment_intent_id ? (
              <p className="break-all text-sm text-dash-text">
                Payment reference: <span className="font-mono">{payment.stripe_payment_intent_id}</span>
              </p>
            ) : (
              <p className="text-sm text-dash-text-muted">No payment reference recorded.</p>
            )}
          </Card>

          {auditLogs.length > 0 ? (
            <Card variant="panel" className="space-y-3 p-5">
              <h2 className="text-base font-semibold text-dash-text">History</h2>
              <ul className="divide-y divide-dash-border">
                {auditLogs.map((log) => (
                  <li key={log.id} className="py-2 text-sm">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="font-medium text-dash-text">
                        {log.action.replaceAll("_", " ")}
                      </span>
                      <span className="text-xs text-dash-text-muted">
                        {formatDate(log.created_at)}
                      </span>
                    </div>
                    <p className="text-xs text-dash-text-muted">
                      {log.actor_email ?? "system"}
                      {log.summary ? ` · ${log.summary}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </div>

        <aside className="space-y-4">
          <Card variant="panel" className="space-y-3 p-5">
            <h2 className="text-base font-semibold text-dash-text">Status</h2>
            <Badge variant={STATUS_TONE[payment.status] ?? "secondary"} className="capitalize">
              {payment.status}
            </Badge>
            <p className="text-xs text-dash-text-muted">
              Completed: {payment.completed_at ? formatDate(payment.completed_at) : "Not yet"}
            </p>
          </Card>

          <Card variant="panel" className="space-y-2 p-5">
            <h2 className="text-base font-semibold text-dash-text">Payer</h2>
            <p className="font-medium text-dash-text">
              {payment.user_name ?? "Not recorded"}
            </p>
            <p className="text-sm text-dash-text-muted">{payment.user_email}</p>
          </Card>

          <Card variant="panel" className="space-y-3 p-5">
            <h2 className="flex items-center gap-2 text-base font-semibold text-dash-text">
              <Calendar className="h-4 w-4" /> Service
            </h2>
            {event ? (
              <div className="space-y-1">
                <Link
                  href={`/admin/services/${event.id}`}
                  className="inline-flex items-center gap-1 text-sm font-medium text-dash-text hover:text-dash-ring"
                >
                  {event.title} <ExternalLink className="h-3 w-3" />
                </Link>
                <p className="text-xs text-dash-text-muted">
                  {formatDate(event.event_date)}
                </p>
              </div>
            ) : (
              <p className="text-xs text-dash-text-muted">
                Not linked to a service.
              </p>
            )}
            <AttachToServiceCard
              paymentId={payment.id}
              currentEventId={payment.event_id ?? null}
              events={eventPickerOptions}
            />
          </Card>

          {rsvp ? (
            <Card variant="panel" className="space-y-2 p-5">
              <h2 className="text-base font-semibold text-dash-text">RSVP</h2>
              <p className="text-sm text-dash-text">
                Status: {rsvp.status}
              </p>
              <p className="text-xs text-dash-text-muted">
                Guests: {rsvp.number_of_guests}
                {rsvp.attending_dining ? " · Dining: yes" : ""}
              </p>
            </Card>
          ) : null}

          {linkedDonation ? (
            <Card variant="panel" className="space-y-2 p-5">
              <h2 className="text-base font-semibold text-dash-text">Donation</h2>
              <Link
                href={`/admin/donations/${linkedDonation.id}`}
                className="inline-flex items-center gap-1 text-sm font-medium text-dash-text hover:text-dash-ring"
              >
                £{linkedDonation.amount.toFixed(2)} <ExternalLink className="h-3 w-3" />
              </Link>
              <p className="text-xs text-dash-text-muted capitalize">
                {linkedDonation.source.replaceAll("_", " ")} · {linkedDonation.status}
              </p>
            </Card>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

function SplitCard({
  label,
  value,
  hint,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  hint?: string;
  icon?: typeof Banknote;
  tone?: "destructive";
}) {
  return (
    <div className="rounded-xl border border-dash-border bg-dash-surface-subtle/40 p-4">
      <div className="mb-2 flex items-center gap-2 text-xs text-dash-text-muted">
        {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
        {label}
      </div>
      <p
        className={
          tone === "destructive" && value > 0
            ? "text-lg font-semibold text-rose-700"
            : "text-lg font-semibold text-dash-text"
        }
      >
        £{Number(value).toFixed(2)}
      </p>
      {hint ? (
        <p className="mt-1 text-xs text-dash-text-muted">{hint}</p>
      ) : null}
    </div>
  );
}
