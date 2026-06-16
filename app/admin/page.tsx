import Link from "next/link";
import * as db from "@/lib/db";
import * as mockDb from "@/lib/mock-db";
import { getAdminReadContext } from "@/lib/admin/read-context";
import {
  Users,
  UserCheck,
  CheckCircle2,
  XCircle,
  Calendar,
  CreditCard,
  FileText,
  TrendingUp,
  ArrowRight,
  Trophy,
  BarChart3,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const dynamic = "force-dynamic";

const CLOSED_STAGES = new Set(["welcomed", "declined"]);

type KpiAccent = "brand" | "brandLight" | "emerald" | "amber";

const kpiAccentIcon: Record<
  KpiAccent,
  { wrap: string; icon: string }
> = {
  brand: { wrap: "bg-[hsl(var(--dash-ring)/0.10)]", icon: "text-[hsl(var(--dash-ring))]" },
  brandLight: { wrap: "bg-[hsl(var(--dash-ring-soft)/0.12)]", icon: "text-[hsl(var(--dash-ring-soft))]" },
  emerald: { wrap: "bg-emerald-500/10", icon: "text-emerald-600" },
  amber: { wrap: "bg-amber-500/10", icon: "text-amber-700" },
};

export default async function AdminDashboardPage() {
  const ctx = await getAdminReadContext();
  const useMock = ctx.mode === "mock";
  const mosqueId = ctx.mode === "database" ? ctx.mosqueId : null;

  const newcomers = useMock
    ? mockDb.getNewcomers()
    : mosqueId
      ? await db.getNewcomers(mosqueId)
      : [];
  const allEvents = useMock
    ? mockDb.getEvents({ published: true })
    : mosqueId
      ? await db.getEvents(mosqueId, { published: true })
      : [];
  const upcomingEvents = useMock
    ? mockDb.getEvents({ published: true, upcoming: true })
    : mosqueId
      ? await db.getEvents(mosqueId, { published: true, upcoming: true })
      : [];
  const payments = useMock
    ? mockDb.getPayments()
    : mosqueId
      ? await db.getPayments(mosqueId)
      : [];
  const succeededPayments = payments.filter((p) => p.status === "succeeded");
  const blogPosts = useMock
    ? mockDb.getBlogPosts()
    : mosqueId
      ? await db.getBlogPosts(mosqueId)
      : [];
  const publishedPosts = blogPosts.filter((p) => p.published);
  const campaigns = useMock
    ? mockDb.getCharityCampaigns()
    : mosqueId
      ? await db.getCharityCampaigns(mosqueId)
      : [];
  const activeCampaigns = campaigns.filter((c) => c.status === "active");

  const rsvpData: Record<string, Array<{ payment_completed: boolean; status: string }>> = {};
  for (const event of upcomingEvents) {
    const rsvps = useMock
      ? mockDb.getRsvpsByEventId(event.id)
      : mosqueId
        ? await db.getRsvpsByEventId(event.id, mosqueId)
        : [];
    rsvpData[event.id] = rsvps.map((r) => ({
      payment_completed: r.payment_completed,
      status: r.status,
    }));
  }

  const now = new Date();
  const unpaidRsvps = Object.entries(rsvpData).reduce((count, [, rsvps]) => {
    return count + rsvps.filter((r) => !r.payment_completed && r.status === "confirmed").length;
  }, 0);

  const expiredDeadlines = upcomingEvents.filter((e) => {
    const dl = e.rsvp_deadline as string | null;
    return dl && new Date(dl) < now;
  }).length;

  const newEnquiries = newcomers.filter(
    (l) => l.stage === "expression_of_interest" || l.stage === "new_enquiry"
  ).length;
  const assignedNewcomers = newcomers.filter((l) => Boolean(l.assigned_to)).length;
  const closedOutcomes = newcomers.filter((l) => CLOSED_STAGES.has(l.stage)).length;
  const welcomedCount = newcomers.filter((l) => l.stage === "welcomed").length;
  const declinedCount = newcomers.filter((l) => l.stage === "declined").length;

  const totalRevenue = succeededPayments.reduce((s, p) => s + p.total_amount, 0);
  const chartYear = now.getFullYear();
  const monthlyRevenue = Array.from({ length: 12 }, (_, i) => {
    const sum = succeededPayments.reduce((acc, p) => {
      const d = new Date(p.created_at);
      if (d.getFullYear() === chartYear && d.getMonth() === i) return acc + p.total_amount;
      return acc;
    }, 0);
    return {
      i,
      label: new Date(chartYear, i, 1).toLocaleDateString("en-GB", { month: "short" }),
      sum,
    };
  });
  const maxMonthly = Math.max(...monthlyRevenue.map((m) => m.sum), 1);

  type AssigneeStats = { total: number; pipeline: number; closed: number };
  const byAssignee = new Map<string, AssigneeStats>();
  for (const l of newcomers) {
    const key = l.assigned_to?.trim() || "Unassigned";
    const cur = byAssignee.get(key) ?? { total: 0, pipeline: 0, closed: 0 };
    cur.total += 1;
    if (CLOSED_STAGES.has(l.stage)) cur.closed += 1;
    else cur.pipeline += 1;
    byAssignee.set(key, cur);
  }
  const teamRows = [...byAssignee.entries()]
    .map(([name, s]) => ({ name, ...s }))
    .sort((a, b) => b.total - a.total);

  const newcomererboard = teamRows.slice(0, 6);

  const pendingActions = [
    ...(unpaidRsvps > 0
      ? [{ label: `${unpaidRsvps} unpaid RSVPs`, href: "/admin/payments" as const }]
      : []),
    ...(expiredDeadlines > 0
      ? [{ label: `${expiredDeadlines} expired RSVP deadline${expiredDeadlines > 1 ? "s" : ""}`, href: "/admin/events" as const }]
      : []),
    ...(newcomers.filter((l) => l.stage === "expression_of_interest").length > 0
      ? [
          {
            label: `${newcomers.filter((l) => l.stage === "expression_of_interest").length} new enquiries to follow up`,
            href: "/admin/newcomers" as const,
          },
        ]
      : []),
  ];

  const kpis: Array<{
    label: string;
    value: string;
    hint: string;
    href: string;
    icon: typeof Users;
    accent: KpiAccent;
  }> = [
    {
      label: "Total newcomers",
      value: String(newcomers.length),
      hint: `${newEnquiries} new / open enquiries`,
      href: "/admin/newcomers",
      icon: Users,
      accent: "brand",
    },
    {
      label: "Assigned newcomers",
      value: String(assignedNewcomers),
      hint: `${Math.max(0, newcomers.length - assignedNewcomers)} unassigned`,
      href: "/admin/newcomers",
      icon: UserCheck,
      accent: "brandLight",
    },
    {
      label: "Closed outcomes",
      value: String(closedOutcomes),
      hint: `${welcomedCount} welcomed · ${declinedCount} declined`,
      href: "/admin/newcomers",
      icon: CheckCircle2,
      accent: "emerald",
    },
    {
      label: "Channels & activity",
      value: String(upcomingEvents.length),
      hint: `${allEvents.length} published events · ${succeededPayments.length} payments · ${publishedPosts.length} posts`,
      href: "/admin/events",
      icon: Calendar,
      accent: "amber",
    },
  ];

  return (
    <div className="space-y-5 sm:space-y-8">
      <div className="admin-page-head">
        <div>
          <h1 className="admin-page-title">Dashboard</h1>
          <p className="admin-page-copy">
            Mosque pipeline, events, and payments in one place. Same data as your CRM and checkout.
          </p>
        </div>
      </div>

      {pendingActions.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" aria-hidden />
          <span className="text-sm font-medium text-amber-950">Attention needed:</span>
          {pendingActions.map((a) => (
            <Badge key={a.label} variant="warning" asChild>
              <Link href={a.href} className="cursor-pointer">
                {a.label}
              </Link>
            </Badge>
          ))}
        </div>
      )}

      {/* KPI row: 2x2 on phone (compact, all visible without scroll),
          4-up on xl. */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {kpis.map((k) => {
          const Icon = k.icon;
          const ac = kpiAccentIcon[k.accent];
          return (
            <Link key={k.label} href={k.href} className="block min-w-0">
              <Card variant="kpi" className="dash-kpi-card h-full rounded-xl p-3 hover:border-dash-border-strong sm:p-5">
                <div className="flex items-start justify-between gap-2 sm:gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-dash-muted sm:text-xs [.dash-kpi-card_&]:text-dash-muted">
                      {k.label}
                    </p>
                    <p className="mt-1 text-xl font-semibold tracking-tight text-dash-text sm:mt-2 sm:text-3xl [.dash-kpi-card_&]:text-dash-text">
                      {k.value}
                    </p>
                    <div className="mt-1 hidden items-center gap-1.5 text-xs text-dash-muted sm:mt-2 sm:flex">
                      <TrendingUp className="h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden />
                      <span className="line-clamp-2">{k.hint}</span>
                    </div>
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
            </Link>
          );
        })}
      </div>

      {/* Activity strip: domain context */}
      <div className="dash-filter-bar flex flex-wrap items-center gap-2 py-3">
        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-dash-muted">Signals</span>
        <Badge variant="secondary">
          {activeCampaigns.length} active campaigns
        </Badge>
        <Badge variant="secondary">
          £{totalRevenue.toLocaleString("en-GB", { minimumFractionDigits: 2 })} revenue (succeeded)
        </Badge>
        <Badge variant="secondary">
          {succeededPayments.length} successful payments
        </Badge>
        <Link
          href="/admin/payments"
          className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700"
        >
          Open payments <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {/* Main chart + newcomererboard */}
      <div className="grid gap-4 sm:gap-6 xl:grid-cols-3">
        <Card variant="panel" className="xl:col-span-2 overflow-hidden p-0">
          <div className="dash-panel-header rounded-none border-dash-border bg-dash-surface-subtle">
            <div>
              <h2 className="dash-panel-header-title">Payment volume</h2>
              <p className="dash-panel-header-description">
                Succeeded payment totals by month ({chartYear}), from your ledger.
              </p>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-semibold tabular-nums text-emerald-700">
                £{totalRevenue.toLocaleString("en-GB", { minimumFractionDigits: 2 })}
              </span>
              <span className="text-xs text-dash-muted">YTD succeeded</span>
            </div>
          </div>
          <CardContent className="p-5 pt-6">
            <div className="flex h-44 items-end gap-1 sm:gap-1.5" role="img" aria-label="Monthly succeeded payment totals">
              {monthlyRevenue.map((m) => {
                const hPct = Math.round((m.sum / maxMonthly) * 100);
                const hPx = Math.max(8, Math.round((m.sum / maxMonthly) * 140));
                return (
                  <div key={m.i} className="flex min-w-0 flex-1 flex-col items-center gap-2">
                    <div
                      className="w-full max-w-[2.5rem] rounded-t-md bg-gradient-to-t from-blue-600/90 to-blue-400/50 transition-all hover:from-blue-600 hover:to-blue-400/70"
                      style={{ height: `${hPx}px` }}
                      title={`${m.label}: £${m.sum.toFixed(2)}`}
                    />
                    <span className="text-[10px] font-medium text-slate-500 sm:text-xs">{m.label}</span>
                    <span className="sr-only">{`${m.label}: ${hPct}% of peak month`}</span>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
              <BarChart3 className="h-3.5 w-3.5" aria-hidden />
              Peak month £{Math.max(...monthlyRevenue.map((x) => x.sum)).toLocaleString("en-GB", { minimumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>

        <Card variant="panel" className="overflow-hidden p-0">
          <div className="dash-panel-header rounded-none border-dash-border bg-dash-surface-subtle">
            <div>
              <h2 className="dash-panel-header-title">Assignee newcomererboard</h2>
              <p className="dash-panel-header-description">Newcomers by owner. Pipeline vs closed.</p>
            </div>
            <Link
              href="/admin/newcomers"
              className="text-xs font-medium text-dash-ring hover:underline"
            >
              CRM
            </Link>
          </div>
          <CardContent className="space-y-1 p-3">
            {newcomererboard.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-dash-muted">No assignee data yet.</p>
            ) : (
              newcomererboard.map((row, idx) => (
                <div
                  key={row.name}
                  className={cn(
                    "dash-ranking-item",
                    idx === 0 && "dash-ranking-item-active"
                  )}
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-dash-surface-subtle text-sm font-semibold text-dash-text">
                    {idx < 3 ? <Trophy className="h-4 w-4 text-amber-600" /> : idx + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-dash-text">{row.name}</p>
                    <p className="text-xs text-dash-muted">
                      {row.pipeline} in pipeline · {row.closed} closed
                    </p>
                  </div>
                  <Badge variant="outline" className="shrink-0 tabular-nums">
                    {row.total}
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Team / performance table */}
      <Card variant="panel" className="overflow-hidden p-0">
        <div className="dash-panel-header rounded-none border-dash-border bg-dash-surface-subtle">
          <div>
            <h2 className="dash-panel-header-title">Team performance</h2>
            <p className="dash-panel-header-description">
              Coverage across assignees; closed includes welcomed and declined outcomes.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{newcomers.length} total newcomers</Badge>
            <Badge variant="outline" className="border-dash-border bg-dash-surface">
              <CheckCircle2 className="mr-1 h-3 w-3 text-emerald-600" />
              {welcomedCount} welcomed
            </Badge>
            <Badge variant="outline" className="border-dash-border bg-dash-surface">
              <XCircle className="mr-1 h-3 w-3 text-red-600" />
              {declinedCount} declined
            </Badge>
          </div>
        </div>
        <div className="border-t border-dash-border bg-dash-surface p-0">
          {teamRows.length === 0 ? (
            <p className="p-8 text-center text-sm text-slate-500">No newcomers to show.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Assignee</TableHead>
                  <TableHead className="text-right">Total newcomers</TableHead>
                  <TableHead className="text-right">In pipeline</TableHead>
                  <TableHead className="text-right">Closed</TableHead>
                  <TableHead className="w-[100px] text-right">Share</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {teamRows.map((row) => {
                  const share = newcomers.length > 0 ? Math.round((row.total / newcomers.length) * 100) : 0;
                  return (
                    <TableRow key={row.name}>
                      <TableCell className="font-medium">{row.name}</TableCell>
                      <TableCell className="text-right tabular-nums">{row.total}</TableCell>
                      <TableCell className="text-right tabular-nums text-slate-600">{row.pipeline}</TableCell>
                      <TableCell className="text-right tabular-nums text-slate-600">{row.closed}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant="muted" className="tabular-nums">
                          {share}%
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
        <div className="flex flex-wrap gap-3 border-t border-dash-border bg-dash-surface-subtle px-5 py-4">
          <Link
            href="/admin/events"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-dash-ring hover:underline"
          >
            <Calendar className="h-3.5 w-3.5" />
            Events
          </Link>
          <Link
            href="/admin/blog"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-dash-ring hover:underline"
          >
            <FileText className="h-3.5 w-3.5" />
            Blog
          </Link>
          <Link
            href="/admin/payments"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-dash-ring hover:underline"
          >
            <CreditCard className="h-3.5 w-3.5" />
            Payments
          </Link>
          <Link
            href="/admin/newcomers/kanban"
            className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-dash-muted hover:text-dash-text"
          >
            Pipeline board <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </Card>
    </div>
  );
}
