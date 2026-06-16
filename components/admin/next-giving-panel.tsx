"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CalendarClock, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type NextGivingRow = {
  member_id: string;
  full_name: string;
  email: string;
  status:
    | "owed_current_year"
    | "billed_current_year"
    | "no_giving_year"
    | "no_giving_template"
    | "waived_at_profile";
  nextDueDate: string | null;
  nextYearLabel: string | null;
  expectedAmount: number | null;
  currentYearOutstanding: boolean;
  waiverReason?: string | null;
};

type Response = {
  year: {
    label: string;
    start_date: string;
    end_date: string;
    annual_giving_amount: number | null;
  } | null;
  default_amount: number | null;
  members: NextGivingRow[];
};

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function statusLabel(row: NextGivingRow) {
  if (row.status === "waived_at_profile") return "Annual giving waived";
  if (row.status === "no_giving_year") return "Year not configured";
  if (row.status === "owed_current_year") return "Owed this year";
  if (row.currentYearOutstanding) return "Current year outstanding";
  return "Billed for current year";
}

function statusVariant(row: NextGivingRow) {
  if (row.status === "waived_at_profile") return "text-slate-500";
  if (row.status === "no_giving_year") return "text-slate-500";
  if (row.status === "owed_current_year") return "text-amber-700";
  if (row.currentYearOutstanding) return "text-amber-700";
  return "text-emerald-700";
}

export function NextGivingPanel() {
  const [data, setData] = useState<Response | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "owed" | "billed" | "outstanding" | "waived"
  >("all");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/giving/next-due");
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? "Could not load next giving.");
        if (!cancelled) setData(body);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not load next giving.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    return data.members.filter((row) => {
      if (q && !row.full_name.toLowerCase().includes(q) && !row.email.toLowerCase().includes(q)) {
        return false;
      }
      if (statusFilter === "owed" && row.status !== "owed_current_year") return false;
      if (statusFilter === "billed" && row.status !== "billed_current_year") return false;
      if (statusFilter === "outstanding" && !row.currentYearOutstanding) return false;
      if (statusFilter === "waived" && row.status !== "waived_at_profile") return false;
      return true;
    });
  }, [data, search, statusFilter]);

  const counts = useMemo(() => {
    if (!data) {
      return { owed: 0, billed: 0, outstanding: 0, waived: 0, total: 0 };
    }
    let owed = 0;
    let billed = 0;
    let outstanding = 0;
    let waived = 0;
    for (const row of data.members) {
      if (row.status === "owed_current_year") owed++;
      if (row.status === "billed_current_year") billed++;
      if (row.currentYearOutstanding) outstanding++;
      if (row.status === "waived_at_profile") waived++;
    }
    return { owed, billed, outstanding, waived, total: data.members.length };
  }, [data]);

  return (
    <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-base font-semibold text-slate-900">
            <CalendarClock className="h-4 w-4" />
            Next giving by member
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            When each active member&apos;s next annual giving bill falls due, aligned to the mosque&apos;s
            giving year.
          </p>
        </div>
        {data?.year ? (
          <div className="text-right text-xs text-slate-500">
            <p className="font-medium uppercase tracking-wider">Current year</p>
            <p className="text-slate-700">
              {data.year.label} · {formatDate(data.year.start_date)} →{" "}
              {formatDate(data.year.end_date)}
            </p>
            {data.year.annual_giving_amount != null && (
              <p>Annual £{data.year.annual_giving_amount.toFixed(2)}</p>
            )}
          </div>
        ) : (
          <Link
            href="/admin/treasurer?tab=giving-year"
            className="text-xs text-amber-700 underline"
          >
            No giving year set — configure to drive next-due dates
          </Link>
        )}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[200px] space-y-1">
          <Label htmlFor="next-giving-search">Search</Label>
          <Input
            id="next-giving-search"
            placeholder="Name or email"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="next-giving-filter">Filter</Label>
          <select
            id="next-giving-filter"
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as typeof statusFilter)
            }
            className="flex h-11 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
          >
            <option value="all">All ({counts.total})</option>
            <option value="owed">Owed this year ({counts.owed})</option>
            <option value="billed">Billed ({counts.billed})</option>
            <option value="outstanding">
              Outstanding ({counts.outstanding})
            </option>
            <option value="waived">Waived ({counts.waived})</option>
          </select>
        </div>
      </div>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {loading ? (
        <div className="flex items-center gap-2 py-8 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading…
        </div>
      ) : filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-500">
          No members match your filter.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-3 py-2 font-medium">Member</th>
                <th className="px-3 py-2 font-medium">Next due</th>
                <th className="px-3 py-2 font-medium">For year</th>
                <th className="px-3 py-2 font-medium text-right">Amount</th>
                <th className="px-3 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((row) => (
                <tr
                  key={row.member_id}
                  className={
                    row.status === "waived_at_profile"
                      ? "bg-slate-50/40 hover:bg-slate-50"
                      : "hover:bg-slate-50"
                  }
                >
                  <td className="px-3 py-2">
                    <Link
                      href={`/admin/members/${row.member_id}`}
                      className="font-medium text-slate-900 hover:text-blue-700"
                    >
                      {row.full_name}
                    </Link>
                    <div className="text-xs text-slate-500">{row.email}</div>
                  </td>
                  <td className="px-3 py-2 tabular-nums">
                    {row.status === "waived_at_profile"
                      ? "—"
                      : formatDate(row.nextDueDate)}
                  </td>
                  <td className="px-3 py-2 text-slate-600">
                    {row.status === "waived_at_profile"
                      ? "—"
                      : row.nextYearLabel ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {row.status === "waived_at_profile"
                      ? "—"
                      : row.expectedAmount != null
                        ? `£${row.expectedAmount.toFixed(2)}`
                        : "—"}
                  </td>
                  <td className={`px-3 py-2 text-xs ${statusVariant(row)}`}>
                    <span title={row.waiverReason ?? undefined}>
                      {statusLabel(row)}
                    </span>
                    {row.status === "waived_at_profile" && row.waiverReason && (
                      <div className="mt-0.5 max-w-[18rem] truncate text-[11px] italic text-slate-400">
                        {row.waiverReason}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
