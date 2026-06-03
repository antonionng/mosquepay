"use client";

import { Fragment, useState, useMemo, useCallback, useEffect, type ReactNode } from "react";
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
  Wallet,
  Coins,
  Ticket,
  CalendarDays,
  UtensilsCrossed,
} from "lucide-react";

type Payment = {
  id: string;
  user_email: string;
  user_name: string | null;
  total_amount: number;
  dining_amount: number;
  charity_amount: number;
  raffle_amount: number;
  meeting_fee_amount: number;
  guest_ticket_amount: number;
  refund_amount: number;
  status: string;
  category?: string | null;
  charity_name: string | null;
  payment_method?: string | null;
  payment_method_note?: string | null;
  recorded_by_email?: string | null;
  mooov_payment_id?: string | null;
  stripe_payment_intent_id: string | null;
  created_at: string;
};

// How the money arrived, grouped for the treasurer's mental model:
//   * cash  — physically handed over, counted into the tin.
//   * card  — LodgePay digital (QR / online card). null/legacy online rows
//             fall here too since they were card payments before we tracked
//             the method explicitly.
//   * other — cheque / BACS / manual "other".
type MethodGroup = "cash" | "card" | "other";

function methodGroup(pm: string | null | undefined): MethodGroup {
  if (pm === "cash") return "cash";
  if (pm === "cheque" || pm === "bacs" || pm === "other") return "other";
  return "card";
}

function methodMeta(pm: string | null | undefined): {
  label: string;
  icon: typeof Banknote;
  group: MethodGroup;
} {
  switch (pm) {
    case "cash":
      return { label: "Cash", icon: Banknote, group: "cash" };
    case "cheque":
      return { label: "Cheque", icon: Wallet, group: "other" };
    case "bacs":
      return { label: "BACS", icon: Wallet, group: "other" };
    case "other":
      return { label: "Other", icon: Coins, group: "other" };
    case "card_online":
      return { label: "LodgePay", icon: CreditCard, group: "card" };
    case "card_qr":
    default:
      return { label: "LodgePay", icon: CreditCard, group: "card" };
  }
}

// Per-category gross split for a payment row. The sub-amount columns are the
// source of truth (not the metadata `category` tag, which is "mixed" for an
// itemised basket), so a single payment can land in several buckets. Anything
// not tagged to a bucket is general/other income.
const CATEGORY_KEYS = [
  "dining",
  "charity",
  "raffle",
  "meeting_fee",
  "guest_ticket",
  "general",
] as const;
type CategoryKey = (typeof CATEGORY_KEYS)[number];

const CATEGORY_LABEL: Record<CategoryKey, string> = {
  dining: "Dining",
  charity: "Charity",
  raffle: "Raffle",
  meeting_fee: "Meeting fee",
  guest_ticket: "Guest ticket",
  general: "General / Other",
};

function categoryAmounts(p: Payment): Record<CategoryKey, number> {
  const dining = Number(p.dining_amount ?? 0);
  const charity = Number(p.charity_amount ?? 0);
  const raffle = Number(p.raffle_amount ?? 0);
  const meetingFee = Number(p.meeting_fee_amount ?? 0);
  const guestTicket = Number(p.guest_ticket_amount ?? 0);
  const general = Math.max(
    0,
    Number(p.total_amount ?? 0) -
      dining -
      charity -
      raffle -
      meetingFee -
      guestTicket,
  );
  return {
    dining,
    charity,
    raffle,
    meeting_fee: meetingFee,
    guest_ticket: guestTicket,
    general,
  };
}

// Date scope for the whole page so the treasurer can isolate a single
// evening's takings (KPIs, the cash/card ratio, category breakdown, the
// ledger, and the exports all respect it). Computed in the browser's local
// timezone against created_at.
type DateScope = "all" | "today" | "yesterday" | "7d" | "month";

const DATE_SCOPE_LABEL: Record<DateScope, string> = {
  all: "All time",
  today: "Today",
  yesterday: "Yesterday",
  "7d": "Last 7 days",
  month: "This month",
};

function scopeRange(scope: DateScope): {
  start: number | null;
  end: number | null;
} {
  if (scope === "all") return { start: null, end: null };
  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();
  const DAY = 24 * 60 * 60 * 1000;
  switch (scope) {
    case "today":
      return { start: startOfToday, end: null };
    case "yesterday":
      return { start: startOfToday - DAY, end: startOfToday };
    case "7d":
      return { start: startOfToday - 6 * DAY, end: null };
    case "month":
      return {
        start: new Date(now.getFullYear(), now.getMonth(), 1).getTime(),
        end: null,
      };
    default:
      return { start: null, end: null };
  }
}

