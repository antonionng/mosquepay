"use client";

import { useEffect, useState } from "react";
import { Loader2, ToggleLeft, ToggleRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const FLAGS = [
  { key: "ai", label: "AI assistant" },
  { key: "integrations", label: "Integrations" },
  { key: "charity", label: "Charity & Gift Aid" },
  { key: "pastoral_care", label: "PastoralCare pastoral" },
  { key: "mentor", label: "Discipleship mentoring" },
  { key: "site_builder", label: "Public site builder" },
] as const;

type Mosque = { id: string; name: string };

export function FeatureFlagsClient({ mosques }: { mosques: Mosque[] }) {
  const [open, setOpen] = useState(false);
  const [mosqueId, setMosqueId] = useState<string>(mosques[0]?.id ?? "");
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !mosqueId) return;
    let active = true;
    setLoading(true);
    fetch(`/api/admin/platform/feature-flags?mosque_id=${mosqueId}`)
      .then((res) => res.json())
      .then((data) => {
        if (active) setFlags(data.flags ?? {});
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [open, mosqueId]);

  async function toggle(flagKey: string) {
    if (!mosqueId) return;
    setBusyKey(flagKey);
    try {
      const res = await fetch("/api/admin/platform/feature-flags", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mosque_id: mosqueId,
          flag_key: flagKey,
          enabled: !flags[flagKey],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not update.");
      setFlags((prev) => ({ ...prev, [flagKey]: !prev[flagKey] }));
      setFeedback(`Updated ${flagKey}.`);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Failed.");
    } finally {
      setBusyKey(null);
    }
  }

  if (!open) {
    return (
      <Button variant="outline" onClick={() => setOpen(true)}>
        <ToggleRight className="mr-2 h-4 w-4" /> Manage feature flags
      </Button>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Feature flags</h2>
          <p className="text-xs text-slate-500">
            Gate any module on or off per mosque. Disabling hides the navigation
            entry and short-circuits APIs that opt-in to checking.
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Close
        </Button>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <label htmlFor="ff-mosque" className="text-xs text-slate-500">
          Mosque
        </label>
        <select
          id="ff-mosque"
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
          value={mosqueId}
          onChange={(e) => setMosqueId(e.target.value)}
        >
          {mosques.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      </div>

      {feedback && (
        <p className="mt-2 text-xs text-blue-700">{feedback}</p>
      )}

      <div className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-200">
        {loading ? (
          <div className="flex items-center justify-center p-6">
            <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
          </div>
        ) : (
          FLAGS.map((flag) => {
            const enabled = flags[flag.key] ?? true;
            return (
              <div
                key={flag.key}
                className="flex items-center justify-between gap-3 p-3"
              >
                <div className="flex items-center gap-2">
                  {enabled ? (
                    <ToggleRight className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <ToggleLeft className="h-4 w-4 text-slate-400" />
                  )}
                  <span className="text-sm font-medium text-slate-900">
                    {flag.label}
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busyKey === flag.key}
                  onClick={() => toggle(flag.key)}
                >
                  {busyKey === flag.key ? (
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  ) : null}
                  {enabled ? "Disable" : "Enable"}
                </Button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
