"use client";

import { useEffect, useState } from "react";
import { Loader2, ToggleLeft, ToggleRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const FLAGS = [
  { key: "ai", label: "AI assistant" },
  { key: "integrations", label: "Integrations" },
  { key: "charity", label: "Charity & Gift Aid" },
  { key: "almoner", label: "Almoner welfare" },
  { key: "mentor", label: "Mentor & progression" },
  { key: "site_builder", label: "Public site builder" },
] as const;

type Lodge = { id: string; name: string };

export function FeatureFlagsClient({ lodges }: { lodges: Lodge[] }) {
  const [open, setOpen] = useState(false);
  const [lodgeId, setLodgeId] = useState<string>(lodges[0]?.id ?? "");
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !lodgeId) return;
    let active = true;
    setLoading(true);
    fetch(`/api/admin/platform/feature-flags?lodge_id=${lodgeId}`)
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
  }, [open, lodgeId]);

  async function toggle(flagKey: string) {
    if (!lodgeId) return;
    setBusyKey(flagKey);
    try {
      const res = await fetch("/api/admin/platform/feature-flags", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lodge_id: lodgeId,
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
            Gate any module on or off per lodge. Disabling hides the navigation
            entry and short-circuits APIs that opt-in to checking.
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Close
        </Button>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <label htmlFor="ff-lodge" className="text-xs text-slate-500">
          Lodge
        </label>
        <select
          id="ff-lodge"
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
          value={lodgeId}
          onChange={(e) => setLodgeId(e.target.value)}
        >
          {lodges.map((l) => (
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