function MethodBadge({ pm }: { pm: string | null | undefined }) {
  const m = methodMeta(pm);
  const Icon = m.icon;
  const tone =
    m.group === "cash"
      ? "border-amber-200 bg-amber-50 text-amber-800"
      : m.group === "card"
        ? "border-blue-200 bg-blue-50 text-blue-700"
        : "border-slate-200 bg-slate-50 text-slate-600";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs font-medium",
        tone,
      )}
    >
      <Icon className="h-3 w-3" />
      {m.label}
    </span>
  );
}

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

// Money that actually landed in the tin / on the card machine. Excludes
// pending, failed, voided/cancelled, and refunded (incl. partial) so they
// never inflate reconciliation totals.
function isCollected(status: string): boolean {
  return status === "succeeded" || status === "completed" || status === "paid";
}

// Money that left again or never landed: refunds and reversals. Hidden from
// the ledger by default so they don't clutter reconciliation; still reachable
// via the Refunded status filter.
function isReversed(status: string): boolean {
  return (
    status === "refunded" ||
    status === "partially_refunded" ||
    status === "voided" ||
    status === "cancelled" ||
    status === "canceled"
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
  const [methodFilter, setMethodFilter] = useState<"all" | MethodGroup>("all");
  const [categoryFilter, setCategoryFilter] = useState<"all" | CategoryKey>(
    "all",
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [dateScope, setDateScope] = useState<DateScope>("all");
  // Price of one raffle strip, so a £10 payment counts as 2 strips, not 1.
  // Remembered across visits/meetings via localStorage.
  const [rafflePrice, setRafflePrice] = useState(5);
  useEffect(() => {
    const saved = window.localStorage.getItem("c0v.rafflePricePerStrip");
    const n = saved ? Number(saved) : NaN;
    if (Number.isFinite(n) && n > 0) setRafflePrice(n);
  }, []);
  const updateRafflePrice = useCallback((value: number) => {
    setRafflePrice(value);
    if (Number.isFinite(value) && value > 0)
      window.localStorage.setItem("c0v.rafflePricePerStrip", String(value));
  }, []);
  const stripsFor = useCallback(
    (amount: number) =>
      rafflePrice > 0 ? Math.round((amount ?? 0) / rafflePrice) : 0,
    [rafflePrice],
  );

  const { start: scopeStart, end: scopeEnd } = useMemo(
    () => scopeRange(dateScope),
    [dateScope],
  );
  const inScope = useCallback(
    (iso: string) => {
      if (scopeStart == null && scopeEnd == null) return true;
      const t = new Date(iso).getTime();
      if (Number.isNaN(t)) return true;
      if (scopeStart != null && t < scopeStart) return false;
      if (scopeEnd != null && t >= scopeEnd) return false;
      return true;
    },
    [scopeStart, scopeEnd],
  );
  // Everything below works off the date-scoped sets so a chosen evening
  // flows through the KPIs, ratio, breakdown, ledger, and exports alike.
  const scopedPayments = useMemo(
    () => payments.filter((p) => inScope(p.created_at)),
    [payments, inScope],
  );
  const scopedDonations = useMemo(
    () => donations.filter((d) => inScope(d.created_at)),
    [donations, inScope],
  );

  const succeeded = scopedPayments.filter(
    (p) => p.status === "succeeded" || p.status === "completed" || p.status === "paid"
  );
  const pending = scopedPayments.filter((p) => p.status === "pending");
  const refunded = scopedPayments.filter(
    (p) => p.status === "refunded" || p.status === "partially_refunded"
  );
  const totalRevenue = succeeded.reduce((s, p) => s + p.total_amount, 0);
  const pendingAmount = pending.reduce((s, p) => s + p.total_amount, 0);
  const refundedAmount = refunded.reduce((s, p) => s + p.refund_amount, 0);
  const diningIncome = succeeded.reduce((s, p) => s + (p.dining_amount ?? 0), 0);
  const charityIncome = succeeded.reduce((s, p) => s + (p.charity_amount ?? 0), 0);
  const raffleIncome = succeeded.reduce((s, p) => s + (p.raffle_amount ?? 0), 0);
  const raffleStrips = succeeded.reduce(
    (s, p) => s + (p.raffle_amount > 0 ? stripsFor(p.raffle_amount) : 0),
    0,
  );
  const raffleBuyers = succeeded.filter((p) => p.raffle_amount > 0).length;
  const duesOutstanding = duesRecords
    .filter((d) => d.status === "outstanding")
    .reduce((s, d) => s + d.amount, 0);
  const duesCollected = duesRecords
    .filter((d) => d.status === "paid" || d.status === "succeeded" || d.status === "completed")
    .reduce((s, d) => s + d.amount, 0);

  const countWith = (selector: (p: Payment) => number) =>
    succeeded.filter((p) => (selector(p) ?? 0) > 0).length;

  const otherIncome = Math.max(
    0,
    succeeded.reduce(
      (s, p) =>
        s +
        (p.total_amount -
          (p.dining_amount ?? 0) -
          (p.charity_amount ?? 0) -
          (p.raffle_amount ?? 0)),
      0
    )
  );
  const otherCount = succeeded.filter(
    (p) =>
      p.total_amount -
        (p.dining_amount ?? 0) -
        (p.charity_amount ?? 0) -
        (p.raffle_amount ?? 0) >
      0
  ).length;

  const breakdownTotal =
    diningIncome + charityIncome + raffleIncome + otherIncome + duesCollected;

  const breakdownCategories: Array<{
    label: string;
    value: number;
    count: number;
    icon: typeof Banknote;
    accent: KpiAccent;
    categoryKey?: CategoryKey;
    countLabel?: string;
  }> = [
    {
      label: "Dining",
      value: diningIncome,
      count: countWith((p) => p.dining_amount),
      icon: UtensilsCrossed,
      accent: "blue",
      categoryKey: "dining",
    },
    {
      label: "Charity",
      value: charityIncome,
      count: countWith((p) => p.charity_amount),
      icon: Heart,
      accent: "rose",
      categoryKey: "charity",
    },
    {
      label: "Raffle",
      value: raffleIncome,
      count: countWith((p) => p.raffle_amount),
      icon: Ticket,
      accent: "amber",
      categoryKey: "raffle",
      countLabel: `${raffleStrips} strip${raffleStrips !== 1 ? "s" : ""} · ${raffleBuyers} ${raffleBuyers === 1 ? "buyer" : "buyers"}`,
    },
    {
      label: "Dues",
      value: duesCollected,
      count: duesRecords.filter(
        (d) => d.status === "paid" || d.status === "succeeded" || d.status === "completed"
      ).length,
      icon: Wallet,
      accent: "emerald",
    },
    {
      label: "Other",
      value: otherIncome,
      count: otherCount,
      icon: Coins,
      accent: "blue",
      categoryKey: "general",
    },
  ];

  // Cash vs LodgePay (digital) split over completed income, for the
  // "How they paid" ratio panel. `other` (cheque/BACS) only shows if present.
  const methodTotals = succeeded.reduce(
    (acc, p) => {
      const g = methodGroup(p.payment_method);
      acc[g].amount += p.total_amount;
      acc[g].count += 1;
      return acc;
    },
    {
      cash: { amount: 0, count: 0 },
      card: { amount: 0, count: 0 },
      other: { amount: 0, count: 0 },
    } as Record<MethodGroup, { amount: number; count: number }>,
  );
  const methodGrandTotal =
    methodTotals.cash.amount +
    methodTotals.card.amount +
    methodTotals.other.amount;
  const pctOf = (n: number) =>
    methodGrandTotal > 0 ? Math.round((n / methodGrandTotal) * 100) : 0;

  const methodRatioAll: Array<{
    key: MethodGroup;
    label: string;
    amount: number;
    count: number;
    pct: number;
    icon: typeof Banknote;
    bar: string;
    accent: KpiAccent;
  }> = [
    {
      key: "card",
      label: "LodgePay digital",
      amount: methodTotals.card.amount,
      count: methodTotals.card.count,
      pct: pctOf(methodTotals.card.amount),
      icon: CreditCard,
      bar: "bg-blue-500",
      accent: "blue",
    },
    {
      key: "cash",
      label: "Cash",
      amount: methodTotals.cash.amount,
      count: methodTotals.cash.count,
      pct: pctOf(methodTotals.cash.amount),
      icon: Banknote,
      bar: "bg-amber-500",
      accent: "amber",
    },
    {
      key: "other",
      label: "Cheque / BACS",
      amount: methodTotals.other.amount,
      count: methodTotals.other.count,
      pct: pctOf(methodTotals.other.amount),
      icon: Wallet,
      bar: "bg-slate-400",
      accent: "blue",
    },
  ];
  const methodRatio = methodRatioAll.filter(
    (m) => m.key !== "other" || m.amount > 0,
  );

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

  const matchedPayments = useMemo(() => {
    let list = [...scopedPayments];
    if (statusFilter === "all") {
      // Default view hides refunds/reversals so they never read as income.
      list = list.filter((p) => !isReversed(p.status));
    } else if (statusFilter === "refunded") {
      list = list.filter((p) => isReversed(p.status));
    } else {
      list = list.filter((p) => p.status === statusFilter);
    }
    if (methodFilter !== "all")
      list = list.filter((p) => methodGroup(p.payment_method) === methodFilter);
    if (categoryFilter !== "all")
      list = list.filter(
        (p) => categoryAmounts(p)[categoryFilter] > 0,
      );
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (p) =>
          p.user_email.toLowerCase().includes(q) ||
          (p.user_name ?? "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [scopedPayments, statusFilter, methodFilter, categoryFilter, searchQuery]);

  // Total of the matched rows — for the category filter this is that
  // category's gross (so "Cash + Raffle" gives the raffle cash takings); for
  // everything else it's the row total. Doubles as the cash count at the
  // bottom of the table when filtered to Method = Cash. Only counts collected
  // money so refunded/cancelled/pending rows can't inflate the figure (they
  // still show in the table, just not in this total).
  const matchedCollected = useMemo(
    () => matchedPayments.filter((p) => isCollected(p.status)),
    [matchedPayments],
  );
  const matchedTotal = useMemo(
    () =>
      matchedCollected.reduce((s, p) => {
        if (categoryFilter !== "all")
          return s + categoryAmounts(p)[categoryFilter];
        return s + p.total_amount;
      }, 0),
    [matchedCollected, categoryFilter],
  );

  const ROW_CAP = 200;
  const filteredPayments = matchedPayments.slice(0, ROW_CAP);
  const anyFilterActive =
    statusFilter !== "all" ||
    methodFilter !== "all" ||
    categoryFilter !== "all" ||
    searchQuery.trim().length > 0;

  const focusCategory = (key: CategoryKey) => {
    setActiveTab("payments");
    setCategoryFilter((prev) => (prev === key ? "all" : key));
  };

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
        ["Date", "Name", "Email", "Amount", "Method", "Status", "Mooov reference"],
        succeeded.map((p) => [
          p.created_at,
          p.user_name,
          p.user_email,
          p.total_amount,
          methodMeta(p.payment_method).label,
          p.status,
          p.mooov_payment_id ?? p.stripe_payment_intent_id,
        ])
      );
    }
    if (kind === "dining") {
      downloadCsv(
        "dining-income.csv",
        ["Date", "Name", "Email", "Dining amount", "Method", "Status", "Mooov reference"],
        scopedPayments
          .filter((p) => p.dining_amount > 0 && isCollected(p.status))
          .map((p) => [
            p.created_at,
            p.user_name,
            p.user_email,
            p.dining_amount,
            methodMeta(p.payment_method).label,
            p.status,
            p.mooov_payment_id ?? p.stripe_payment_intent_id,
          ])
      );
    }
    if (kind === "raffle") {
      // Raffle handout list. Driven by raffle_amount > 0 (works for itemised
      // baskets too) and excludes refunded/voided rows so you never hand out
      // a ticket for a reversed payment.
      downloadCsv(
        "raffle-tickets.csv",
        ["Date", "Name", "Email", "Strips", "Raffle amount", "Method", "Status", "Reference"],
        scopedPayments
          .filter((p) => p.raffle_amount > 0 && isCollected(p.status))
          .map((p) => [
            p.created_at,
            p.user_name,
            p.user_email,
            stripsFor(p.raffle_amount),
            p.raffle_amount,
            methodMeta(p.payment_method).label,
            p.status,
            p.mooov_payment_id ?? p.stripe_payment_intent_id,
          ])
      );
    }
    if (kind === "cash") {
      // Cash collection sheet for counting the tin at the end of the night.
      downloadCsv(
        "cash-collected.csv",
        ["Date", "Name", "Email", "Amount", "Charity", "Raffle", "Dining", "Recorded by", "Status"],
        scopedPayments
          .filter(
            (p) =>
              methodGroup(p.payment_method) === "cash" && isCollected(p.status),
          )
          .map((p) => [
            p.created_at,
            p.user_name,
            p.user_email,
            p.total_amount,
            p.charity_amount,
            p.raffle_amount,
            p.dining_amount,
            p.recorded_by_email ?? "",
            p.status,
          ])
      );
    }
    if (kind === "charity") {
      downloadCsv(
        "charity-totals.csv",
        ["Date", "Name", "Email", "Amount", "Source", "Gift Aid", "Status"],
        scopedDonations.map((d) => [
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
        scopedPayments
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
    if (kind === "settlement") {
      // LodgePay (Mooov card) expected settlement, grouped by day. Net = gross
      // collected minus refunds for card payments only. Reconcile each day's
      // net against the matching Mooov payout / bank credit. Cash and
      // cheque/BACS are excluded (they don't settle via LodgePay).
      const byDay = new Map<
        string,
        { gross: number; refund: number; count: number }
      >();
      for (const p of scopedPayments) {
        if (methodGroup(p.payment_method) !== "card") continue;
        if (!isCollected(p.status) && p.status !== "partially_refunded")
          continue;
        const day = p.created_at.slice(0, 10);
        const row = byDay.get(day) ?? { gross: 0, refund: 0, count: 0 };
        row.gross += p.total_amount;
        row.refund += p.refund_amount ?? 0;
        row.count += 1;
        byDay.set(day, row);
      }
      const rows = Array.from(byDay.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([day, v]) => [
          day,
          v.count,
          v.gross.toFixed(2),
          v.refund.toFixed(2),
          (v.gross - v.refund).toFixed(2),
        ]);
      downloadCsv(
        "lodgepay-settlement.csv",
        ["Date", "Card payments", "Gross", "Refunds", "Net expected to settle"],
        rows,
      );
    }
    if (kind === "reconciliation") {
      downloadCsv(
        "payment-reconciliation.csv",
        ["Date", "Name", "Email", "Method", "Gross", "Dining", "Charity", "Raffle", "Meeting fee", "Guest ticket", "Refund", "Status", "Mooov reference"],
        scopedPayments.map((p) => [
          p.created_at,
          p.user_name,
          p.user_email,
          methodMeta(p.payment_method).label,
          p.total_amount,
          p.dining_amount,
          p.charity_amount,
          p.raffle_amount,
          p.meeting_fee_amount,
          p.guest_ticket_amount,
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
        <div className="flex flex-col items-start gap-1 sm:items-end">
          <Select
            value={dateScope}
            onValueChange={(v) => setDateScope(v as DateScope)}
          >
            <SelectTrigger variant="dashboard" className="h-10 w-full sm:w-[180px]">
              <CalendarDays className="h-4 w-4 text-dash-muted" aria-hidden />
              <SelectValue placeholder="Period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All time</SelectItem>
              <SelectItem value="today">Today (this meeting)</SelectItem>
              <SelectItem value="yesterday">Yesterday</SelectItem>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="month">This month</SelectItem>
            </SelectContent>
          </Select>
          {dateScope !== "all" && (
            <p className="text-xs text-dash-muted">
              Showing {DATE_SCOPE_LABEL[dateScope].toLowerCase()} — every figure,
              ratio, and export below is scoped to this period.
            </p>
          )}
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
        <div className="flex flex-col gap-1">
          <h2 className="text-base font-semibold text-dash-text">Revenue by type</h2>
          <p className="text-sm text-dash-muted">
            Completed income split across dining, charity, raffle, dues, and other.
          </p>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          {breakdownCategories.map((cat) => {
            const Icon = cat.icon;
            const ac = kpiAccentIcon[cat.accent];
            const pct =
              breakdownTotal > 0 ? Math.round((cat.value / breakdownTotal) * 100) : 0;
            const clickable = Boolean(cat.categoryKey);
            const isActive =
              cat.categoryKey != null && categoryFilter === cat.categoryKey;
            const Wrapper = clickable ? "button" : "div";
            return (
              <Wrapper
                key={cat.label}
                {...(clickable
                  ? {
                      type: "button" as const,
                      onClick: () => focusCategory(cat.categoryKey as CategoryKey),
                      "aria-pressed": isActive,
                    }
                  : {})}
                className={cn(
                  "rounded-xl border bg-dash-surface p-4 text-left transition-colors",
                  isActive
                    ? "border-dash-ring ring-2 ring-dash-ring/20"
                    : "border-dash-border",
                  clickable && "hover:border-dash-border-strong",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-dash-muted">
                    {cat.label}
                  </span>
                  <div
                    className={cn(
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
                      ac.wrap
                    )}
                  >
                    <Icon className={cn("h-3.5 w-3.5", ac.icon)} aria-hidden />
                  </div>
                </div>
                <p className="mt-2 text-lg font-semibold tracking-tight text-dash-text">
                  £{cat.value.toFixed(2)}
                </p>
                <p className="mt-0.5 text-xs text-dash-muted">
                  {cat.countLabel ??
                    `${cat.count} ${cat.count === 1 ? "payment" : "payments"}`}{" "}
                  · {pct}%
                  {clickable ? (
                    <span className="text-dash-ring">
                      {isActive ? " · filtering" : " · filter"}
                    </span>
                  ) : null}
                </p>
              </Wrapper>
            );
          })}
          <div className="rounded-xl border border-dash-border bg-dash-surface-subtle p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-dash-muted">
                Total
              </span>
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10">
                <Banknote className="h-3.5 w-3.5 text-emerald-600" aria-hidden />
              </div>
            </div>
            <p className="mt-2 text-lg font-semibold tracking-tight text-dash-text">
              £{breakdownTotal.toFixed(2)}
            </p>
            <p className="mt-0.5 text-xs text-dash-muted">all categories</p>
          </div>
        </div>
      </Card>

      <Card variant="panel" className="p-5">
        <div className="flex flex-col gap-1">
          <h2 className="text-base font-semibold text-dash-text">How they paid</h2>
          <p className="text-sm text-dash-muted">
            Completed income split between LodgePay digital and cash — counts and percentages for end-of-night reconciliation.
          </p>
        </div>

        {methodGrandTotal === 0 ? (
          <p className="mt-4 text-sm text-dash-muted">No completed payments yet.</p>
        ) : (
          <>
            <div className="mt-4 flex h-3 w-full overflow-hidden rounded-full bg-dash-surface-subtle">
              {methodRatio
                .filter((m) => m.amount > 0)
                .map((m) => (
                  <div
                    key={m.key}
                    className={cn("h-full", m.bar)}
                    style={{ width: `${Math.max(2, m.pct)}%` }}
                    title={`${m.label}: £${m.amount.toFixed(2)} (${m.pct}%)`}
                  />
                ))}
            </div>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {methodRatio.map((m) => {
                const Icon = m.icon;
                const ac = kpiAccentIcon[m.accent];
                const isActive = methodFilter === m.key;
                return (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => {
                      setActiveTab("payments");
                      setMethodFilter((prev) => (prev === m.key ? "all" : m.key));
                    }}
                    aria-pressed={isActive}
                    className={cn(
                      "flex items-center justify-between gap-3 rounded-xl border bg-dash-surface p-4 text-left transition-colors hover:border-dash-border-strong",
                      isActive
                        ? "border-dash-ring ring-2 ring-dash-ring/20"
                        : "border-dash-border",
                    )}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
                            ac.wrap,
                          )}
                        >
                          <Icon className={cn("h-3.5 w-3.5", ac.icon)} aria-hidden />
                        </span>
                        <span className="text-sm font-medium text-dash-text">
                          {m.label}
                        </span>
                      </div>
                      <p className="mt-2 text-xl font-semibold tracking-tight text-dash-text">
                        £{m.amount.toFixed(2)}
                      </p>
                      <p className="mt-0.5 text-xs text-dash-muted">
                        {m.count} {m.count === 1 ? "payment" : "payments"}
                        <span className="text-dash-ring">
                          {isActive ? " · filtering" : " · filter"}
                        </span>
                      </p>
                    </div>
                    <span className="text-2xl font-bold tabular-nums text-dash-text">
                      {m.pct}%
                    </span>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </Card>

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
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <label
                htmlFor="raffle-price"
                className="flex items-center gap-1 text-xs font-medium text-dash-muted"
              >
                <Ticket className="h-3.5 w-3.5" aria-hidden />
                Raffle £/strip
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-dash-faint">
                  £
                </span>
                <input
                  id="raffle-price"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step={0.5}
                  value={Number.isFinite(rafflePrice) ? rafflePrice : ""}
                  onChange={(e) => updateRafflePrice(Number(e.target.value))}
                  className="h-8 w-20 rounded-lg border border-dash-border bg-dash-surface pl-5 pr-2 text-sm tabular-nums text-dash-text outline-none focus:border-dash-border-strong"
                />
              </div>
              <span className="text-xs text-dash-faint">
                {raffleStrips} strip{raffleStrips !== 1 ? "s" : ""} sold to{" "}
                {raffleBuyers} {raffleBuyers === 1 ? "person" : "people"}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              ["raffle", "Raffle Tickets"],
              ["cash", "Cash Collected"],
              ["dues", "Dues Outstanding"],
              ["payments", "Payments Received"],
              ["dining", "Dining Income"],
              ["charity", "Charity Totals"],
              ["refunds", "Refunds"],
              ["gift-aid", "Gift Aid"],
              ["settlement", "LodgePay Settlement"],
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
                Filter by method and category, then expand any row for its full split.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3 border-b border-dash-border bg-dash-surface px-4 py-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
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
              <Select
                value={methodFilter}
                onValueChange={(v) => setMethodFilter(v as "all" | MethodGroup)}
              >
                <SelectTrigger variant="dashboard" className="h-10 w-full sm:w-[150px]">
                  <SelectValue placeholder="Method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All methods</SelectItem>
                  <SelectItem value="card">LodgePay digital</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="other">Cheque / BACS</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={categoryFilter}
                onValueChange={(v) => setCategoryFilter(v as "all" | CategoryKey)}
              >
                <SelectTrigger variant="dashboard" className="h-10 w-full sm:w-[160px]">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  {CATEGORY_KEYS.map((key) => (
                    <SelectItem key={key} value={key}>
                      {CATEGORY_LABEL[key]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger variant="dashboard" className="h-10 w-full sm:w-[140px]">
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
            <div className="flex flex-wrap items-center justify-between gap-2">
              {statusFilter === "refunded" ? (
                <p className="text-sm text-dash-muted">
                  <span className="font-semibold text-dash-text tabular-nums">
                    {matchedPayments.length}
                  </span>{" "}
                  refunded / reversed ·{" "}
                  <span className="font-semibold text-dash-text tabular-nums">
                    £
                    {matchedPayments
                      .reduce(
                        (s, p) => s + (p.refund_amount || p.total_amount || 0),
                        0,
                      )
                      .toFixed(2)}
                  </span>{" "}
                  returned · not counted as income
                </p>
              ) : (
                <p className="text-sm text-dash-muted">
                  <span className="font-semibold text-dash-text tabular-nums">
                    {matchedCollected.length}
                  </span>{" "}
                  {matchedCollected.length === 1 ? "payment" : "payments"}
                  {" · "}
                  <span className="font-semibold text-dash-text tabular-nums">
                    £{matchedTotal.toFixed(2)}
                  </span>
                  {categoryFilter !== "all"
                    ? ` ${CATEGORY_LABEL[categoryFilter].toLowerCase()}`
                    : ""}
                  {methodFilter === "cash" ? " in cash" : ""}
                  {matchedPayments.length > matchedCollected.length
                    ? ` · ${matchedPayments.length - matchedCollected.length} pending (not counted)`
                    : ""}
                </p>
              )}
              {anyFilterActive ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 text-dash-muted hover:text-dash-text"
                  onClick={() => {
                    setStatusFilter("all");
                    setMethodFilter("all");
                    setCategoryFilter("all");
                    setSearchQuery("");
                  }}
                >
                  Clear filters
                </Button>
              ) : null}
            </div>
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
                  <TableHead className={cn(DASH_TABLE.head, "hidden md:table-cell")}>Email</TableHead>
                  <TableHead className={DASH_TABLE.head}>Method</TableHead>
                  <TableHead className={cn(DASH_TABLE.head, "hidden sm:table-cell")}>Categories</TableHead>
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
                      <TableCell className={cn(DASH_TABLE.cellMuted, "hidden md:table-cell")}>{p.user_email}</TableCell>
                      <TableCell className={DASH_TABLE.cell}>
                        <MethodBadge pm={p.payment_method} />
                      </TableCell>
                      <TableCell className={cn(DASH_TABLE.cell, "hidden sm:table-cell")}>
                        <div className="flex flex-wrap gap-1">
                          {(() => {
                            const amounts = categoryAmounts(p);
                            const present = CATEGORY_KEYS.filter(
                              (k) => amounts[k] > 0,
                            );
                            if (present.length === 0)
                              return (
                                <span className="text-xs text-dash-text-faint">
                                  —
                                </span>
                              );
                            return present.map((k) => {
                              const strips =
                                k === "raffle" ? stripsFor(amounts[k]) : 0;
                              return (
                                <Badge
                                  key={k}
                                  variant="outline"
                                  className="border-dash-border text-[11px]"
                                >
                                  {CATEGORY_LABEL[k]}
                                  {k === "raffle"
                                    ? ` · ${strips} strip${strips !== 1 ? "s" : ""}`
                                    : ""}
                                  {present.length > 1
                                    ? ` £${amounts[k].toFixed(2)}`
                                    : ""}
                                </Badge>
                              );
                            });
                          })()}
                        </div>
                      </TableCell>
                      <TableCell className={cn(DASH_TABLE.cell, "text-right font-medium tabular-nums")}>
                        £{Number(p.total_amount).toFixed(2)}
                      </TableCell>
                      <TableCell className={DASH_TABLE.cell}>{paymentStatusBadge(p.status)}</TableCell>
                    </TableRow>
                    {expandedRow === p.id && (
                      <TableRow className={DASH_TABLE.row}>
                        <TableCell colSpan={8} className="!p-0">
                          <div className="border-t border-dash-border bg-dash-surface-subtle/80 px-6 py-4">
                            {(() => {
                              const meetingFee = Number(p.meeting_fee_amount ?? 0);
                              const guestTicket = Number(p.guest_ticket_amount ?? 0);
                              const dining = Number(p.dining_amount ?? 0);
                              const charity = Number(p.charity_amount ?? 0);
                              const raffle = Number(p.raffle_amount ?? 0);
                              // Anything not tagged to a specific bucket is
                              // general/uncategorised income. total_amount is net
                              // of refunds, the buckets are gross, so clamp at 0.
                              const general = Math.max(
                                0,
                                Number(p.total_amount ?? 0) -
                                  meetingFee -
                                  guestTicket -
                                  dining -
                                  charity -
                                  raffle,
                              );
                              const buckets: Array<{
                                key: string;
                                label: string;
                                icon: ReactNode;
                                amount: number;
                                note?: string | null;
                              }> = [
                                {
                                  key: "meeting_fee",
                                  label: "Meeting fee",
                                  icon: <Coins className="h-3.5 w-3.5" />,
                                  amount: meetingFee,
                                },
                                {
                                  key: "guest_ticket",
                                  label: "Guest ticket",
                                  icon: <Ticket className="h-3.5 w-3.5" />,
                                  amount: guestTicket,
                                },
                                {
                                  key: "dining",
                                  label: "Dining",
                                  icon: <UtensilsCrossed className="h-3.5 w-3.5" />,
                                  amount: dining,
                                },
                                {
                                  key: "charity",
                                  label: "Charity",
                                  icon: <Heart className="h-3.5 w-3.5" />,
                                  amount: charity,
                                  note: p.charity_name,
                                },
                                {
                                  key: "raffle",
                                  label: "Raffle",
                                  icon: <Gift className="h-3.5 w-3.5" />,
                                  amount: raffle,
                                  note:
                                    raffle > 0
                                      ? `${stripsFor(raffle)} strip${stripsFor(raffle) !== 1 ? "s" : ""}`
                                      : null,
                                },
                                {
                                  key: "general",
                                  label: "General / Other",
                                  icon: <CreditCard className="h-3.5 w-3.5" />,
                                  amount: general,
                                },
                              ];
                              const categoryLabel = p.category
                                ? buckets.find((b) => b.key === p.category)?.label ??
                                  p.category
                                    .replace(/_/g, " ")
                                    .replace(/^\w/, (c) => c.toUpperCase())
                                : null;
                              return (
                                <>
                                  {categoryLabel && (
                                    <p className="mb-3 text-xs text-dash-text-muted">
                                      Recorded under{" "}
                                      <span className="font-medium text-dash-text">
                                        {categoryLabel}
                                      </span>
                                    </p>
                                  )}
                                  <div className="grid gap-4 sm:grid-cols-3">
                                    {buckets.map((b) => (
                                      <div
                                        key={b.key}
                                        className="rounded-xl border border-dash-border bg-dash-surface p-4"
                                      >
                                        <div className="mb-2 flex items-center gap-2 text-xs text-dash-text-muted">
                                          {b.icon} {b.label}
                                        </div>
                                        <p className="text-lg font-semibold text-dash-text">
                                          £{b.amount.toFixed(2)}
                                        </p>
                                        {b.note && (
                                          <p className="mt-1 text-xs text-dash-text-muted">
                                            {b.note}
                                          </p>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </>
                              );
                            })()}
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
          {matchedPayments.length > ROW_CAP ? (
            <div className="border-t border-dash-border bg-dash-surface px-4 py-3 text-center text-xs text-dash-muted">
              Showing the first {ROW_CAP} of {matchedPayments.length} matching
              payments. Narrow with filters, or use the exports above for the
              full list.
            </div>
          ) : null}
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
              {scopedDonations.length} donation{scopedDonations.length !== 1 ? "s" : ""} recorded
            </p>
          </div>
          {scopedDonations.length === 0 ? (
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
                {scopedDonations.slice(0, 20).map((d) => (
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
