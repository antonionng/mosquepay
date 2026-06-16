"use client";

import { useEffect, useState } from "react";
import { Bell, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

type Item = {
  eventType: string;
  label: string;
  description: string;
  enabled: boolean;
};

type Group = { group: string; items: Item[] };

type ApiResponse = {
  member: { id: string; email: string; full_name: string };
  groups: Group[];
  criticalEventTypes: string[];
};

export default function MemberNotificationsPage() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [flash, setFlash] = useState<{ kind: "ok" | "err"; msg: string } | null>(
    null,
  );

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const r = await fetch("/api/member/notifications", { cache: "no-store" });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const json = (await r.json()) as ApiResponse;
        if (active) setData(json);
      } catch (err) {
        if (active) {
          setFlash({
            kind: "err",
            msg: err instanceof Error ? err.message : "Failed to load",
          });
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  async function toggle(eventType: string, nextEnabled: boolean) {
    setSavingKey(eventType);
    setFlash(null);
    try {
      const r = await fetch("/api/member/notifications", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ event_type: eventType, enabled: nextEnabled }),
      });
      const json = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) throw new Error(json.error ?? `HTTP ${r.status}`);
      setData((prev) =>
        prev
          ? {
              ...prev,
              groups: prev.groups.map((g) => ({
                ...g,
                items: g.items.map((i) =>
                  i.eventType === eventType ? { ...i, enabled: nextEnabled } : i,
                ),
              })),
            }
          : prev,
      );
      setFlash({ kind: "ok", msg: "Saved" });
    } catch (err) {
      setFlash({
        kind: "err",
        msg: err instanceof Error ? err.message : "Save failed",
      });
    } finally {
      setSavingKey(null);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
      <div className="mb-8 flex items-start gap-4">
        <div className="rounded-2xl bg-blue-50 p-3 text-blue-700">
          <Bell className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Email notifications
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Choose which optional emails you want from us. Critical alerts
            (failed payments, cancellations, account access) are always on so
            we can keep your subscription healthy.
          </p>
        </div>
      </div>

      {flash ? (
        <div
          className={`mb-6 flex items-center gap-2 rounded-lg border px-4 py-3 text-sm ${
            flash.kind === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {flash.kind === "ok" ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <AlertCircle className="h-4 w-4" />
          )}
          <span>{flash.msg}</span>
        </div>
      ) : null}

      {loading ? (
        <div className="flex h-40 items-center justify-center text-slate-400">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Loading preferences
        </div>
      ) : data ? (
        <div className="space-y-6">
          {data.groups.map((g) => (
            <section
              key={g.group}
              className="rounded-2xl border border-slate-200 bg-white shadow-sm"
            >
              <div className="border-b border-slate-200 px-6 py-4">
                <h2 className="text-base font-semibold text-slate-900">
                  {g.group}
                </h2>
              </div>
              <ul className="divide-y divide-slate-100">
                {g.items.map((i) => {
                  const busy = savingKey === i.eventType;
                  return (
                    <li
                      key={i.eventType}
                      className="flex items-start justify-between gap-4 px-6 py-4"
                    >
                      <div className="flex-1">
                        <div className="text-sm font-medium text-slate-900">
                          {i.label}
                        </div>
                        <p className="mt-1 text-xs leading-relaxed text-slate-500">
                          {i.description}
                        </p>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={i.enabled}
                        disabled={busy}
                        onClick={() => toggle(i.eventType, !i.enabled)}
                        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition ${
                          i.enabled ? "bg-blue-600" : "bg-slate-200"
                        } ${busy ? "opacity-60" : ""}`}
                      >
                        <span
                          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
                            i.enabled ? "translate-x-5" : "translate-x-0.5"
                          }`}
                        />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}

          <section className="rounded-2xl border border-slate-200 bg-slate-50 px-6 py-5 text-sm text-slate-600">
            <p className="font-medium text-slate-700">
              Always-on alerts (cannot be muted)
            </p>
            <ul className="mt-3 list-disc space-y-1 pl-5">
              <li>Failed subscription payments</li>
              <li>Subscription cancellations</li>
              <li>Account invites and password resets</li>
              <li>Mosque notice</li>
            </ul>
          </section>
        </div>
      ) : null}
    </div>
  );
}
