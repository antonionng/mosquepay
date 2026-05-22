"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import {
  ArrowLeft,
  Banknote,
  CheckCircle2,
  CreditCard,
  ExternalLink,
  Gift,
  Heart,
  RefreshCw,
  Shield,
  Calendar,
  Clock,
} from "lucide-react";

type Donation = {
  id: string;
  donor_name: string | null;
  donor_email: string;
  amount: number;
  currency: string;
  source: string;
  status: string;
  campaign_id: string | null;
  event_id: string | null;
  payment_id: string | null;
  gift_aid_declaration_id: string | null;
  gift_aid_status: "unknown" | "eligible" | "declared" | "declined";
  created_at: string;
};

type Payment = {
  id: string;
  total_amount: number;
  status: string;
  stripe_payment_intent_id: string | null;
  created_at: string;
};

type Declaration = {
  id: string;
  donor_name: string;
  donor_email: string;
  donor_address_line_1: string | null;
  donor_city: string | null;
  donor_postcode: string | null;
  hmrc_eligible: boolean;
  declaration_confirmed: boolean;
  revoked_at: string | null;
};

type AuditLog = {
  id: string;
  action: string;
  actor_email: string | null;
  actor_role: string | null;
  summary: string | null;
  created_at: string;
};

const STATUS_TONE: Record<string, "success" | "warning" | "destructive" | "secondary"> = {
  completed: "success",
  succeeded: "success",
  paid: "success",
  pending: "warning",
  failed: "destructive",
  refunded: "destructive",
};

