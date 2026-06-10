"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, RefreshCcw, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ReadinessCheck = {
  id: string;
  label: string;
  ready: boolean;
  detail: string;
};

type ReadinessPayload = {
  supabaseConfigured: boolean;
  databaseMode: boolean;
  selectedChurch: boolean;
  checks: ReadinessCheck[];
};

export function WebsiteReadinessPanel() {
  const [payload, setPayload] = useState<ReadinessPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/website-readiness");
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not load readiness.");
      setPayload(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load readiness.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const readyCount = payload?.checks.filter((check) => check.ready).length ?? 0;
  const total = payload?.checks.length ?? 0;

  return (
    <div className="admin-surface p-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-dash-text">Production readiness</h2>
          <p className="mt-1 text-sm text-dash-muted">
            Verify the database, storage bucket, logo, header, pages, forms, and publish state.
          </p>
        </div>
        <Button type="button" variant="dashboard" onClick={load} disabled={loading}>
          {loading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCcw className="mr-2 h-4 w-4" />
          )}
          Refresh
        </Button>
      </div>

      {error ? (
        <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      {loading && !payload ? (
        <div className="mt-5 flex items-center gap-2 rounded-xl border border-dash-border bg-dash-surface-subtle p-4 text-sm text-dash-muted">
          <Loader2 className="h-4 w-4 animate-spin" />
          Checking website readiness...
        </div>
      ) : null}

      {payload ? (
        <>
          <div className="mt-5 rounded-2xl border border-dash-border bg-dash-surface-subtle p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-dash-text">
                  {readyCount} of {total} checks ready
                </p>
                <p className="mt-1 text-xs text-dash-muted">
                  Some checks are optional, but failed DB or storage checks should be fixed before launch.
                </p>
              </div>
              <div
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-semibold",
                  readyCount === total
                    ? "bg-emerald-50 text-emerald-800"
                    : "bg-amber-50 text-amber-800"
                )}
              >
                {readyCount === total ? "Launch ready" : "Needs review"}
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {payload.checks.map((check) => (
              <div
                key={check.id}
                className={cn(
                  "rounded-2xl border p-4",
                  check.ready
                    ? "border-emerald-200 bg-emerald-50/70"
                    : "border-amber-200 bg-amber-50/70"
                )}
              >
                <div className="flex items-start gap-3">
                  {check.ready ? (
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
                  ) : (
                    <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
                  )}
                  <div>
                    <p className="text-sm font-semibold text-dash-text">{check.label}</p>
                    <p className="mt-1 text-xs leading-5 text-dash-muted">{check.detail}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
