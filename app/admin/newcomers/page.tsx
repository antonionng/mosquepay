import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import * as db from "@/lib/db";
import * as mockDb from "@/lib/mock-db";
import { getAdminReadContext } from "@/lib/admin/read-context";
import { cn } from "@/lib/utils";
import {
  Users,
  TrendingUp,
  Sparkles,
  Target,
  LayoutGrid,
  Plus,
} from "lucide-react";
import { NewcomersListClient } from "@/components/crm/newcomers-list-client";
import { getNewcomerPrompt } from "@/lib/newcomers/next-action";

const PIPELINE_STAGES = [
  "expression_of_interest",
  "initial_contact",
  "service_scheduled",
  "proposal_mosque",
  "approved",
  "welcomed",
  "declined",
  "on_hold",
] as const;

const STAGE_LABELS: Record<string, string> = {
  expression_of_interest: "Expression of Interest",
  initial_contact: "Initial Contact",
  service_scheduled: "Service Scheduled",
  proposal_mosque: "Proposal to Mosque",
  approved: "Approved",
  welcomed: "Initiated",
  declined: "Declined",
  on_hold: "On Hold",
};

type KpiAccent = "blue" | "cyan" | "amber" | "emerald";

const kpiAccentIcon: Record<
  KpiAccent,
  { wrap: string; icon: string }
> = {
  blue: { wrap: "bg-blue-500/10", icon: "text-blue-600" },
  cyan: { wrap: "bg-cyan-500/10", icon: "text-cyan-600" },
  amber: { wrap: "bg-amber-500/10", icon: "text-amber-700" },
  emerald: { wrap: "bg-emerald-500/10", icon: "text-emerald-600" },
};
const NOW_TS = Date.now();

export default async function AdminNewcomersPage() {
  const ctx = await getAdminReadContext();
  const useMock = ctx.mode === "mock";
  const mosqueId = ctx.mode === "database" ? ctx.mosqueId : null;
  const allNewcomers = useMock
    ? mockDb.getNewcomers()
    : mosqueId
      ? await db.getNewcomers(mosqueId)
      : [];

  const newcomers = await Promise.all(allNewcomers.map(async (l) => {
    const activities = useMock
      ? mockDb.getNewcomerActivities(l.id)
      : mosqueId
        ? await db.getNewcomerActivities(l.id, mosqueId)
        : [];
    const lastActivity = activities[0] ?? null;
    const daysInStage = Math.floor((NOW_TS - new Date(l.stage_changed_at).getTime()) / 86400000);
    const daysSinceActivity = lastActivity
      ? Math.floor(
          (NOW_TS - new Date(lastActivity.created_at).getTime()) / 86400000
        )
      : Math.floor(
          (NOW_TS - new Date(l.created_at).getTime()) / 86400000
        );

    const prompt = getNewcomerPrompt({
      stage: l.stage,
      daysSinceActivity,
      daysInStage,
      hasActivity: Boolean(lastActivity),
      next_step: l.next_step ?? null,
      next_step_due_date: l.next_step_due_date ?? null,
      converted_at: l.converted_at ?? null,
    });

    return {
      id: l.id,
      first_name: l.first_name,
      last_name: l.last_name,
      email: l.email,
      phone: l.phone,
      stage: l.stage,
      source: l.source,
      created_at: l.created_at,
      updated_at: l.updated_at,
      stage_changed_at: l.stage_changed_at,
      converted_at: l.converted_at ?? null,
      daysInStage,
      daysSinceActivity,
      lastActivityType: lastActivity?.activity_type ?? null,
      lastActivityTitle: lastActivity?.title ?? null,
      lastActivityDate: lastActivity?.created_at ?? null,
      promptLabel: prompt.label,
      promptReason: prompt.reason,
      promptSeverity: prompt.severity,
    };
  }));

  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 86400000);
  const newThisWeek = newcomers.filter(
    (l) => new Date(l.created_at) >= oneWeekAgo
  ).length;
  const activePipeline = newcomers.filter(
    (l) =>
      !["welcomed", "declined"].includes(l.stage)
  ).length;
  const welcomed = newcomers.filter((l) => l.stage === "welcomed").length;
  const conversionRate =
    newcomers.length > 0 ? Math.round((welcomed / newcomers.length) * 100) : 0;

  const stats: Array<{
    label: string;
    value: string;
    hint: string;
    icon: typeof Users;
    accent: KpiAccent;
  }> = [
    {
      label: "Total newcomers",
      value: newcomers.length.toString(),
      hint: "All newcomers in CRM",
      icon: Users,
      accent: "blue",
    },
    {
      label: "New this week",
      value: newThisWeek.toString(),
      hint: "Created in the last 7 days",
      icon: Sparkles,
      accent: "cyan",
    },
    {
      label: "Active pipeline",
      value: activePipeline.toString(),
      hint: "Excluding welcomed & declined",
      icon: TrendingUp,
      accent: "amber",
    },
    {
      label: "Conversion rate",
      value: `${conversionRate}%`,
      hint: "Joined ÷ total newcomers",
      icon: Target,
      accent: "emerald",
    },
  ];

  return (
    <div className="space-y-5 sm:space-y-8">
      <div className="admin-page-head">
        <div>
          <h1 className="admin-page-title">Newcomer Pipeline</h1>
          <p className="admin-page-copy">
            Track recruitment from first enquiry to membership.
          </p>
        </div>
        <div className="admin-action-row">
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/newcomers/kanban" className="flex items-center gap-2">
              <LayoutGrid className="h-4 w-4" />
              Kanban Board
            </Link>
          </Button>
          <Button asChild variant="dashboard" size="sm">
            <Link href="/admin/newcomers/new" className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              New newcomer
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          const ac = kpiAccentIcon[stat.accent];
          return (
            <div key={stat.label} className="min-w-0">
              <Card
                variant="kpi"
                className="dash-kpi-card h-full rounded-xl p-5 hover:border-dash-border-strong"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium uppercase tracking-[0.12em] text-dash-muted [.dash-kpi-card_&]:text-dash-muted">
                      {stat.label}
                    </p>
                    <p className="mt-2 text-3xl font-semibold tracking-tight text-dash-text [.dash-kpi-card_&]:text-dash-text">
                      {stat.value}
                    </p>
                    <div className="mt-2 flex items-center gap-1.5 text-xs text-dash-muted">
                      <TrendingUp
                        className="h-3.5 w-3.5 shrink-0 text-emerald-600"
                        aria-hidden
                      />
                      <span className="line-clamp-2">{stat.hint}</span>
                    </div>
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
            </div>
          );
        })}
      </div>

      <NewcomersListClient
        newcomers={newcomers}
        stageLabels={STAGE_LABELS}
        stages={[...PIPELINE_STAGES]}
      />
    </div>
  );
}
