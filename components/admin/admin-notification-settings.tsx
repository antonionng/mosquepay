"use client";

import { useEffect, useState } from "react";
import { Bell, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

type Role = { role: string; label: string; enabled: boolean };
type EventRow = {
  eventType: string;
  label: string;
  description: string;
  roles: Role[];
};

export function AdminNotificationSettings() {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [flash, setFlash] = useState<{ kind: "ok" | "err"; msg: string } | null>(
    null,
  );

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const r = await fetch("/api/admin/notifications", {
          cache: "no-store",
        });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const json = (await r.json()) as { events: EventRow[] };
        if (active) setEvents(json.events);
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

  async function toggle(eventType: string, role: string, nextEnabled: boolean) {
    const key = `${eventType}::${role}`;
    setSavingKey(key);
    setFlash(null);
    try {
      const r = await fetch("/api/admin/notifications", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          event_type: eventType,
          role,
          enabled: nextEnabled,
        }),
      });
      const json = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) throw new Error(json.error ?? `HTTP ${r.status}`);
      setEvents((prev) =>
        prev.map((evt) =>
          evt.eventType === eventType
            ? {
                ...evt,
                roles: evt.roles.map((rr) =>
                  rr.role === role ? { ...rr, enabled: nextEnabled } : rr,
                ),
              }
            : evt,
        ),
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

  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center text-slate-400">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
        <Bell className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
        <p>
          Choose which lodge officers receive subscription and dues
          notifications. Defaults are sensible — turn things off here if a
          notification stream is too chatty for a particular role.
        </p>
      </div>

      {flash ? (
        <div
          className={`flex items-center gap-2 rounded-lg border px-4 py-3 text-sm ${
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

      <div className="space-y-4">
        {events.map((evt) => (
          <div
            key={evt.eventType}
            className="rounded-2xl border border-slate-200 bg-white shadow-sm"
          >
            <div className="border-b border-slate-200 px-6 py-4">
              <h3 className="text-base font-semibold text-slate-900">
                {evt.label}
              </h3>
              <p className="mt-1 text-xs text-slate-500">{evt.description}</p>
            </div>
            <ul className="divide-y divide-slate-100">
              {evt.roles.map((r) => {
                const busy = savingKey === `${evt.eventType}::${r.role}`;
                return (
                  <li
                    key={r.role}
                    className="flex items-center justify-between px-6 py-3"
                  >
                    <span className="text-sm text-slate-700">{r.label}</span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={r.enabled}
                      disabled={busy}
                      onClick={() => toggle(evt.eventType, r.role, !r.enabled)}
                      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition ${
                        r.enabled ? "bg-blue-600" : "bg-slate-200"
                      } ${busy ? "opacity-60" : ""}`}
                    >
                      <span
                        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
                          r.enabled ? "translate-x-5" : "translate-x-0.5"
                        }`}
                      />
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
