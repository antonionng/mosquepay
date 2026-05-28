"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FileSpreadsheet,
  Download,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  Send,
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

type EligibleRow = {
  id: string;
  donor_name: string;
  donor_email: string;
  donor_address_line_1: string;
  donor_postcode: string;
  declaration_date: string;
  donation_date: string;
  source: string;
  amount: number;
  eligible_amount: number;
  reclaimable_amount: number;
};

type ClaimBatch = {
  id: string;
  claim_reference: string | null;
  period_start: string;
  period_end: string;
  status: "draft" | "exported" | "filed" | "paid";
  donation_count: number;
  declarations_count?: number;
  pack_generated_at?: string | null;
  eligible_amount: number;
  reclaimable_amount: number;
  exported_at: string | null;
  filed_at: string | null;
  paid_at: string | null;
};

export function GiftAidClient({
  declarations,
  eligibleRows,
  claims,
}: {
  declarations: Declaration[];
  eligibleRows: EligibleRow[];
  claims: ClaimBatch[];
}) {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "expired" | "revoked">("all");
  const [search, setSearch] = useState("");
  const [periodStart, setPeriodStart] = useState(() => `${new Date().getFullYear()}-01-01`);
  const [periodEnd, setPeriodEnd] = useState(() => new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

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
  const eligibleAmount = eligibleRows.reduce((sum, row) => sum + row.eligible_amount, 0);
  const eligibleReclaimable = eligibleAmount * 0.25;

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

  function exportClaimPack() {
    const headers = [
      "Title",
      "First name",
      "Last name",
      "House name or number",
      "Postcode",
      "Donation date",
      "Source",
      "Donation amount",
      "Eligible amount",
      "Reclaimable amount",
      "Declaration date",
      "Donor email",
    ];
    const rows = eligibleRows.map((row) => {
      const parts = row.donor_name.trim().split(/\s+/);
      const first = parts[0] ?? "";
      const last = parts.slice(1).join(" ");
      return [
        "",
        first,
        last,
        row.donor_address_line_1,
        row.donor_postcode,
        row.donation_date.slice(0, 10),
        row.source,
        row.amount.toFixed(2),
        row.eligible_amount.toFixed(2),
        row.reclaimable_amount.toFixed(2),
        row.declaration_date.slice(0, 10),
        row.donor_email,
      ];
    });
    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `gift-aid-claim-pack-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function createClaimBatch() {
    setBusy(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/gift-aid/claims", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period_start: periodStart, period_end: periodEnd }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Could not create claim batch.");
      setFeedback("Claim batch created.");
      router.refresh();
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : "Could not create claim batch.");
    } finally {
      setBusy(false);
    }
  }

  async function updateClaimStatus(claimId: string, status: "exported" | "filed" | "paid") {
    setBusy(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/gift-aid/claims/${claimId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Could not update claim.");
      setFeedback(`Claim marked ${status}.`);
      router.refresh();
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : "Could not update claim.");
    } finally {
      setBusy(false);
    }
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

      {feedback ? (
        <div className="mt-6 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          {feedback}
        </div>
      ) : null}

      <div className="mt-5 grid grid-cols-2 gap-3 sm:mt-8 sm:gap-4 xl:grid-cols-4">
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

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[1.25rem] border border-dash-border bg-dash-surface p-6 shadow-sm">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-dash-muted">
                HMRC claim pack
              </p>
              <h2 className="mt-2 text-xl font-semibold text-dash-text">
                {eligibleRows.length} unclaimed eligible donations
              </h2>
              <p className="mt-2 text-sm text-dash-muted">
                £{eligibleAmount.toFixed(2)} eligible, £{eligibleReclaimable.toFixed(2)} reclaimable.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={exportClaimPack}
                disabled={eligibleRows.length === 0}
                className="flex items-center gap-2 rounded-xl border border-dash-border bg-dash-surface px-4 py-2.5 text-sm font-medium text-dash-text disabled:opacity-50"
              >
                <Download className="h-4 w-4" />
                Export claim pack
              </button>
            </div>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
            <label className="block text-xs font-medium text-dash-text-muted">
              Period start
              <input
                type="date"
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
                className="mt-1 w-full rounded-xl border border-dash-border bg-dash-surface px-3 py-2 text-sm text-dash-text"
              />
            </label>
            <label className="block text-xs font-medium text-dash-text-muted">
              Period end
              <input
                type="date"
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
                className="mt-1 w-full rounded-xl border border-dash-border bg-dash-surface px-3 py-2 text-sm text-dash-text"
              />
            </label>
            <button
              type="button"
              onClick={createClaimBatch}
              disabled={busy || eligibleRows.length === 0}
              className="self-end flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
              {busy ? "Creating..." : "Create batch"}
            </button>
          </div>
        </div>

        <div className="rounded-[1.25rem] border border-dash-border bg-dash-surface p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-dash-muted">
            Claim history
          </p>
          {claims.length === 0 ? (
            <p className="mt-4 text-sm text-dash-muted">No Gift Aid claim batches yet.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {claims.slice(0, 5).map((claim) => (
                <li key={claim.id} className="rounded-xl border border-dash-border bg-dash-surface-subtle p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-dash-text">
                      {claim.claim_reference ?? "Gift Aid claim"}
                    </p>
                    {statusBadge(claim.status)}
                  </div>
                  <p className="mt-1 text-xs text-dash-muted">
                    {formatDate(claim.period_start)} to {formatDate(claim.period_end)}
                  </p>
                  <p className="mt-2 text-sm text-dash-text">
                    £{claim.reclaimable_amount.toFixed(2)} reclaimable from {claim.donation_count} donations
                  </p>
                  {typeof claim.declarations_count === "number" && claim.declarations_count > 0 ? (
                    <p className="mt-1 text-xs text-emerald-700">
                      Includes {claim.declarations_count} declaration
                      {claim.declarations_count === 1 ? "" : "s"} for the Relief Chest
                    </p>
                  ) : null}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <a
                      href={`/api/admin/gift-aid/claims/${claim.id}/pack`}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-dash-border bg-dash-surface px-2.5 py-1 text-xs font-medium text-dash-text hover:bg-dash-surface-subtle"
                    >
                      <Download className="h-3 w-3" />
                      Download pack (ZIP)
                    </a>
                    {claim.status === "draft" ? (
                      <button
                        type="button"
                        onClick={() => updateClaimStatus(claim.id, "exported")}
                        disabled={busy}
                        className="rounded-lg border border-dash-border px-2.5 py-1 text-xs font-medium text-dash-text disabled:opacity-50"
                      >
                        Mark exported
                      </button>
                    ) : null}
                    {claim.status === "exported" ? (
                      <button
                        type="button"
                        onClick={() => updateClaimStatus(claim.id, "filed")}
                        disabled={busy}
                        className="rounded-lg border border-dash-border px-2.5 py-1 text-xs font-medium text-dash-text disabled:opacity-50"
                      >
                        Mark filed
                      </button>
                    ) : null}
                    {claim.status === "filed" ? (
                      <button
                        type="button"
                        onClick={() => updateClaimStatus(claim.id, "paid")}
                        disabled={busy}
                        className="rounded-lg border border-dash-border px-2.5 py-1 text-xs font-medium text-dash-text disabled:opacity-50"
                      >
                        Mark paid
                      </button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
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
                <tr
                  key={d.id}
                  className="cursor-pointer transition-colors hover:bg-dash-surface-subtle"
                  onClick={() => router.push(`/admin/gift-aid/${d.id}`)}
                >
                  <td className="font-medium text-dash-text">
                    <Link href={`/admin/gift-aid/${d.id}`} className="hover:text-dash-ring">
                      {d.donor_name}
                    </Link>
                  </td>
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
