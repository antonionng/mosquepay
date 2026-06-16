"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Loader2, Plus, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const HEADERS = [
  "name",
  "mosque_number",
  "city",
  "service_schedule",
  "secretary_name",
  "support_email",
] as const;

type Row = Record<(typeof HEADERS)[number], string>;

function emptyRow(): Row {
  return {
    name: "",
    mosque_number: "",
    city: "",
    service_schedule: "",
    secretary_name: "",
    support_email: "",
  };
}

function parseCsv(text: string): Row[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const rows: Row[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(",").map((c) => c.trim());
    const row: Row = emptyRow();
    headers.forEach((header, idx) => {
      if ((HEADERS as readonly string[]).includes(header)) {
        row[header as (typeof HEADERS)[number]] = cells[idx] ?? "";
      }
    });
    if (row.name) rows.push(row);
  }
  return rows;
}

export function BulkMosquesClient({
  networkId,
  networkName,
}: {
  networkId: string;
  networkName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Row[]>([emptyRow(), emptyRow(), emptyRow()]);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [results, setResults] = useState<{
    created: Array<{ slug: string; name: string }>;
    errors: Array<{ row: number; reason: string }>;
  } | null>(null);

  const validRows = useMemo(() => rows.filter((r) => r.name.trim().length > 0), [rows]);

  function update(idx: number, key: keyof Row, value: string) {
    setRows((prev) =>
      prev.map((row, i) => (i === idx ? { ...row, [key]: value } : row))
    );
  }

  function addRow() {
    setRows((prev) => [...prev, emptyRow()]);
  }

  function removeRow(idx: number) {
    setRows((prev) => prev.filter((_, i) => i !== idx));
  }

  function downloadTemplate() {
    const csv = `${HEADERS.join(",")}\n`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${networkName.toLowerCase().replace(/\s+/g, "-")}-mosques-template.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function onFile(file: File | null) {
    if (!file) return;
    const text = await file.text();
    const parsed = parseCsv(text);
    if (parsed.length === 0) {
      setFeedback("CSV has no usable rows.");
      return;
    }
    setRows(parsed);
    setFeedback(`Loaded ${parsed.length} mosques from ${file.name}.`);
  }

  async function submit() {
    if (validRows.length === 0) {
      setFeedback("Add at least one mosque with a name.");
      return;
    }
    setBusy(true);
    setResults(null);
    try {
      const res = await fetch(`/api/networks/${networkId}/mosques/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mosques: validRows }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Bulk create failed.");
      setResults({
        created: data.created ?? [],
        errors: data.errors ?? [],
      });
      setFeedback(
        `Created ${data.created?.length ?? 0} mosques. ${data.errors?.length ?? 0} errors.`
      );
      router.refresh();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Bulk create failed.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Plus className="mr-2 h-4 w-4" /> Bulk add mosques
      </Button>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            Bulk add mosques to {networkName}
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Paste in rows by hand or upload a CSV. Slugs and IDs are generated
            automatically; conflicts append a numeric suffix.
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Close
        </Button>
      </div>

      <div className="space-y-3 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={downloadTemplate}>
            <Download className="mr-1 h-3 w-3" /> CSV template
          </Button>
          <Label
            htmlFor="bulk-csv"
            className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
          >
            <Upload className="h-3 w-3" /> Upload CSV
          </Label>
          <input
            id="bulk-csv"
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => onFile(e.target.files?.[0] ?? null)}
          />
          <span className="text-xs text-slate-500">
            {validRows.length} usable rows
          </span>
        </div>

        {feedback && (
          <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-900">
            {feedback}
          </div>
        )}

        <div className="max-h-72 overflow-x-auto overflow-y-auto rounded-lg border border-slate-200">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-slate-50 text-left">
              <tr>
                {HEADERS.map((h) => (
                  <th key={h} className="px-2 py-2 font-medium text-slate-600">
                    {h.replace(/_/g, " ")}
                  </th>
                ))}
                <th className="px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr key={idx} className="border-t border-slate-100">
                  {HEADERS.map((h) => (
                    <td key={h} className="px-1 py-1">
                      <Input
                        className="h-7 text-xs"
                        value={row[h]}
                        onChange={(e) => update(idx, h, e.target.value)}
                      />
                    </td>
                  ))}
                  <td className="px-1 py-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => removeRow(idx)}
                      disabled={rows.length <= 1}
                    >
                      Remove
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex justify-between">
          <Button variant="outline" size="sm" onClick={addRow}>
            <Plus className="mr-1 h-3 w-3" /> Add row
          </Button>
          <Button onClick={submit} disabled={busy}>
            {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
            Create {validRows.length} mosques
          </Button>
        </div>

        {results && (
          <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs">
            <p className="font-semibold text-slate-700">
              Created {results.created.length} mosques
            </p>
            {results.created.length > 0 && (
              <ul className="list-disc pl-5 text-slate-600">
                {results.created.map((c) => (
                  <li key={c.slug}>
                    {c.name}{" "}
                    <code className="rounded bg-white px-1 text-[10px]">
                      {c.slug}
                    </code>
                  </li>
                ))}
              </ul>
            )}
            {results.errors.length > 0 && (
              <>
                <p className="mt-2 font-semibold text-rose-700">Errors</p>
                <ul className="list-disc pl-5 text-rose-700">
                  {results.errors.map((e, i) => (
                    <li key={i}>
                      Row {e.row}: {e.reason}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
