"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, UserPlus } from "lucide-react";

export function NewNewcomerClient() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    location: "",
    how_heard: "Website",
    message: "",
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/newcomers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not create newcomer.");
      router.push(`/admin/newcomers/church/${body.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create newcomer.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="admin-page-head">
        <div>
          <h1 className="admin-page-title">New newcomer</h1>
          <p className="admin-page-copy">
            Capture a newcomer by name and email. You can fill in the rest later.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/admin/newcomers" className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Back to newcomers
          </Link>
        </Button>
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-900">
          {error}
        </div>
      ) : null}

      <Card variant="panel" className="space-y-4 p-5">
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          <Field label="First name" required>
            <Input
              value={form.first_name}
              onChange={(v) => setForm({ ...form, first_name: v })}
              required
            />
          </Field>
          <Field label="Last name" required>
            <Input
              value={form.last_name}
              onChange={(v) => setForm({ ...form, last_name: v })}
              required
            />
          </Field>
          <Field label="Email" required>
            <Input
              type="email"
              value={form.email}
              onChange={(v) => setForm({ ...form, email: v })}
              required
            />
          </Field>
          <Field label="Phone">
            <Input
              value={form.phone}
              onChange={(v) => setForm({ ...form, phone: v })}
            />
          </Field>
          <Field label="Location">
            <Input
              value={form.location}
              onChange={(v) => setForm({ ...form, location: v })}
            />
          </Field>
          <Field label="How they heard about us">
            <select
              value={form.how_heard}
              onChange={(e) => setForm({ ...form, how_heard: e.target.value })}
              className="h-10 w-full rounded-lg border border-dash-border bg-dash-surface px-3 text-sm text-dash-text"
            >
              <option value="Website">Website</option>
              <option value="Referral">Referral</option>
              <option value="Event">Event</option>
              <option value="Social Media">Social Media</option>
              <option value="Walk-in">Walk-in</option>
              <option value="Other">Other</option>
            </select>
          </Field>
          <div className="sm:col-span-2">
            <Field label="Initial message">
              <textarea
                rows={4}
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                className="w-full rounded-lg border border-dash-border bg-dash-surface px-3 py-2 text-sm text-dash-text"
              />
            </Field>
          </div>
          <div className="sm:col-span-2 flex justify-end gap-2">
            <Button asChild variant="ghost">
              <Link href="/admin/newcomers">Cancel</Link>
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <UserPlus className="mr-2 h-4 w-4" />
              )}
              Create newcomer
            </Button>
          </div>
        </form>
      </Card>
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
}: {
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <input
      type={type ?? "text"}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      required={required}
      className="h-10 w-full rounded-lg border border-dash-border bg-dash-surface px-3 text-sm text-dash-text"
    />
  );
}
