"use client";

import { Fragment, useState, useMemo } from "react";
import Link from "next/link";
import { formatDate, cn } from "@/lib/utils";
import { DASH_TABLE } from "@/lib/admin-dash-table";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CreditCard,
  Banknote,
  Clock,
  CheckCircle2,
  RotateCcw,
  ChevronDown,
  ChevronRight,
  Heart,
  Gift,
  ArrowRight,
  Search,
  Shield,
  Download,
} from "lucide-react";

type Payment = {
  id: string;
  user_email: string;
  user_name: string | null;
  total_amount: number;
  dining_amount: number;
  charity_amount: number;
  raffle_amount: number;
  refund_amount: number;
  status: string;
  charity_name: string | null;
  mooov_payment_id?: string | null;
  stripe_payment_intent_id: string | null;
  created_at: string;
};

type Donation = {
  id: string;
  donor_name: string | null;
  donor_email: string;
  amount: number;
  source: string;
  gift_aid_eligible?: boolean;
  gift_aid_declared?: boolean;
  status: string;
  created_at: string;
};

type GiftAidDeclaration = {
  id: string;
  donor_name: string;
  donor_email: string;
  donor_address?: string;
  declaration_date?: string;
  total_donations?: number;
  reclaimable_amount?: number;
  status: string;
};

type DuesRecord = {
  id: string;
  member_name: string | null;
  member_email: string;
  amount: number;
  status: string;
  paid_at: string | null;
  period_start: string;
  period_end: string;
};

type Tab = "payments" | "giftaid" | "donations";

type KpiAccent = "emerald" | "amber" | "blue" | "rose";

const kpiAccentIcon: Record<KpiAccent, { wrap: string; icon: string }> = {
  emerald: { wrap: "bg-emerald-500/10", icon: "text-emerald-600" },
  amber: { wrap: "bg-amber-500/10", icon: "text-amber-700" },
  blue: { wrap: "bg-blue-500/10", icon: "text-blue-600" },
  rose: { wrap: "bg-rose-500/10", icon: "text-rose-600" },
};

function paymentStatusBadge(status: string) {
  if (status === "succeeded" || status === "completed" || status === "paid")
    return (
      <Badge variant="success" className="border-emerald-200 capitalize">
        {status}
      </Badge>
    );
  if (status === "pending")
    return (
      <Badge variant="warning" className="border-amber-200 capitalize">
        {status}
      </Badge>
    );
  if (status === "refunded" || status === "partially_refunded")
    return (
      <Badge variant="destructive" className="capitalize">
        {status}
      </Badge>
    );
  return (
    <Badge variant="outline" className="border-dash-border capitalize">
      {status}
    </Badge>
  );
}

function giftAidStatusBadge(status: string) {
  if (status === "active")
    return (
      <Badge variant="success" className="border-emerald-200 capitalize">
        {status}
      </Badge>
    );
  if (status === "expired")
    return (
      <Badge variant="warning" className="border-amber-200 capitalize">
        {status}
      </Badge>
    );
  if (status === "revoked")
    return (
      <Badge variant="destructive" className="capitalize">
        {status}
      </Badge>
    );
  return (
    <Badge variant="outline" className="border-dash-border capitalize">
      {status}
    </Badge>
  );
}

