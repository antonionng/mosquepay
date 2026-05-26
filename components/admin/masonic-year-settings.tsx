"use client";

import { useEffect, useState } from "react";
import { Calendar, Save, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { defaultMasonicYearBounds } from "@/lib/dues/pro-rata";

type MasonicYear = {
  id?: string;
  label: string;
  start_date: string;
  end_date: string;
  annual_dues_amount: number | null;
  is_current: boolean;
};

export function MasonicYearSettings() {
  const fallback = defaultMasonicYearBounds();
  const [year, setYear] = useState<MasonicYear>({
    label: fallback.label,
    start_date: fallback.startDate,
    end_date: fallback.endDate,
    annual_dues_amount: 200,
    is_current: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(
    null
  );

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/settings/masonic-year");
        if (res.ok) {
          const data = await res.json();
          if (data.current) {
            setYear({
              id: data.current.id,
              label: data.current.label,
              start_date: data.current.start_date?.slice(0, 10) ?? fallback.startDate,
              end_date: data.current.end_date?.slice(0, 10) ?? fallback.endDate,
              annual_dues_amount:
                data.current.annual_dues_amount ?? data.suggested_annual_amount ?? 200,
              is_current: true,
            });
          } else if (data.suggested_annual_amount != null) {
            setYear((y) => ({
              ...y,
              annual_dues_amount: data.suggested_annual_amount,
            }));
          }
        }
      } catch {
        /* empty */
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [fallback.endDate, fallback.startDate, fallback.label]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/settings/masonic-year", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...year, is_current: true }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.year?.id) {
          setYear((y) => ({ ...y, id: data.year.id }));
        }
        setMessage({ type: "success", text: "Masonic year saved." });
      } else {
        const data = await res.json().catch(() => ({}));
        setMessage({ type: "error", text: data.error ?? "Failed to save masonic year" });
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
        <div className="h-5 w-48 rounded bg-dash-surface-subtle" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSave}>
      <Card variant="panel" className="overflow-hidden p-0">
        <div className="dash-panel-header rounded-none border-dash-border bg-dash-surface-subtle">
          <div>
            <h2 className="dash-panel-header-title flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Masonic year
            </h2>
            <p className="dash-panel-header-description">
              Define the lodge year for annual dues and pro rata calculations when members join
              mid-year.
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
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="yearLabel">Year label</Label>
              <Input
                id="yearLabel"
                value={year.label}
                onChange={(e) => setYear({ ...year, label: e.target.value })}
                placeholder="e.g. 2025/26"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="yearStart">Start date</Label>
              <Input
                id="yearStart"
                type="date"
                value={year.start_date}
                onChange={(e) => setYear({ ...year, start_date: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="yearEnd">End date</Label>
              <Input
                id="yearEnd"
                type="date"
                value={year.end_date}
                onChange={(e) => setYear({ ...year, end_date: e.target.value })}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="annualDues">Full-year annual dues (£)</Label>
              <Input
                id="annualDues"
                type="number"
                step="0.01"
                min="0"
                value={year.annual_dues_amount ?? ""}
                onChange={(e) =>
                  setYear({
                    ...year,
                    annual_dues_amount: e.target.value ? Number(e.target.value) : null,
                  })
                }
              />
              <p className="text-xs text-dash-muted">
                Used for pro rata when a candidate is initiated mid-year.
              </p>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button type="submit" variant="primary" disabled={saving}>
              {saving ? "Saving..." : (
                <span className="flex items-center gap-2">
                  <Save className="h-4 w-4" />
                  Save masonic year
                </span>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
