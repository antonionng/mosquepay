"use client";

import { useState, useMemo } from "react";
import {
  FileSpreadsheet,
  Download,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
} from "lucide-react";
import { formatDate } from "@/lib/utils";

type Declaration = {
  id: string;
  donor_name: string;
  donor_email: string;
  donor_address: string;
  declaration_date: string;
  status: "active" | "expired" | "revoked";
  total_donations: number;
  reclaimable_amount: number;
  created_at: string;
};

export function GiftAidClient({
  declarations,
}: {
  declarations: Declaration[];
}) {
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "expired" | "revoked">("all");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    let list = declarations;
    if (statusFilter !== "all") {
      list = list.filter((d) => d.status === statusFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (d) =>
          d.donor_name.toLowerCase().includes(q) ||
          d.donor_email.toLowerCase().includes(q)
      );
    }
    return list;
  }, [declarations, statusFilter, search]);

  const totalDeclarations = declarations.length;
  const activeCount = declarations.filter((d) => d.status === "active").length;
  const expiredCount = declarations.filter((d) => d.status === "expired").length;
  const totalReclaimable = declarations
    .filter((d) => d.status === "active")
    .reduce((s, d) => s + d.reclaimable_amount, 0);

  function exportCSV() {
    const headers = [
      "Donor Name",
      "Email",
      "Address",
      "Declaration Date",
      "Status",
      "Total Donations",
      "Reclaimable Amount",
    ];
    const rows = filtered.map((d) => [
      d.donor_name,
      d.donor_email,
      `"${d.donor_address}"`,
      d.declaration_date,
      d.status,
      d.total_donations.toFixed(2),
      d.reclaimable_amount.toFixed(2),
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `gift-aid-declarations-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const statusIcon = (status: string) => {
    switch (status) {
      case "active":
        return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />;
      case "expired":
        return <Clock className="h-3.5 w-3.5 text-amber-600" />;
      case "revoked":
        return <XCircle className="h-3.5 w-3.5 text-rose-600" />;
      default:
        return null;
    }
  };

  const statusBadge = (status: string) => {
    const styles: Record<string, string> = {
      active: "bg-emerald-50 text-emerald-900",
      expired: "bg-amber-50 text-amber-900",
      revoked: "bg-rose-50 text-rose-900",
    };
    return (
      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${styles[status] ?? ""}`}>
        {statusIcon(status)}
        {status}
      </span>
    );
  };

  return (
    <div>
      <div className="admin-page-head">
        <div>
          <h1 className="admin-page-title">Gift Aid</h1>
          <p className="admin-page-copy">
            Manage Gift Aid declarations and HMRC reporting.
          </p>
        </div>
        <button
          onClick={exportCSV}
          className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-500"
        >
          <Download className="h-4 w-4" />
          Export HMRC Data
        </button>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="dash-kpi-card p-6">
          <div className="flex items-center justify-between">
            <span className="text-sm text-dash-muted">Total Declarations</span>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10">
              <FileSpreadsheet className="h-[18px] w-[18px] text-blue-600" />
            </div>
          </div>
          <p className="mt-4 text-3xl font-semibold tracking-tight text-dash-text">
            {totalDeclarations}
          </p>
        </div>
        <div className="dash-kpi-card p-6">
          <div className="flex items-center justify-between">
            <span className="text-sm text-dash-muted">Active</span>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10">
              <CheckCircle2 className="h-[18px] w-[18px] text-emerald-600" />
            </div>
          </div>
          <p className="mt-4 text-3xl font-semibold tracking-tight text-emerald-700">
            {activeCount}
          </p>
        </div>
        <div className="dash-kpi-card p-6">
          <div className="flex items-center justify-between">
            <span className="text-sm text-dash-muted">Expired</span>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10">
              <Clock className="h-[18px] w-[18px] text-amber-600" />
            </div>
          </div>
          <p className="mt-4 text-3xl font-semibold tracking-tight text-amber-700">
            {expiredCount}
          </p>
        </div>
        <div className="dash-kpi-card p-6">
          <div className="flex items-center justify-between">
            <span className="text-sm text-dash-muted">Reclaimable</span>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10">
              <FileSpreadsheet className="h-[18px] w-[18px] text-purple-600" />
            </div>
          </div>
          <p className="mt-4 text-3xl font-semibold tracking-tight text-purple-700">
            £{totalReclaimable.toFixed(2)}
          </p>
        </div>
      </div>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-dash-muted" />
          <input
            type="text"
            placeholder="Search donors..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-dash-border bg-dash-surface py-2.5 pl-10 pr-4 text-sm text-dash-text placeholder:text-dash-faint focus:border-blue-500/50 focus:outline-none focus:ring-1 focus:ring-blue-500/30"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
          className="rounded-xl border border-dash-border bg-dash-surface px-4 py-2.5 text-sm text-dash-text focus:border-blue-500/50 focus:outline-none focus:ring-1 focus:ring-blue-500/30"
        >
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="expired">Expired</option>
          <option value="revoked">Revoked</option>
        </select>
      </div>

      <div className="admin-table-shell mt-6">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Donor</th>
              <th>Email</th>
              <th>Declaration Date</th>
              <th>Status</th>
              <th className="text-right">Total Donations</th>
              <th className="text-right">Reclaimable</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-dash-muted">
                  No declarations found.
                </td>
              </tr>
            ) : (
              filtered.map((d) => (
                <tr key={d.id}>
                  <td className="font-medium text-dash-text">{d.donor_name}</td>
                  <td className="text-dash-muted">{d.donor_email}</td>
                  <td className="text-dash-text">{formatDate(d.declaration_date)}</td>
                  <td>{statusBadge(d.status)}</td>
                  <td className="text-right text-dash-text">
                    £{d.total_donations.toFixed(2)}
                  </td>
                  <td className="text-right">
                    <span className={d.status === "active" ? "font-medium text-emerald-700" : "text-dash-muted"}>
                      £{d.reclaimable_amount.toFixed(2)}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
