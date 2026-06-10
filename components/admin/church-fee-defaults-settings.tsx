"use client";

import { useEffect, useState } from "react";
import { PoundSterling, Save, CheckCircle2, AlertCircle, UtensilsCrossed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";

type FeesData = {
  default_member_levy_amount: number | null;
  default_member_dining_amount: number | null;
  default_guest_dining_amount: number | null;
  currency: string;
};

function amountInput(value: number | null): string {
  return value == null ? "" : String(value);
}

function parseAmount(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

export function ChurchFeeDefaultsSettings() {
  const [fees, setFees] = useState<FeesData>({
    default_member_levy_amount: 10,
    default_member_dining_amount: null,
    default_guest_dining_amount: 30,
    currency: "gbp",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(
    null
  );

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/settings/church-fees");
        if (res.ok) {
          const data = await res.json();
          if (data.fees) {
            setFees({
              default_member_levy_amount: data.fees.default_member_levy_amount ?? 10,
              default_member_dining_amount: data.fees.default_member_dining_amount ?? null,
              default_guest_dining_amount: data.fees.default_guest_dining_amount ?? 30,
              currency: data.fees.currency ?? "gbp",
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
      const res = await fetch("/api/settings/church-fees", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fees),
      });
      if (res.ok) {
        setMessage({ type: "success", text: "Service and dining fee defaults saved." });
      } else {
        const data = await res.json().catch(() => ({}));
        setMessage({
          type: "error",
          text: data.error ?? "Failed to update fee defaults",
        });
      }
    } catch {
      setMessage({ type: "error", text: "Something went wrong" });
    } finally {
      setSaving(false);
    }
  }

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
              <UtensilsCrossed className="h-4 w-4" />
              Service & dining fee defaults
            </h2>
            <p className="dash-panel-header-description">
              Standard levy and dining amounts for members and guests. Individual profiles and
              services can override these.
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

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <div className="space-y-2">
              <Label htmlFor="memberLevy">Member service levy (£)</Label>
              <div className="relative">
                <PoundSterling className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-dash-muted" />
                <Input
                  id="memberLevy"
                  type="number"
                  step="0.01"
                  min="0"
                  className="pl-9"
                  value={amountInput(fees.default_member_levy_amount)}
                  onChange={(e) =>
                    setFees({
                      ...fees,
                      default_member_levy_amount: parseAmount(e.target.value),
                    })
                  }
                />
              </div>
              <p className="text-xs text-dash-muted">Charged when attending the service.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="memberDining">Member dining (£)</Label>
              <div className="relative">
                <PoundSterling className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-dash-muted" />
                <Input
                  id="memberDining"
                  type="number"
                  step="0.01"
                  min="0"
                  className="pl-9"
                  placeholder="Per service"
                  value={amountInput(fees.default_member_dining_amount)}
                  onChange={(e) =>
                    setFees({
                      ...fees,
                      default_member_dining_amount: parseAmount(e.target.value),
                    })
                  }
                />
              </div>
              <p className="text-xs text-dash-muted">Leave blank to set per service only.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="guestDining">Guest dining (£)</Label>
              <div className="relative">
                <PoundSterling className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-dash-muted" />
                <Input
                  id="guestDining"
                  type="number"
                  step="0.01"
                  min="0"
                  className="pl-9"
                  value={amountInput(fees.default_guest_dining_amount)}
                  onChange={(e) =>
                    setFees({
                      ...fees,
                      default_guest_dining_amount: parseAmount(e.target.value),
                    })
                  }
                />
              </div>
              <p className="text-xs text-dash-muted">Per registered guest at the fellowship meal.</p>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button type="submit" variant="primary" disabled={saving}>
              {saving ? "Saving..." : (
                <span className="flex items-center gap-2">
                  <Save className="h-4 w-4" />
                  Save fee defaults
                </span>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
