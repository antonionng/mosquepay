"use client";

import { useEffect, useState } from "react";
import {
  PoundSterling,
  Save,
  CheckCircle2,
  AlertCircle,
  CalendarPlus,
  CreditCard,
  Percent,
  Repeat,
  Sliders,
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
  charitable_amount: number;
  charitable_label: string;
  gift_aid_enabled: boolean;
  // Subscription / advance settings (migration 061).
  enable_strategy_catch_up_lump: boolean;
  enable_strategy_balloon: boolean;
  enable_strategy_reslice: boolean;
  auto_renew_default: boolean;
  year_start_prompt_days: number;
  catch_up_max_months: number;
  advance_discount_percent: number;
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
    charitable_amount: 0,
    charitable_label: "Charitable portion",
    gift_aid_enabled: false,
    enable_strategy_catch_up_lump: true,
    enable_strategy_balloon: false,
    enable_strategy_reslice: true,
    auto_renew_default: true,
    year_start_prompt_days: 30,
    catch_up_max_months: 6,
    advance_discount_percent: 0,
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
              charitable_amount: data.fees.charitable_amount ?? 0,
              charitable_label: data.fees.charitable_label ?? "Charitable portion",
              gift_aid_enabled: data.fees.gift_aid_enabled ?? false,
              enable_strategy_catch_up_lump:
                data.fees.enable_strategy_catch_up_lump ?? true,
              enable_strategy_balloon:
                data.fees.enable_strategy_balloon ?? false,
              enable_strategy_reslice:
                data.fees.enable_strategy_reslice ?? true,
              auto_renew_default: data.fees.auto_renew_default ?? true,
              year_start_prompt_days: data.fees.year_start_prompt_days ?? 30,
              catch_up_max_months: data.fees.catch_up_max_months ?? 6,
              advance_discount_percent:
                Number(data.fees.advance_discount_percent ?? 0),
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
              Configure annual giving amount and instalment payment options.
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

          <div className="rounded-xl border border-dash-border p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-dash-surface-subtle">
                  <PoundSterling className="h-4 w-4 text-dash-muted" />
                </div>
                <div>
                  <p className="text-sm font-medium text-dash-text">Gift Aid on giving</p>
                  <p className="text-xs text-dash-muted">
                    Itemise the charitable portion of annual giving so only the eligible part is reclaimed.
                  </p>
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={fees.gift_aid_enabled}
                onClick={() => setFees({ ...fees, gift_aid_enabled: !fees.gift_aid_enabled })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  fees.gift_aid_enabled ? "bg-emerald-500" : "bg-slate-200"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    fees.gift_aid_enabled ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            {fees.gift_aid_enabled && (
              <div className="grid grid-cols-1 gap-4 border-t border-dash-border pt-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="charitableLabel">Charitable portion label</Label>
                  <Input
                    id="charitableLabel"
                    value={fees.charitable_label}
                    onChange={(e) => setFees({ ...fees, charitable_label: e.target.value })}
                    placeholder="e.g. Relief chest contribution"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="charitableAmount">Eligible amount (£)</Label>
                  <div className="relative">
                    <PoundSterling className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-dash-muted" />
                    <Input
                      id="charitableAmount"
                      type="number"
                      step="0.01"
                      min="0"
                      max={fees.amount}
                      className="pl-9"
                      value={fees.charitable_amount}
                      onChange={(e) =>
                        setFees({ ...fees, charitable_amount: Number(e.target.value) })
                      }
                    />
                  </div>
                </div>
                <p className="text-xs leading-relaxed text-dash-muted sm:col-span-2">
                  Members still pay the full giving amount. MosquePay records only £
                  {Number(fees.charitable_amount || 0).toFixed(2)} as Gift Aid eligible when a valid declaration is on file.
                </p>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between rounded-xl border border-dash-border p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-dash-surface-subtle">
                <CheckCircle2 className="h-4 w-4 text-dash-muted" />
              </div>
              <div>
                <p className="text-sm font-medium text-dash-text">Active</p>
                <p className="text-xs text-dash-muted">Members will be billed for these giving</p>
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
                    Let members split their annual giving into a Mooov subscription
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

          {fees.allow_instalments && (
            <div className="rounded-xl border border-dash-border p-4 space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-dash-surface-subtle">
                  <Sliders className="h-4 w-4 text-dash-muted" />
                </div>
                <div>
                  <p className="text-sm font-medium text-dash-text">
                    Catch-up options for mid-year sign-ups
                  </p>
                  <p className="text-xs text-dash-muted">
                    Existing members signing up to monthly partway through
                    the mosque year see whichever options you enable below.
                    The default (Reslice over remaining months) is always
                    available.
                  </p>
                </div>
              </div>

              <div className="space-y-3 border-t border-dash-border pt-3">
                <ToggleRow
                  label="Reslice over remaining months"
                  description="Divide the full annual amount across the remaining months for an even monthly. Always on."
                  checked={fees.enable_strategy_reslice}
                  onToggle={() =>
                    setFees({
                      ...fees,
                      enable_strategy_reslice: !fees.enable_strategy_reslice,
                    })
                  }
                />
                <ToggleRow
                  label="Catch-up lump + monthly"
                  description="Member pays the missed months as a lump sum today, then £X/month for the rest of the year."
                  checked={fees.enable_strategy_catch_up_lump}
                  onToggle={() =>
                    setFees({
                      ...fees,
                      enable_strategy_catch_up_lump:
                        !fees.enable_strategy_catch_up_lump,
                    })
                  }
                />
                <ToggleRow
                  label="Monthly with year-end balloon"
                  description="Member pays £X/month and the missed months as one balloon at the end. Default off — higher dropout risk."
                  checked={fees.enable_strategy_balloon}
                  onToggle={() =>
                    setFees({
                      ...fees,
                      enable_strategy_balloon: !fees.enable_strategy_balloon,
                    })
                  }
                />
              </div>

              <div className="grid grid-cols-1 gap-4 border-t border-dash-border pt-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="catchUpMaxMonths">
                    Cap catch-up lump at
                  </Label>
                  <select
                    id="catchUpMaxMonths"
                    className="flex h-11 w-full rounded-xl border border-dash-border bg-dash-surface px-3 py-2 text-sm"
                    value={fees.catch_up_max_months}
                    onChange={(e) =>
                      setFees({
                        ...fees,
                        catch_up_max_months: Number(e.target.value),
                      })
                    }
                  >
                    {[3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => (
                      <option key={n} value={n}>
                        {n} months
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-dash-muted">
                    Members further into the year are routed to a treasurer
                    conversation instead of self-service.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="yearStartPromptDays">
                    Notify members before year start
                  </Label>
                  <select
                    id="yearStartPromptDays"
                    className="flex h-11 w-full rounded-xl border border-dash-border bg-dash-surface px-3 py-2 text-sm"
                    value={fees.year_start_prompt_days}
                    onChange={(e) =>
                      setFees({
                        ...fees,
                        year_start_prompt_days: Number(e.target.value),
                      })
                    }
                  >
                    {[7, 14, 21, 30, 45, 60, 90].map((n) => (
                      <option key={n} value={n}>
                        {n} days before
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-dash-muted">
                    Driver for the year-start auto-create + reminder job.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="rounded-xl border border-dash-border p-4 space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-dash-surface-subtle">
                <CalendarPlus className="h-4 w-4 text-dash-muted" />
              </div>
              <div>
                <p className="text-sm font-medium text-dash-text">
                  Pay-in-advance for next year
                </p>
                <p className="text-xs text-dash-muted">
                  Paid-up members can prepay next year&apos;s giving from their
                  portal. Optional discount rewards early payment.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 border-t border-dash-border pt-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="advanceDiscount">Advance discount</Label>
                <div className="relative">
                  <Percent className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-dash-muted" />
                  <Input
                    id="advanceDiscount"
                    type="number"
                    step="0.5"
                    min={0}
                    max={50}
                    className="pl-9"
                    value={fees.advance_discount_percent}
                    onChange={(e) =>
                      setFees({
                        ...fees,
                        advance_discount_percent: Math.max(
                          0,
                          Math.min(50, Number(e.target.value))
                        ),
                      })
                    }
                  />
                </div>
                <p className="text-xs text-dash-muted">
                  {fees.advance_discount_percent > 0
                    ? `Members who prepay save ${fees.advance_discount_percent}%`
                    : "0% locks in next year without a discount."}
                </p>
              </div>
              <ToggleRow
                label="Auto-renew default"
                description="When monthly subscriptions reach their final cycle, default to rolling members onto the next year automatically."
                checked={fees.auto_renew_default}
                onToggle={() =>
                  setFees({
                    ...fees,
                    auto_renew_default: !fees.auto_renew_default,
                  })
                }
              />
            </div>
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

function ToggleRow({
  label,
  description,
  checked,
  onToggle,
}: {
  label: string;
  description: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex-1">
        <p className="text-sm font-medium text-dash-text">{label}</p>
        <p className="text-xs text-dash-muted">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={onToggle}
        className={`relative inline-flex h-6 w-11 flex-none items-center rounded-full transition-colors ${
          checked ? "bg-emerald-500" : "bg-slate-200"
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            checked ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>
    </div>
  );
}
