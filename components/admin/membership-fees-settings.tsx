"use client";

import { useEffect, useState } from "react";
import {
  PoundSterling,
  Save,
  CheckCircle2,
  AlertCircle,
  CreditCard,
  Repeat,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";

interface FeesData {
  name: string;
  amount: number;
  currency: string;
  billing_period: string;
  active: boolean;
  allow_instalments: boolean;
  instalment_count: number;
  instalment_frequency: string;
}

export function MembershipFeesSettings() {
  const [fees, setFees] = useState<FeesData>({
    name: "Annual Subscription",
    amount: 150,
    currency: "gbp",
    billing_period: "annual",
    active: true,
    allow_instalments: false,
    instalment_count: 12,
    instalment_frequency: "monthly",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/settings/membership-fees");
        if (res.ok) {
          const data = await res.json();
          if (data.fees) {
            setFees({
              name: data.fees.name ?? "Annual Subscription",
              amount: data.fees.amount ?? 150,
              currency: data.fees.currency ?? "gbp",
              billing_period: data.fees.billing_period ?? "annual",
              active: data.fees.active !== false,
              allow_instalments: data.fees.allow_instalments ?? false,
              instalment_count: data.fees.instalment_count ?? 12,
              instalment_frequency: data.fees.instalment_frequency ?? "monthly",
            });
          }
        }
      } catch {
        /* empty */
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/settings/membership-fees", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fees),
      });
      if (res.ok) {
        setMessage({ type: "success", text: "Membership fees updated successfully" });
      } else {
        setMessage({ type: "error", text: "Failed to update fees" });
      }
    } catch {
      setMessage({ type: "error", text: "Something went wrong" });
    } finally {
      setSaving(false);
    }
  }

  const instalmentAmount = fees.allow_instalments && fees.instalment_count > 0
    ? (fees.amount / fees.instalment_count).toFixed(2)
    : null;

  if (loading) {
    return (
      <div className="rounded-2xl border border-dash-border bg-dash-surface p-6 animate-pulse">
        <div className="space-y-4">
          <div className="h-5 w-48 rounded bg-dash-surface-subtle" />
          <div className="h-10 w-32 rounded bg-dash-surface-subtle" />
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSave}>
      <Card variant="panel" className="overflow-hidden p-0">
        <div className="dash-panel-header rounded-none border-dash-border bg-dash-surface-subtle">
          <div>
            <h2 className="dash-panel-header-title flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Membership Fees
            </h2>
            <p className="dash-panel-header-description">
              Configure annual dues amount and instalment payment options.
            </p>
          </div>
        </div>
        <CardContent className="border-t border-dash-border bg-dash-surface p-5 md:p-6 space-y-6">
          {message && (
            <div
              className={`flex items-center gap-2 rounded-xl px-4 py-3 text-sm ${
                message.type === "success"
                  ? "bg-emerald-50 border border-emerald-100 text-emerald-700"
                  : "bg-red-50 border border-red-100 text-red-700"
              }`}
            >
              {message.type === "success" ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <AlertCircle className="h-4 w-4" />
              )}
              {message.text}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="space-y-2">
              <Label htmlFor="feeName">Name / label</Label>
              <Input
                id="feeName"
                value={fees.name}
                onChange={(e) => setFees({ ...fees, name: e.target.value })}
                placeholder="e.g. Annual Subscription"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="feeAmount">Annual amount (£)</Label>
              <div className="relative">
                <PoundSterling className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-dash-muted" />
                <Input
                  id="feeAmount"
                  type="number"
                  step="0.01"
                  min="0"
                  className="pl-9"
                  value={fees.amount}
                  onChange={(e) => setFees({ ...fees, amount: Number(e.target.value) })}
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-dash-border p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-dash-surface-subtle">
                <CheckCircle2 className="h-4 w-4 text-dash-muted" />
              </div>
              <div>
                <p className="text-sm font-medium text-dash-text">Active</p>
                <p className="text-xs text-dash-muted">Members will be billed for these dues</p>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={fees.active}
              onClick={() => setFees({ ...fees, active: !fees.active })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                fees.active ? "bg-emerald-500" : "bg-slate-200"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  fees.active ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          <div className="rounded-xl border border-dash-border p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-dash-surface-subtle">
                  <Repeat className="h-4 w-4 text-dash-muted" />
                </div>
                <div>
                  <p className="text-sm font-medium text-dash-text">Allow instalment payments</p>
                  <p className="text-xs text-dash-muted">
                    Let members split their annual dues via Stripe subscription
                  </p>
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={fees.allow_instalments}
                onClick={() => setFees({ ...fees, allow_instalments: !fees.allow_instalments })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  fees.allow_instalments ? "bg-emerald-500" : "bg-slate-200"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    fees.allow_instalments ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            {fees.allow_instalments && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-dash-border">
                <div className="space-y-2">
                  <Label htmlFor="instalmentCount">Number of instalments</Label>
                  <select
                    id="instalmentCount"
                    className="flex h-11 w-full rounded-xl border border-dash-border bg-dash-surface px-3 py-2 text-sm"
                    value={fees.instalment_count}
                    onChange={(e) => setFees({ ...fees, instalment_count: Number(e.target.value) })}
                  >
                    <option value={2}>2</option>
                    <option value={3}>3</option>
                    <option value={4}>4 (quarterly)</option>
                    <option value={6}>6 (bi-monthly)</option>
                    <option value={12}>12 (monthly)</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="instalmentFrequency">Frequency</Label>
                  <select
                    id="instalmentFrequency"
                    className="flex h-11 w-full rounded-xl border border-dash-border bg-dash-surface px-3 py-2 text-sm"
                    value={fees.instalment_frequency}
                    onChange={(e) => setFees({ ...fees, instalment_frequency: e.target.value })}
                  >
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                  </select>
                </div>
                {instalmentAmount && (
                  <div className="sm:col-span-2 rounded-lg bg-blue-50 border border-blue-100 p-3">
                    <p className="text-sm text-blue-700">
                      Members will pay{" "}
                      <span className="font-semibold">£{instalmentAmount}</span> per{" "}
                      {fees.instalment_frequency === "monthly" ? "month" : "quarter"}{" "}
                      over {fees.instalment_count} payments.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex justify-end pt-2">
            <Button type="submit" variant="primary" disabled={saving}>
              {saving ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Saving...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Save className="h-4 w-4" />
                  Save Membership Fees
                </span>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
