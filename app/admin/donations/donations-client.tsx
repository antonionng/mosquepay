"use client";

import { useState, useMemo } from "react";
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
import type { LucideIcon } from "lucide-react";
import {
  Gift,
  Search,
  Download,
  Shield,
  CheckCircle2,
  AlertCircle,
  Banknote,
  Filter,
} from "lucide-react";

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
  reclaimable_amount?: number;
  total_donations?: number;
  status: string;
};

type KpiAccent = "emerald" | "blue" | "amber";

const kpiAccentIcon: Record<KpiAccent, { wrap: string; icon: string }> = {
  emerald: { wrap: "bg-emerald-500/10", icon: "text-emerald-600" },
  blue: { wrap: "bg-blue-500/10", icon: "text-blue-600" },
  amber: { wrap: "bg-amber-500/10", icon: "text-amber-700" },
};

function donationStatusBadge(status: string) {
  if (status === "completed")
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
  return (
    <Badge variant="destructive" className="capitalize">
      {status}
    </Badge>
  );
}

export function AdminDonationsClient({
  donations,
  giftAidDeclarations,
}: {
  donations: Donation[];
  giftAidDeclarations: GiftAidDeclaration[];
}) {
  const [sourceFilter, setSourceFilter] = useState("all");
  const [giftAidFilter, setGiftAidFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const totalAmount = donations
    .filter((d) => d.status === "completed")
    .reduce((s, d) => s + d.amount, 0);
  const giftAidEligible = donations.filter(
    (d) => d.gift_aid_eligible && d.status === "completed"
  );
  const giftAidDeclared = donations.filter(
    (d) => d.gift_aid_declared && d.status === "completed"
  );
  const declaredAmount = giftAidDeclared.reduce((s, d) => s + d.amount, 0);
  const reclaimable = declaredAmount * 0.25;

  const filteredDonations = useMemo(() => {
    let list = [...donations];
    if (sourceFilter !== "all") list = list.filter((d) => d.source === sourceFilter);
    if (giftAidFilter === "declared") list = list.filter((d) => d.gift_aid_declared);
    if (giftAidFilter === "eligible")
      list = list.filter((d) => d.gift_aid_eligible && !d.gift_aid_declared);
    if (giftAidFilter === "none") list = list.filter((d) => !d.gift_aid_eligible);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (d) =>
          (d.donor_name ?? "").toLowerCase().includes(q) ||
          d.donor_email.toLowerCase().includes(q)
      );
    }
    return list;
  }, [donations, sourceFilter, giftAidFilter, searchQuery]);

  const kpis: Array<{
    label: string;
    value: string;
    hint: string;
    icon: LucideIcon;
    accent: KpiAccent;
    valueClass?: string;
  }> = [
    {
      label: "Total donated",
      value: `£${totalAmount.toLocaleString()}`,
      hint: `${donations.length} donations`,
      icon: Banknote,
      accent: "emerald",
    },
    {
      label: "Gift Aid declared",
      value: String(giftAidDeclared.length),
      hint: `of ${giftAidEligible.length + giftAidDeclared.length} eligible`,
      icon: CheckCircle2,
      accent: "blue",
    },
    {
      label: "Reclaimable",
      value: `£${reclaimable.toFixed(2)}`,
      hint: "25% of declared amount",
      icon: Shield,
      accent: "emerald",
      valueClass: "text-emerald-700",
    },
    {
      label: "Pending action",
      value: String(giftAidEligible.length - giftAidDeclared.length),
      hint: "eligible but undeclared",
      icon: AlertCircle,
      accent: "amber",
    },
  ];

  return (
    <div className="space-y-8">
      <div className="admin-page-head">
        <div className="flex-1">
          <h1 className="admin-page-title">Donations</h1>
          <p className="admin-page-copy">
            Track all donations, Gift Aid status, and export records.
          </p>
        </div>
        <Button variant="dashboard" className="gap-2">
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((k) => {
          const Icon = k.icon;
          const ac = kpiAccentIcon[k.accent];
          return (
            <Card
              key={k.label}
              variant="kpi"
              className="dash-kpi-card h-full rounded-xl p-5 hover:border-dash-border-strong"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium uppercase tracking-[0.12em] text-dash-muted [.dash-kpi-card_&]:text-dash-muted">
                    {k.label}
                  </p>
                  <p
                    className={cn(
                      "mt-2 text-3xl font-semibold tracking-tight text-dash-text [.dash-kpi-card_&]:text-dash-text",
                      k.valueClass
                    )}
                  >
                    {k.value}
                  </p>
                  <p className="mt-2 text-xs text-dash-muted">{k.hint}</p>
                </div>
                <div
                  className={cn(
                    "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
                    ac.wrap
                  )}
                >
                  <Icon className={cn("h-5 w-5", ac.icon)} aria-hidden />
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <div className="dash-filter-bar flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-dash-muted" />
          <input
            type="text"
            placeholder="Search donors…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-dash-border bg-dash-surface py-2.5 pl-10 pr-4 text-sm text-dash-text placeholder:text-dash-faint focus:border-blue-500/50 focus:outline-none focus:ring-1 focus:ring-blue-500/30"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={sourceFilter} onValueChange={setSourceFilter}>
            <SelectTrigger className="h-10 w-full border-dash-border bg-dash-surface text-dash-text sm:w-[160px]">
              <SelectValue placeholder="Source" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sources</SelectItem>
              <SelectItem value="event">Event</SelectItem>
              <SelectItem value="direct">Direct</SelectItem>
              <SelectItem value="campaign">Campaign</SelectItem>
            </SelectContent>
          </Select>
          <Select value={giftAidFilter} onValueChange={setGiftAidFilter}>
            <SelectTrigger className="h-10 w-full border-dash-border bg-dash-surface text-dash-text sm:w-[220px]">
              <SelectValue placeholder="Gift Aid" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Gift Aid</SelectItem>
              <SelectItem value="declared">Declared</SelectItem>
              <SelectItem value="eligible">Eligible (undeclared)</SelectItem>
              <SelectItem value="none">Not eligible</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card variant="panel" className="overflow-hidden p-0">
        <div className="dash-panel-header rounded-none border-dash-border bg-dash-surface-subtle">
          <div>
            <h2 className="dash-panel-header-title">All donations</h2>
            <p className="dash-panel-header-description">
              Filtered by source and Gift Aid — amounts in GBP.
            </p>
          </div>
        </div>
        {filteredDonations.length === 0 ? (
          <div className="admin-empty bg-dash-surface text-dash-text-muted">
            No donations match your filters.
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
              {filteredDonations.map((d) => (
                <TableRow key={d.id} className={DASH_TABLE.row}>
                  <TableCell className={DASH_TABLE.cell}>
                    <div>
                      <p className="font-medium text-dash-text">{d.donor_name}</p>
                      <p className="text-xs text-dash-text-muted">{d.donor_email}</p>
                    </div>
                  </TableCell>
                  <TableCell className={DASH_TABLE.cell}>
                    <Badge
                      variant="outline"
                      className={cn(
                        "gap-1 border capitalize",
                        d.source === "event" &&
                          "border-violet-200 bg-violet-50 text-violet-800",
                        d.source === "campaign" && "border-blue-200 bg-blue-50 text-blue-800",
                        d.source === "direct" && "border-dash-border"
                      )}
                    >
                      {d.source === "event" && <Gift className="h-3 w-3" />}
                      {d.source === "campaign" && <Filter className="h-3 w-3" />}
                      {d.source === "direct" && <Banknote className="h-3 w-3" />}
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
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700">
                        <AlertCircle className="h-3.5 w-3.5" /> Eligible
                      </span>
                    ) : (
                      <span className="text-xs text-dash-text-muted">N/A</span>
                    )}
                  </TableCell>
                  <TableCell className={DASH_TABLE.cell}>{donationStatusBadge(d.status)}</TableCell>
                  <TableCell className={DASH_TABLE.cellMuted}>{formatDate(d.created_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <Card variant="panel" className="overflow-hidden p-0">
        <div className="dash-panel-header rounded-none border-dash-border bg-dash-surface-subtle">
          <div>
            <h2 className="dash-panel-header-title">Gift Aid declarations</h2>
            <p className="dash-panel-header-description">
              Active declarations linked to donors — 25p reclaim per £1 for eligible taxpayers.
            </p>
          </div>
        </div>
        <div className="space-y-2 border-t border-dash-border bg-dash-surface p-4 md:p-5">
          {giftAidDeclarations.map((g) => (
            <div
              key={g.id}
              className="flex flex-col gap-3 rounded-xl border border-dash-border bg-dash-surface-subtle/60 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15">
                  <Shield className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-dash-text">{g.donor_name}</p>
                  <p className="text-xs text-dash-text-muted">{g.donor_email}</p>
                </div>
              </div>
              <div className="hidden max-w-[200px] truncate text-xs text-dash-text-muted sm:block">
                {g.donor_address}
              </div>
              <div className="text-left sm:text-right">
                <p className="text-sm font-medium text-emerald-700">
                  £{(g.reclaimable_amount ?? 0).toFixed(2)}
                </p>
                <p className="text-xs text-dash-text-muted">
                  from £{(g.total_donations ?? 0).toFixed(2)} donated
                </p>
              </div>
              {g.status === "active" ? (
                <Badge variant="success" className="w-fit border-emerald-200 capitalize">
                  {g.status}
                </Badge>
              ) : g.status === "expired" ? (
                <Badge variant="warning" className="w-fit border-amber-200 capitalize">
                  {g.status}
                </Badge>
              ) : (
                <Badge variant="destructive" className="w-fit capitalize">
                  {g.status}
                </Badge>
              )}
            </div>
          ))}
          {giftAidDeclarations.length === 0 && (
            <p className="py-6 text-center text-sm text-dash-text-muted">
              No Gift Aid declarations on file.
            </p>
          )}
        </div>
      </Card>
    </div>
  );
}
