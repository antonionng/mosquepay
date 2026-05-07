"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, Save } from "lucide-react";

type Campaign = { id: string; name: string; status: string };
type Declaration = { id: string; donor_name: string; donor_email: string };
type EventOption = { id: string; title: string; event_date: string };

export function NewDonationClient({
  campaigns,
  declarations,
  events,
}: {
  campaigns: Campaign[];
  declarations: Declaration[];
  events: EventOption[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    donor_name: "",
    donor_email: "",
    amount: "",
    currency: "GBP",
    source: "manual",
    status: "completed",
    campaign_id: "",
    event_id: "",
    gift_aid_declaration_id: "",
    gift_aid_status: "unknown" as "unknown" | "eligible" | "declared" | "declined",
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const payload = {
        donor_name: form.donor_name || null,
        donor_email: form.donor_email,
        amount: Number(form.amount),
        currency: form.currency,
        source: form.source,
        status: form.status,
        campaign_id: form.campaign_id || null,
        event_id: form.event_id || null,
        gift_aid_declaration_id: form.gift_aid_declaration_id || null,
        gift_aid_status: form.gift_aid_status,
      };
      const res = await fetch("/api/donations/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not save donation.");
      router.push(`/admin/donations/${body.donation.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save donation.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="admin-page-head">
        <div>
          <h1 className="admin-page-title">Add manual donation</h1>
          <p className="admin-page-copy">
            Record offline gifts (cheque, bank transfer, cash) or correct an existing entry.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/admin/donations" className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Back to donations
          </Link>
        </Button>
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-900">
          {error}
        </div>
      ) : null}

      <form onSubmit={submit} className="grid gap-6 lg:grid-cols-3">
        <Card variant="panel" className="space-y-4 p-5 lg:col-span-2">
          <h2 className="text-base font-semibold text-dash-text">Donor and amount</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Donor name">
              <Input
                value={form.donor_name}
                onChange={(v) => setForm({ ...form, donor_name: v })}
                placeholder="Anonymous if blank"
              />
            </Field>
            <Field label="Donor email" required>
              <Input
                type="email"
                value={form.donor_email}
                onChange={(v) => setForm({ ...form, donor_email: v })}
                required
              />
            </Field>
            <Field label="Amount" required>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-dash-faint">
                  £
                </span>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  required
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  className="h-10 w-full rounded-lg border border-dash-border bg-dash-surface pl-7 pr-3 text-sm text-dash-text"
                />
              </div>
            </Field>
            <Field label="Currency">
              <select
                value={form.currency}
                onChange={(e) => setForm({ ...form, currency: e.target.value })}
                className="h-10 w-full rounded-lg border border-dash-border bg-dash-surface px-3 text-sm text-dash-text"
              >
                <option value="GBP">GBP</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
              </select>
            </Field>
            <Field label="Source">
              <select
                value={form.source}
                onChange={(e) => setForm({ ...form, source: e.target.value })}
                className="h-10 w-full rounded-lg border border-dash-border bg-dash-surface px-3 text-sm text-dash-text"
              >
                <option value="manual">Manual entry</option>
                <option value="cheque">Cheque</option>
                <option value="bank_transfer">Bank transfer</option>
                <option value="cash">Cash</option>
                <option value="event">Event collection</option>
                <option value="campaign">Campaign</option>
                <option value="direct">Direct</option>
              </select>
            </Field>
            <Field label="Status">
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="h-10 w-full rounded-lg border border-dash-border bg-dash-surface px-3 text-sm text-dash-text"
              >
                <option value="completed">Completed</option>
                <option value="pending">Pending</option>
                <option value="failed">Failed</option>
                <option value="refunded">Refunded</option>
              </select>
            </Field>
          </div>
        </Card>

        <Card variant="panel" className="space-y-4 p-5">
          <h2 className="text-base font-semibold text-dash-text">Links</h2>
          <Field label="Campaign">
            <select
              value={form.campaign_id}
              onChange={(e) => setForm({ ...form, campaign_id: e.target.value })}
              className="h-10 w-full rounded-lg border border-dash-border bg-dash-surface px-3 text-sm text-dash-text"
            >
              <option value="">No campaign</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.status})
                </option>
              ))}
            </select>
          </Field>
          <Field label="Event">
            <select
              value={form.event_id}
              onChange={(e) => setForm({ ...form, event_id: e.target.value })}
              className="h-10 w-full rounded-lg border border-dash-border bg-dash-surface px-3 text-sm text-dash-text"
            >
              <option value="">Not from an event</option>
              {events.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.title} ({new Date(ev.event_date).toLocaleDateString("en-GB")})
                </option>
              ))}
            </select>
          </Field>
          <Field label="Gift Aid declaration">
            <select
              value={form.gift_aid_declaration_id}
              onChange={(e) =>
                setForm({ ...form, gift_aid_declaration_id: e.target.value })
              }
              className="h-10 w-full rounded-lg border border-dash-border bg-dash-surface px-3 text-sm text-dash-text"
            >
              <option value="">No declaration linked</option>
              {declarations.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.donor_name} ({d.donor_email})
                </option>
              ))}
            </select>
          </Field>
          <Field label="Gift Aid status">
            <select
              value={form.gift_aid_status}
              onChange={(e) =>
                setForm({
                  ...form,
                  gift_aid_status: e.target.value as typeof form.gift_aid_status,
                })
              }
              className="h-10 w-full rounded-lg border border-dash-border bg-dash-surface px-3 text-sm text-dash-text"
            >
              <option value="unknown">Unknown</option>
              <option value="eligible">Eligible</option>
              <option value="declared">Declared</option>
              <option value="declined">Declined</option>
            </select>
          </Field>
        </Card>

        <div className="lg:col-span-3 flex justify-end gap-2">
          <Button asChild variant="ghost">
            <Link href="/admin/donations">Cancel</Link>
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save donation
          </Button>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-xs font-medium text-dash-text-muted">
      <span className="mb-1 block">
        {label}
        {required ? <span className="text-rose-600"> *</span> : null}
      </span>
      {children}
    </label>
  );
}

function Input({
  value,
  onChange,
  type,
  required,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <input
      type={type ?? "text"}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      required={required}
      placeholder={placeholder}
      className="h-10 w-full rounded-lg border border-dash-border bg-dash-surface px-3 text-sm text-dash-text placeholder:text-dash-faint"
    />
  );
}