export function AdminPaymentsClient({
  payments,
  donations,
  giftAidDeclarations,
  duesRecords,
}: {
  payments: Payment[];
  donations: Donation[];
  giftAidDeclarations: GiftAidDeclaration[];
  duesRecords: DuesRecord[];
}) {
  const [activeTab, setActiveTab] = useState<Tab>("payments");
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const succeeded = payments.filter(
    (p) => p.status === "succeeded" || p.status === "completed" || p.status === "paid"
  );
  const pending = payments.filter((p) => p.status === "pending");
  const refunded = payments.filter(
    (p) => p.status === "refunded" || p.status === "partially_refunded"
  );
  const totalRevenue = succeeded.reduce((s, p) => s + p.total_amount, 0);
  const pendingAmount = pending.reduce((s, p) => s + p.total_amount, 0);
  const refundedAmount = refunded.reduce((s, p) => s + p.refund_amount, 0);
  const diningIncome = succeeded.reduce((s, p) => s + (p.dining_amount ?? 0), 0);
  const charityIncome = succeeded.reduce((s, p) => s + (p.charity_amount ?? 0), 0);
  const duesOutstanding = duesRecords
    .filter((d) => d.status === "outstanding")
    .reduce((s, d) => s + d.amount, 0);

  const totalGiftAidReclaimable = giftAidDeclarations
    .filter((g) => g.status === "active")
    .reduce((s, g) => s + (g.reclaimable_amount ?? 0), 0);

  const summaryCards: Array<{
    label: string;
    value: string;
    icon: typeof Banknote;
    accent: KpiAccent;
    count: string;
  }> = [
    {
      label: "Total revenue",
      value: `£${totalRevenue.toFixed(2)}`,
      icon: Banknote,
      accent: "emerald",
      count: `${succeeded.length} payments`,
    },
    {
      label: "Pending",
      value: `£${pendingAmount.toFixed(2)}`,
      icon: Clock,
      accent: "amber",
      count: `${pending.length} payments`,
    },
    {
      label: "Completed",
      value: succeeded.length.toString(),
      icon: CheckCircle2,
      accent: "blue",
      count: "successful",
    },
    {
      label: "Refunded",
      value: `£${refundedAmount.toFixed(2)}`,
      icon: RotateCcw,
      accent: "rose",
      count: `${refunded.length} refunds`,
    },
  ];

  const filteredPayments = useMemo(() => {
    let list = [...payments];
    if (statusFilter !== "all") list = list.filter((p) => p.status === statusFilter);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (p) =>
          p.user_email.toLowerCase().includes(q) ||
          (p.user_name ?? "").toLowerCase().includes(q)
      );
    }
    return list.slice(0, 50);
  }, [payments, statusFilter, searchQuery]);

  const tabs: { key: Tab; label: string; icon: typeof CreditCard }[] = [
    { key: "payments", label: "Payments", icon: CreditCard },
    { key: "giftaid", label: "Gift Aid", icon: Shield },
    { key: "donations", label: "Donations", icon: Gift },
  ];

  function downloadCsv(filename: string, headers: string[], rows: Array<Array<string | number | null>>) {
    const csv = [headers, ...rows]
      .map((row) =>
        row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(",")
      )
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  function exportTreasurerReport(kind: string) {
    if (kind === "dues") {
      downloadCsv(
        "dues-outstanding.csv",
        ["Name", "Email", "Amount", "Status", "Period start", "Period end"],
        duesRecords
          .filter((d) => d.status === "outstanding")
          .map((d) => [d.member_name, d.member_email, d.amount, d.status, d.period_start, d.period_end])
      );
    }
    if (kind === "payments") {
      downloadCsv(
        "payments-received.csv",
        ["Date", "Name", "Email", "Amount", "Status", "Mooov reference"],
        succeeded.map((p) => [
          p.created_at,
          p.user_name,
          p.user_email,
          p.total_amount,
          p.status,
          p.mooov_payment_id ?? p.stripe_payment_intent_id,
        ])
      );
    }
    if (kind === "dining") {
      downloadCsv(
        "dining-income.csv",
        ["Date", "Name", "Email", "Dining amount", "Status", "Mooov reference"],
        payments
          .filter((p) => p.dining_amount > 0)
          .map((p) => [
            p.created_at,
            p.user_name,
            p.user_email,
            p.dining_amount,
            p.status,
            p.mooov_payment_id ?? p.stripe_payment_intent_id,
          ])
      );
    }
    if (kind === "charity") {
      downloadCsv(
        "charity-totals.csv",
        ["Date", "Name", "Email", "Amount", "Source", "Gift Aid", "Status"],
        donations.map((d) => [
          d.created_at,
          d.donor_name,
          d.donor_email,
          d.amount,
          d.source,
          d.gift_aid_declared ? "yes" : "no",
          d.status,
        ])
      );
    }
    if (kind === "refunds") {
      downloadCsv(
        "refunds.csv",
        ["Date", "Name", "Email", "Refund amount", "Status", "Mooov reference"],
        payments
          .filter((p) => p.refund_amount > 0 || p.status === "refunded")
          .map((p) => [
            p.created_at,
            p.user_name,
            p.user_email,
            p.refund_amount,
            p.status,
            p.mooov_payment_id ?? p.stripe_payment_intent_id,
          ])
      );
    }
    if (kind === "gift-aid") {
      downloadCsv(
        "gift-aid-export.csv",
        ["Donor", "Email", "Address", "Declaration date", "Donations", "Reclaimable", "Status"],
        giftAidDeclarations.map((g) => [
          g.donor_name,
          g.donor_email,
          g.donor_address ?? "",
          g.declaration_date ?? "",
          g.total_donations ?? 0,
          g.reclaimable_amount ?? 0,
          g.status,
        ])
      );
    }
    if (kind === "reconciliation") {
      downloadCsv(
        "payment-reconciliation.csv",
        ["Date", "Name", "Email", "Gross", "Dining", "Charity", "Raffle", "Refund", "Status", "Mooov reference"],
        payments.map((p) => [
          p.created_at,
          p.user_name,
          p.user_email,
          p.total_amount,
          p.dining_amount,
          p.charity_amount,
          p.raffle_amount,
          p.refund_amount,
          p.status,
          p.mooov_payment_id ?? p.stripe_payment_intent_id,
        ])
      );
    }
  }

  return (
    <div className="space-y-5 sm:space-y-8">
      <div className="admin-page-head">
        <div>
          <h1 className="admin-page-title">Payments</h1>
          <p className="admin-page-copy">
            Payment history, Gift Aid declarations, and donation tracking.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {summaryCards.map((card) => {
          const Icon = card.icon;
          const ac = kpiAccentIcon[card.accent];
          return (
            <Card
              key={card.label}
              variant="kpi"
              className="dash-kpi-card h-full rounded-xl p-3 hover:border-dash-border-strong sm:p-5"
            >
              <div className="flex items-start justify-between gap-2 sm:gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-dash-muted sm:text-xs [.dash-kpi-card_&]:text-dash-muted">
                    {card.label}
                  </p>
                  <p className="mt-1 text-xl font-semibold tracking-tight text-dash-text sm:mt-2 sm:text-3xl [.dash-kpi-card_&]:text-dash-text">
                    {card.value}
                  </p>
                  <p className="mt-1 hidden text-xs text-dash-muted sm:mt-2 sm:block">{card.count}</p>
                </div>
                <div
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl sm:h-11 sm:w-11",
                    ac.wrap
                  )}
                >
                  <Icon className={cn("h-4 w-4 sm:h-5 sm:w-5", ac.icon)} aria-hidden />
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <Card variant="panel" className="p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-base font-semibold text-dash-text">Treasurer Exports</h2>
            <p className="mt-1 text-sm text-dash-muted">
              Export dues, payments, dining, charity, refunds, Gift Aid, and Mooov reconciliation.
            </p>
            <p className="mt-2 text-xs text-dash-faint">
              Outstanding dues £{duesOutstanding.toFixed(2)} · Dining £{diningIncome.toFixed(2)} · Charity £{charityIncome.toFixed(2)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              ["dues", "Dues Outstanding"],
              ["payments", "Payments Received"],
              ["dining", "Dining Income"],
              ["charity", "Charity Totals"],
              ["refunds", "Refunds"],
              ["gift-aid", "Gift Aid"],
              ["reconciliation", "Mooov Reconciliation"],
            ].map(([kind, label]) => (
              <Button
                key={kind}
                type="button"
                variant="dashboard"
                size="sm"
                onClick={() => exportTreasurerReport(kind)}
              >
                <Download className="mr-1.5 h-4 w-4" />
                {label}
              </Button>
            ))}
          </div>
        </div>
      </Card>

      <div className="dash-filter-bar flex flex-wrap items-center gap-2 py-3">
        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-dash-muted">
          Workspace
        </span>
        <div className="flex flex-wrap items-center gap-1 rounded-xl border border-dash-border bg-dash-surface-subtle p-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <Button
                key={tab.key}
                type="button"
                variant={activeTab === tab.key ? "secondary" : "ghost"}
                size="sm"
                className={cn(
                  "gap-2 rounded-lg",
                  activeTab === tab.key
                    ? "bg-dash-surface text-dash-text shadow-sm"
                    : "text-dash-muted hover:bg-dash-surface hover:text-dash-text"
                )}
                onClick={() => setActiveTab(tab.key)}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </Button>
            );
          })}
        </div>
      </div>

      {activeTab === "payments" && (
        <Card variant="panel" className="overflow-hidden p-0">
          <div className="dash-panel-header rounded-none border-dash-border bg-dash-surface-subtle">
            <div>
              <h2 className="dash-panel-header-title">Ledger</h2>
              <p className="dash-panel-header-description">
                Search and expand rows for dining, charity, and raffle splits.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3 border-b border-dash-border bg-dash-surface px-4 py-4 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-dash-text-faint" />
              <input
                type="text"
                placeholder="Search by name or email…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-dash-border bg-dash-surface-subtle py-2.5 pl-10 pr-4 text-sm text-dash-text placeholder:text-dash-faint focus:border-dash-ring focus:outline-none focus:ring-2 focus:ring-dash-ring/20"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger variant="dashboard" className="h-10 w-full sm:w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="succeeded">Succeeded</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="refunded">Refunded</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {filteredPayments.length === 0 ? (
            <div className="admin-empty bg-dash-surface text-dash-text-muted">
              No payments match your filters.
            </div>
          ) : (
            <Table className={DASH_TABLE.table}>
              <TableHeader className={DASH_TABLE.header}>
                <TableRow className="border-0 hover:bg-transparent">
                  <TableHead className={cn(DASH_TABLE.head, "w-10")} />
                  <TableHead className={DASH_TABLE.head}>Date</TableHead>
                  <TableHead className={DASH_TABLE.head}>Name</TableHead>
                  <TableHead className={DASH_TABLE.head}>Email</TableHead>
                  <TableHead className={cn(DASH_TABLE.head, "text-right")}>Amount</TableHead>
                  <TableHead className={DASH_TABLE.head}>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPayments.map((p) => (
                  <Fragment key={p.id}>
                    <TableRow
                      className={cn(DASH_TABLE.row, "cursor-pointer")}
                      onClick={() => setExpandedRow(expandedRow === p.id ? null : p.id)}
                    >
                      <TableCell className={DASH_TABLE.cell}>
                        {expandedRow === p.id ? (
                          <ChevronDown className="h-4 w-4 text-dash-text-faint" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-dash-text-faint" />
                        )}
                      </TableCell>
                      <TableCell className={DASH_TABLE.cellMuted}>
                        {formatDate(p.created_at)}
                      </TableCell>
                      <TableCell className={cn(DASH_TABLE.cell, "font-medium")}>
                        {p.user_name ?? "Not recorded"}
                      </TableCell>
                      <TableCell className={DASH_TABLE.cellMuted}>{p.user_email}</TableCell>
                      <TableCell className={cn(DASH_TABLE.cell, "text-right font-medium tabular-nums")}>
                        £{Number(p.total_amount).toFixed(2)}
                      </TableCell>
                      <TableCell className={DASH_TABLE.cell}>{paymentStatusBadge(p.status)}</TableCell>
                    </TableRow>
                    {expandedRow === p.id && (
                      <TableRow className={DASH_TABLE.row}>
                        <TableCell colSpan={6} className="!p-0">
                          <div className="border-t border-dash-border bg-dash-surface-subtle/80 px-6 py-4">
                            <div className="grid gap-4 sm:grid-cols-3">
                              <div className="rounded-xl border border-dash-border bg-dash-surface p-4">
                                <div className="mb-2 flex items-center gap-2 text-xs text-dash-text-muted">
                                  <CreditCard className="h-3.5 w-3.5" /> Dining
                                </div>
                                <p className="text-lg font-semibold text-dash-text">
                                  £{Number(p.dining_amount).toFixed(2)}
                                </p>
                              </div>
                              <div className="rounded-xl border border-dash-border bg-dash-surface p-4">
                                <div className="mb-2 flex items-center gap-2 text-xs text-dash-text-muted">
                                  <Heart className="h-3.5 w-3.5" /> Charity
                                </div>
                                <p className="text-lg font-semibold text-dash-text">
                                  £{Number(p.charity_amount).toFixed(2)}
                                </p>
                                {p.charity_name && (
                                  <p className="mt-1 text-xs text-dash-text-muted">{p.charity_name}</p>
                                )}
                              </div>
                              <div className="rounded-xl border border-dash-border bg-dash-surface p-4">
                                <div className="mb-2 flex items-center gap-2 text-xs text-dash-text-muted">
                                  <Gift className="h-3.5 w-3.5" /> Raffle
                                </div>
                                <p className="text-lg font-semibold text-dash-text">
                                  £{Number(p.raffle_amount).toFixed(2)}
                                </p>
                              </div>
                            </div>
                            {(p.mooov_payment_id ?? p.stripe_payment_intent_id) && (
                              <p className="mt-3 text-xs text-dash-text-muted">
                                Payment reference: {p.mooov_payment_id ?? p.stripe_payment_intent_id}
                              </p>
                            )}
                            <div className="mt-3">
                              <Link
                                href={`/admin/payments/${p.id}`}
                                className="text-xs font-medium text-dash-ring hover:underline"
                              >
                                Open full payment record →
                              </Link>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      )}

      {activeTab === "giftaid" && (
        <div className="space-y-4 sm:space-y-6">
          <Card variant="panel" className="overflow-hidden border-emerald-500/20 bg-gradient-to-r from-emerald-500/[0.06] to-blue-500/[0.06] p-0">
            <div className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15">
                <Shield className="h-6 w-6 text-emerald-600" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-dash-text-muted">Total reclaimable Gift Aid</p>
                <p className="text-3xl font-bold text-emerald-700">
                  £{totalGiftAidReclaimable.toFixed(2)}
                </p>
                <p className="mt-2 text-xs text-dash-text-muted">
                  From {giftAidDeclarations.filter((g) => g.status === "active").length} active
                  declarations. Gift Aid allows you to reclaim 25p for every £1 donated by eligible UK
                  taxpayers.
                </p>
              </div>
            </div>
          </Card>

          <Card variant="panel" className="overflow-hidden p-0">
            <div className="dash-panel-header rounded-none border-dash-border bg-dash-surface-subtle">
              <div>
                <h2 className="dash-panel-header-title">Declarations</h2>
                <p className="dash-panel-header-description">
                  Donor addresses and reclaimable totals.
                </p>
              </div>
            </div>
            {giftAidDeclarations.length === 0 ? (
              <div className="admin-empty bg-dash-surface text-dash-text-muted">
                No Gift Aid declarations yet.
              </div>
            ) : (
              <Table className={DASH_TABLE.table}>
                <TableHeader className={DASH_TABLE.header}>
                  <TableRow className="border-0 hover:bg-transparent">
                    <TableHead className={DASH_TABLE.head}>Donor</TableHead>
                    <TableHead className={DASH_TABLE.head}>Email</TableHead>
                    <TableHead className={DASH_TABLE.head}>Address</TableHead>
                    <TableHead className={DASH_TABLE.head}>Declared</TableHead>
                    <TableHead className={cn(DASH_TABLE.head, "text-right")}>Total donated</TableHead>
                    <TableHead className={cn(DASH_TABLE.head, "text-right")}>Reclaimable</TableHead>
                    <TableHead className={DASH_TABLE.head}>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {giftAidDeclarations.map((g) => (
                    <TableRow key={g.id} className={DASH_TABLE.row}>
                      <TableCell className={cn(DASH_TABLE.cell, "font-medium")}>{g.donor_name}</TableCell>
                      <TableCell className={DASH_TABLE.cellMuted}>{g.donor_email}</TableCell>
                      <TableCell className={cn(DASH_TABLE.cellMuted, "max-w-[200px] truncate text-xs")}>
                        {g.donor_address}
                      </TableCell>
                      <TableCell className={DASH_TABLE.cellMuted}>
                        {g.declaration_date ? formatDate(g.declaration_date) : "Not recorded"}
                      </TableCell>
                      <TableCell className={cn(DASH_TABLE.cell, "text-right tabular-nums")}>
                        £{(g.total_donations ?? 0).toFixed(2)}
                      </TableCell>
                      <TableCell className={cn(DASH_TABLE.cell, "text-right font-medium text-emerald-700 tabular-nums")}>
                        £{(g.reclaimable_amount ?? 0).toFixed(2)}
                      </TableCell>
                      <TableCell className={DASH_TABLE.cell}>{giftAidStatusBadge(g.status)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </div>
      )}

      {activeTab === "donations" && (
        <Card variant="panel" className="overflow-hidden p-0">
          <div className="dash-panel-header flex-col gap-3 rounded-none border-dash-border bg-dash-surface-subtle sm:flex-row sm:items-center">
            <div>
              <h2 className="dash-panel-header-title">Donations snapshot</h2>
              <p className="dash-panel-header-description">
                Latest rows. Open the full page for filters and export.
              </p>
            </div>
            <Button variant="dashboard" size="sm" asChild className="shrink-0">
              <Link href="/admin/donations" className="gap-1">
                Full donations <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
          <div className="border-b border-dash-border bg-dash-surface px-4 py-3">
            <p className="text-sm text-dash-text-muted">
              {donations.length} donation{donations.length !== 1 ? "s" : ""} recorded
            </p>
          </div>
          {donations.length === 0 ? (
            <div className="admin-empty bg-dash-surface text-dash-text-muted">
              No donations recorded yet.
            </div>
          ) : (
            <Table className={DASH_TABLE.table}>
              <TableHeader className={DASH_TABLE.header}>
                <TableRow className="border-0 hover:bg-transparent">
                  <TableHead className={DASH_TABLE.head}>Donor</TableHead>
                  <TableHead className={DASH_TABLE.head}>Source</TableHead>
                  <TableHead className={cn(DASH_TABLE.head, "text-right")}>Amount</TableHead>
                  <TableHead className={DASH_TABLE.head}>Gift Aid</TableHead>
                  <TableHead className={DASH_TABLE.head}>Status</TableHead>
                  <TableHead className={DASH_TABLE.head}>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {donations.slice(0, 20).map((d) => (
                  <TableRow key={d.id} className={DASH_TABLE.row}>
                    <TableCell className={DASH_TABLE.cell}>
                      <div>
                        <p className="font-medium text-dash-text">{d.donor_name}</p>
                        <p className="text-xs text-dash-text-muted">{d.donor_email}</p>
                      </div>
                    </TableCell>
                    <TableCell className={DASH_TABLE.cell}>
                      <Badge variant="outline" className="border-dash-border capitalize">
                        {d.source}
                      </Badge>
                    </TableCell>
                    <TableCell className={cn(DASH_TABLE.cell, "text-right font-medium tabular-nums")}>
                      £{d.amount.toFixed(2)}
                    </TableCell>
                    <TableCell className={DASH_TABLE.cell}>
                      {d.gift_aid_declared ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Declared
                        </span>
                      ) : d.gift_aid_eligible ? (
                        <span className="text-xs font-medium text-amber-700">Eligible</span>
                      ) : (
                        <span className="text-xs text-dash-text-muted">N/A</span>
                      )}
                    </TableCell>
                    <TableCell className={DASH_TABLE.cell}>{paymentStatusBadge(d.status)}</TableCell>
                    <TableCell className={DASH_TABLE.cellMuted}>{formatDate(d.created_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      )}
    </div>
  );
}
