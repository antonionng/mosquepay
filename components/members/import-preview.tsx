"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertTriangle, CheckCircle2, X } from "lucide-react";
import { buildImportPayload, type ParsedMemberRow } from "@/lib/members/csv";

export function MemberImportPreview({
  rows,
  onClose,
  onComplete,
}: {
  rows: ParsedMemberRow[];
  onClose: () => void;
  onComplete: () => void;
}) {
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [results, setResults] = useState<{
    created: number;
    skipped: number;
    failed: number;
    errors: string[];
  } | null>(null);

  const importable = rows.filter((r) => r.errors.length === 0);
  const skippable = rows.filter(
    (r) => r.errors.length > 0 || (skipDuplicates && r.isExisting)
  );
  const willImport = rows.filter(
    (r) => r.errors.length === 0 && (!skipDuplicates || !r.isExisting)
  );

  async function runImport() {
    setImporting(true);
    setProgress(0);
    const errors: string[] = [];
    let created = 0;
    let skipped = skippable.length;
    let failed = 0;

    for (let i = 0; i < willImport.length; i++) {
      const row = willImport[i];
      try {
        const res = await fetch("/api/members", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildImportPayload(row)),
        });
        if (res.ok) {
          created++;
        } else if (res.status === 409) {
          skipped++;
        } else {
          failed++;
          const body = await res.json().catch(() => ({}));
          errors.push(
            `Row ${row.rowIndex + 1} (${row.email}): ${body.error ?? res.statusText}`
          );
        }
      } catch (e) {
        failed++;
        errors.push(
          `Row ${row.rowIndex + 1} (${row.email}): ${e instanceof Error ? e.message : "Network error"}`
        );
      }
      setProgress(i + 1);
    }
    setResults({ created, skipped, failed, errors });
    setImporting(false);
    if (failed === 0) {
      setTimeout(onComplete, 1200);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-dash-text/30 backdrop-blur-[2px]"
        onClick={importing ? undefined : onClose}
      />
      <div className="relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-dash-border bg-dash-surface shadow-2xl">
        <div className="flex items-center justify-between border-b border-dash-border px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-dash-text">
              Review CSV import
            </h2>
            <p className="text-xs text-dash-muted">
              {rows.length} rows parsed. Confirm what to add to the register.
            </p>
          </div>
          <button
            onClick={importing ? undefined : onClose}
            className="rounded-lg p-1.5 text-dash-muted hover:bg-dash-surface-subtle disabled:opacity-50"
            disabled={importing}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="border-b border-dash-border bg-dash-surface-subtle/40 px-6 py-3">
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-900">
              {willImport.length} to import
            </Badge>
            <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-900">
              {rows.filter((r) => r.isExisting).length} already exist
            </Badge>
            <Badge variant="outline" className="border-red-200 bg-red-50 text-red-900">
              {rows.filter((r) => r.errors.length > 0).length} with issues
            </Badge>
            <label className="ml-auto flex items-center gap-2 text-xs text-dash-text">
              <input
                type="checkbox"
                checked={skipDuplicates}
                onChange={(e) => setSkipDuplicates(e.target.checked)}
                className="h-4 w-4"
                disabled={importing}
              />
              Skip rows whose email already exists
            </label>
          </div>
        </div>

        {results ? (
          <div className="flex-1 space-y-3 overflow-y-auto p-6">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
              <p className="flex items-center gap-2 text-sm font-medium text-emerald-900">
                <CheckCircle2 className="h-4 w-4" />
                Import complete
              </p>
              <p className="mt-1 text-xs text-emerald-800">
                Created {results.created} · Skipped {results.skipped} · Failed{" "}
                {results.failed}
              </p>
            </div>
            {results.errors.length > 0 && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                <p className="text-sm font-medium text-red-900">Errors</p>
                <ul className="mt-2 space-y-1 text-xs text-red-800">
                  {results.errors.map((e, i) => (
                    <li key={i}>• {e}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-dash-surface text-left text-[10px] uppercase tracking-wider text-dash-muted">
                <tr className="border-b border-dash-border">
                  <th className="px-4 py-2">#</th>
                  <th className="px-4 py-2">Name</th>
                  <th className="px-4 py-2">Email</th>
                  <th className="px-4 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dash-border">
                {rows.map((r) => (
                  <tr
                    key={r.rowIndex}
                    className={
                      r.errors.length > 0
                        ? "bg-red-50/30"
                        : r.isExisting
                          ? "bg-amber-50/30"
                          : ""
                    }
                  >
                    <td className="px-4 py-2 text-dash-muted">
                      {r.rowIndex + 1}
                    </td>
                    <td className="px-4 py-2 text-dash-text">
                      {r.full_name || (
                        <span className="italic text-dash-faint">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-dash-text">{r.email || "—"}</td>
                    <td className="px-4 py-2">
                      {r.errors.length > 0 ? (
                        <span className="inline-flex items-center gap-1 text-red-700">
                          <AlertTriangle className="h-3 w-3" />
                          {r.errors.join("; ")}
                        </span>
                      ) : r.isExisting ? (
                        <span className="text-amber-700">Already in register</span>
                      ) : (
                        <span className="text-emerald-700">New</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex items-center justify-between border-t border-dash-border bg-dash-surface px-6 py-4">
          <p className="text-xs text-dash-muted">
            {importing
              ? `Importing ${progress} of ${willImport.length}...`
              : results
                ? "Done"
                : `${importable.length} valid · ${rows.length - importable.length} flagged`}
          </p>
          <div className="flex gap-2">
            {!results && (
              <>
                <Button
                  variant="ghost"
                  onClick={onClose}
                  disabled={importing}
                  className="text-dash-muted"
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onClick={runImport}
                  disabled={importing || willImport.length === 0}
                >
                  {importing ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Importing...
                    </span>
                  ) : (
                    `Import ${willImport.length} member${willImport.length === 1 ? "" : "s"}`
                  )}
                </Button>
              </>
            )}
            {results && (
              <Button variant="primary" onClick={onComplete}>
                Done
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