export function DonationDetailClient({
  donation: initial,
  payment,
  declaration,
  event,
  campaign,
  campaigns,
  declarations,
  events,
  auditLogs,
}: {
  donation: Donation;
  payment: Payment | null;
  declaration: Declaration | null;
  event: { id: string; title: string } | null;
  campaign: { id: string; name: string } | null;
  campaigns: Array<{ id: string; name: string }>;
  declarations: Array<{ id: string; donor_name: string; donor_email: string }>;
  events: Array<{ id: string; title: string }>;
  auditLogs: AuditLog[];
}) {
  const router = useRouter();
  const [donation, setDonation] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  async function patch(updates: Partial<Donation>) {
    setBusy(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/donations/${donation.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not save.");
      setDonation(body.donation);
      setFeedback("Saved.");
      router.refresh();
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="admin-page-head">
        <div className="min-w-0 flex-1">
          <h1 className="admin-page-title">
            £{donation.amount.toFixed(2)} from {donation.donor_name ?? donation.donor_email}
          </h1>
          <p className="admin-page-copy">
            {donation.source} donation, {formatDate(donation.created_at)}
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/admin/donations" className="gap-2">
            <ArrowLeft className="h-4 w-4" /> All donations
          </Link>
        </Button>
      </div>

      {feedback ? (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm text-blue-900">
          {feedback}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card variant="panel" className="space-y-4 p-5">
            <h2 className="flex items-center gap-2 text-base font-semibold text-dash-text">
              <Banknote className="h-4 w-4 text-emerald-600" /> Donation
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Donor name">
                <input
                  className={INPUT_CLASS}
                  defaultValue={donation.donor_name ?? ""}
                  onBlur={(e) =>
                    e.target.value !== (donation.donor_name ?? "") &&
                    patch({ donor_name: e.target.value || null })
                  }
                  disabled={busy}
                />
              </Field>
              <Field label="Donor email">
                <input
                  type="email"
                  className={INPUT_CLASS}
                  defaultValue={donation.donor_email}
                  onBlur={(e) =>
                    e.target.value !== donation.donor_email &&
                    patch({ donor_email: e.target.value })
                  }
                  disabled={busy}
                />
              </Field>
              <Field label="Amount">
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-dash-faint">
                    £
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className={`${INPUT_CLASS} pl-7`}
                    defaultValue={donation.amount}
                    onBlur={(e) => {
                      const n = Number(e.target.value);
                      if (Number.isFinite(n) && n !== donation.amount) {
                        patch({ amount: n });
                      }
                    }}
                    disabled={busy}
                  />
                </div>
              </Field>
              <Field label="Status">
                <select
                  className={INPUT_CLASS}
                  value={donation.status}
                  onChange={(e) => patch({ status: e.target.value })}
                  disabled={busy}
                >
                  <option value="completed">Completed</option>
                  <option value="pending">Pending</option>
                  <option value="failed">Failed</option>
                  <option value="refunded">Refunded</option>
                </select>
              </Field>
              <Field label="Source">
                <select
                  className={INPUT_CLASS}
                  value={donation.source}
                  onChange={(e) => patch({ source: e.target.value })}
                  disabled={busy}
                >
                  <option value="manual">Manual entry</option>
                  <option value="cheque">Cheque</option>
                  <option value="bank_transfer">Bank transfer</option>
                  <option value="cash">Cash</option>
                  <option value="event">Event collection</option>
                  <option value="campaign">Campaign</option>
                  <option value="direct">Direct</option>
                  <option value="online_donation">Online donation</option>
                </select>
              </Field>
              <Field label="Currency">
                <input
                  className={INPUT_CLASS}
                  value={donation.currency.toUpperCase()}
                  readOnly
                  disabled
                />
              </Field>
            </div>
          </Card>

          <Card variant="panel" className="space-y-4 p-5">
            <h2 className="flex items-center gap-2 text-base font-semibold text-dash-text">
              <Shield className="h-4 w-4 text-emerald-600" /> Gift Aid
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Gift Aid status">
                <select
                  className={INPUT_CLASS}
                  value={donation.gift_aid_status}
                  onChange={(e) =>
                    patch({
                      gift_aid_status: e.target.value as Donation["gift_aid_status"],
                    })
                  }
                  disabled={busy}
                >
                  <option value="unknown">Unknown</option>
                  <option value="eligible">Eligible</option>
                  <option value="declared">Declared</option>
                  <option value="declined">Declined</option>
                </select>
              </Field>
              <Field label="Linked declaration">
                <select
                  className={INPUT_CLASS}
                  value={donation.gift_aid_declaration_id ?? ""}
                  onChange={(e) =>
                    patch({
                      gift_aid_declaration_id: e.target.value || null,
                      gift_aid_status: e.target.value ? "declared" : donation.gift_aid_status,
                    })
                  }
                  disabled={busy}
                >
                  <option value="">No declaration linked</option>
                  {declarations.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.donor_name} ({d.donor_email})
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            {declaration ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 text-sm text-emerald-900">
                <p className="font-medium">{declaration.donor_name}</p>
                <p className="text-xs text-emerald-800">
                  {[
                    declaration.donor_address_line_1,
                    declaration.donor_city,
                    declaration.donor_postcode,
                  ]
                    .filter(Boolean)
                    .join(", ")}
                </p>
                <p className="mt-2 text-xs">
                  HMRC eligible: {declaration.hmrc_eligible ? "Yes" : "No"} ·
                  Confirmed: {declaration.declaration_confirmed ? "Yes" : "No"}
                </p>
                <Link
                  href={`/admin/gift-aid/${declaration.id}`}
                  className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-emerald-700 hover:underline"
                >
                  Open declaration <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
            ) : null}
          </Card>

          <Card variant="panel" className="space-y-4 p-5">
            <h2 className="flex items-center gap-2 text-base font-semibold text-dash-text">
              <Heart className="h-4 w-4 text-rose-500" /> Links
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Campaign">
                <select
                  className={INPUT_CLASS}
                  value={donation.campaign_id ?? ""}
                  onChange={(e) =>
                    patch({ campaign_id: e.target.value || null })
                  }
                  disabled={busy}
                >
                  <option value="">No campaign</option>
                  {campaigns.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Event">
                <select
                  className={INPUT_CLASS}
                  value={donation.event_id ?? ""}
                  onChange={(e) =>
                    patch({ event_id: e.target.value || null })
                  }
                  disabled={busy}
                >
                  <option value="">Not linked to an event</option>
                  {events.map((ev) => (
                    <option key={ev.id} value={ev.id}>
                      {ev.title}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              {campaign ? (
                <Link
                  href={`/admin/charity/${campaign.id}`}
                  className="inline-flex items-center gap-1 rounded-full border border-dash-border bg-dash-surface-subtle px-3 py-1 font-medium text-dash-text hover:border-dash-border-strong"
                >
                  <Heart className="h-3 w-3" /> {campaign.name}
                </Link>
              ) : null}
              {event ? (
                <Link
                  href={`/admin/events/${event.id}`}
                  className="inline-flex items-center gap-1 rounded-full border border-dash-border bg-dash-surface-subtle px-3 py-1 font-medium text-dash-text hover:border-dash-border-strong"
                >
                  <Calendar className="h-3 w-3" /> {event.title}
                </Link>
              ) : null}
            </div>
          </Card>

          <Card variant="panel" className="space-y-3 p-5">
            <h2 className="flex items-center gap-2 text-base font-semibold text-dash-text">
              <Clock className="h-4 w-4 text-dash-muted" /> History
            </h2>
            {auditLogs.length === 0 ? (
              <p className="text-sm text-dash-text-muted">
                No audit events recorded for this donation yet.
              </p>
            ) : (
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
            )}
          </Card>
        </div>

        <aside className="space-y-4">
          <Card variant="panel" className="space-y-3 p-5">
            <h2 className="text-base font-semibold text-dash-text">Summary</h2>
            <dl className="space-y-2 text-sm">
              <div className="flex items-baseline justify-between">
                <dt className="text-dash-text-muted">Status</dt>
                <dd>
                  <Badge
                    variant={STATUS_TONE[donation.status] ?? "secondary"}
                    className="capitalize"
                  >
                    {donation.status}
                  </Badge>
                </dd>
              </div>
              <div className="flex items-baseline justify-between">
                <dt className="text-dash-text-muted">Gift Aid</dt>
                <dd className="text-dash-text capitalize">{donation.gift_aid_status}</dd>
              </div>
              <div className="flex items-baseline justify-between">
                <dt className="text-dash-text-muted">Source</dt>
                <dd className="text-dash-text capitalize">{donation.source.replaceAll("_", " ")}</dd>
              </div>
              <div className="flex items-baseline justify-between">
                <dt className="text-dash-text-muted">Created</dt>
                <dd className="text-dash-text">{formatDate(donation.created_at)}</dd>
              </div>
            </dl>
          </Card>

          {payment ? (
            <Card variant="panel" className="space-y-3 p-5">
              <h2 className="flex items-center gap-2 text-base font-semibold text-dash-text">
                <CreditCard className="h-4 w-4" /> Linked payment
              </h2>
              <p className="text-2xl font-semibold text-dash-text">
                £{payment.total_amount.toFixed(2)}
              </p>
              <Badge variant={STATUS_TONE[payment.status] ?? "secondary"} className="capitalize">
                {payment.status}
              </Badge>
              {(payment.mooov_payment_id ?? payment.stripe_payment_intent_id) ? (
                <p className="break-all text-xs text-dash-text-muted">
                  Mooov reference: {payment.mooov_payment_id ?? payment.stripe_payment_intent_id}
                </p>
              ) : null}
              <p className="text-xs text-dash-text-muted">{formatDate(payment.created_at)}</p>
            </Card>
          ) : (
            <Card variant="panel" className="space-y-2 p-5">
              <h2 className="flex items-center gap-2 text-base font-semibold text-dash-text">
                <CreditCard className="h-4 w-4" /> Payment
              </h2>
              <p className="text-sm text-dash-text-muted">
                No online payment linked. This is recorded as an offline donation.
              </p>
            </Card>
          )}

          <Card variant="panel" className="space-y-2 p-5">
            <h2 className="flex items-center gap-2 text-base font-semibold text-dash-text">
              <Gift className="h-4 w-4" /> Quick actions
            </h2>
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              disabled={busy}
              onClick={() => patch({ status: donation.status === "completed" ? "refunded" : "completed" })}
            >
              {donation.status === "completed" ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" /> Mark refunded
                </>
              ) : (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" /> Mark completed
                </>
              )}
            </Button>
          </Card>
        </aside>
      </div>
    </div>
  );
}

const INPUT_CLASS =
  "h-10 w-full rounded-lg border border-dash-border bg-dash-surface px-3 text-sm text-dash-text placeholder:text-dash-faint focus:border-dash-ring focus:outline-none";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-xs font-medium text-dash-text-muted">
      <span className="mb-1 block">{label}</span>
      {children}
    </label>
  );
}
