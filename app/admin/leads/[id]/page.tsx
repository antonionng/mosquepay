import { notFound } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import * as db from "@/lib/db";
import * as mockDb from "@/lib/mock-db";
import { getAdminReadContext } from "@/lib/admin/read-context";
import { LeadActivityForm } from "@/components/forms/lead-activity-form";
import { ActivityTimeline } from "@/components/timeline";
import { LeadDetailActions } from "@/components/crm/lead-detail-actions";
import {
  ArrowLeft,
  Mail,
  Phone,
  MapPin,
  Globe,
  MessageSquare,
  AlertTriangle,
  Clock,
  CheckCircle2,
} from "lucide-react";

const PIPELINE_STAGES = [
  "expression_of_interest",
  "initial_contact",
  "meeting_scheduled",
  "proposal_lodge",
  "approved",
  "initiated",
] as const;

const TERMINAL_STAGES = ["declined", "on_hold"] as const;

const STAGE_LABELS: Record<string, string> = {
  expression_of_interest: "Expression of Interest",
  initial_contact: "Initial Contact",
  meeting_scheduled: "Meeting Scheduled",
  proposal_lodge: "Proposal to Lodge",
  approved: "Approved",
  initiated: "Initiated",
  declined: "Declined",
  on_hold: "On Hold",
};

const STAGE_BADGE_LIGHT: Record<string, string> = {
  expression_of_interest: "border-blue-200 bg-blue-50 text-blue-900",
  initial_contact: "border-cyan-200 bg-cyan-50 text-cyan-900",
  meeting_scheduled: "border-amber-200 bg-amber-50 text-amber-900",
  proposal_lodge: "border-violet-200 bg-violet-50 text-violet-900",
  approved: "border-emerald-200 bg-emerald-50 text-emerald-900",
  initiated: "border-green-200 bg-green-50 text-green-900",
  declined: "border-red-200 bg-red-50 text-red-900",
  on_hold: "border-slate-200 bg-slate-100 text-slate-800",
};

const STAGE_DOT_COLORS: Record<string, string> = {
  expression_of_interest: "bg-blue-500",
  initial_contact: "bg-cyan-500",
  meeting_scheduled: "bg-amber-500",
  proposal_lodge: "bg-violet-500",
  approved: "bg-emerald-500",
  initiated: "bg-green-500",
  declined: "bg-red-500",
  on_hold: "bg-slate-400",
};
const NOW_TS = Date.now();

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await getAdminReadContext();
  const useMock = ctx.mode === "mock";
  const lodgeId = ctx.mode === "database" ? ctx.lodgeId : null;
  const lead = useMock
    ? mockDb.getLeadById(id)
    : lodgeId
      ? await db.getLeadById(id, lodgeId)
      : null;
  const activities = lead
    ? useMock
      ? mockDb.getLeadActivities(id)
      : lodgeId
        ? await db.getLeadActivities(id, lodgeId)
        : []
    : [];

  if (!lead) notFound();

  const lastActivity = activities[0] ?? null;
  const daysSinceActivity = lastActivity
    ? Math.floor(
        (NOW_TS - new Date(lastActivity.created_at).getTime()) / 86400000
      )
    : Math.floor(
        (NOW_TS - new Date(lead.created_at).getTime()) / 86400000
      );
  const daysInStage = Math.floor(
    (NOW_TS - new Date(lead.stage_changed_at).getTime()) / 86400000
  );
  const isStale = daysSinceActivity >= 14;
  const isWarning = daysSinceActivity >= 7 && !isStale;

  const isTerminal = (TERMINAL_STAGES as readonly string[]).includes(lead.stage);
  const currentStageIndex = PIPELINE_STAGES.indexOf(
    lead.stage as (typeof PIPELINE_STAGES)[number]
  );

  const timelineItems = activities.map((a) => ({
    id: a.id,
    type: a.activity_type as
      | "note"
      | "meeting"
      | "phone_call"
      | "email"
      | "task",
    title: a.title ?? a.activity_type.replace(/_/g, " "),
    description: a.description ?? undefined,
    date: a.created_at,
    meetingDate: a.meeting_date ?? undefined,
    dueDate: a.due_date ?? undefined,
    completed: a.completed,
    createdBy: a.created_by ?? undefined,
    attendees: a.attendees ?? undefined,
  }));

  return (
    <div className="space-y-8">
      <div>
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="text-dash-muted hover:text-dash-text"
        >
          <Link href="/admin/leads" className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to pipeline
          </Link>
        </Button>
      </div>

      <Card variant="panel" className="overflow-hidden p-0">
        <CardContent className="space-y-6 p-6 md:p-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500/15 to-violet-500/15 text-lg font-semibold text-blue-800">
                {lead.first_name[0]}
                {lead.last_name[0]}
              </div>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-dash-text">
                  {lead.first_name} {lead.last_name}
                </h1>
                <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-dash-muted">
                  <span className="flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5" />
                    {lead.email}
                  </span>
                  {lead.phone && (
                    <span className="flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5" />
                      {lead.phone}
                    </span>
                  )}
                  {lead.location && (
                    <span className="flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5" />
                      {lead.location}
                    </span>
                  )}
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Badge
                    variant="outline"
                    className={
                      STAGE_BADGE_LIGHT[lead.stage] ??
                      "border-slate-200 bg-slate-50 text-slate-800"
                    }
                  >
                    {STAGE_LABELS[lead.stage] ?? lead.stage}
                  </Badge>
                  {lead.source && (
                    <Badge
                      variant="outline"
                      className="border-dash-border bg-dash-surface-subtle font-normal text-dash-muted"
                    >
                      <Globe className="mr-1 h-3 w-3" />
                      {lead.source}
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-3 text-xs">
              <div className="flex items-center gap-2 rounded-lg border border-dash-border bg-dash-surface-subtle px-3 py-2">
                <Clock className="h-3.5 w-3.5 text-dash-faint" />
                <span className="text-dash-muted">In stage: </span>
                <span className="font-semibold tabular-nums text-dash-text">
                  {daysInStage}d
                </span>
              </div>
              {isStale && (
                <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-red-600" />
                  <span className="font-medium text-red-800">
                    Stale — {daysSinceActivity}d since activity
                  </span>
                </div>
              )}
              {isWarning && (
                <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                  <span className="font-medium text-amber-900">
                    Cooling — {daysSinceActivity}d since activity
                  </span>
                </div>
              )}
              {!isStale && !isWarning && (
                <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  <span className="font-medium text-emerald-900">Active</span>
                </div>
              )}
            </div>
          </div>

          {!isTerminal && (
            <div>
              <div className="flex items-center gap-1">
                {PIPELINE_STAGES.map((stage, i) => {
                  const isComplete = currentStageIndex >= 0 && i <= currentStageIndex;
                  const isCurrent = i === currentStageIndex;
                  return (
                    <div key={stage} className="flex flex-1 flex-col items-center gap-2">
                      <div className="flex w-full items-center">
                        <div
                          className={`h-1 flex-1 rounded-full transition-colors ${
                            isComplete
                              ? STAGE_DOT_COLORS[stage] ?? "bg-blue-500"
                              : "bg-slate-200"
                          }`}
                        />
                      </div>
                      <span
                        className={`text-center text-[10px] leading-tight ${
                          isCurrent
                            ? "font-semibold text-dash-text"
                            : isComplete
                            ? "text-dash-muted"
                            : "text-dash-faint"
                        }`}
                      >
                        {STAGE_LABELS[stage]}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {isTerminal && (
            <div
              className={`rounded-xl border px-4 py-3 text-sm ${
                lead.stage === "declined"
                  ? "border-red-200 bg-red-50 text-red-900"
                  : "border-slate-200 bg-slate-100 text-slate-800"
              }`}
            >
              This candidate is{" "}
              <strong>{STAGE_LABELS[lead.stage]?.toLowerCase()}</strong>.
              {lead.stage === "on_hold" &&
                " They may re-enter the pipeline when ready."}
            </div>
          )}

          {lead.initial_message && (
            <div className="rounded-xl border border-dash-border bg-dash-surface-subtle p-4">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-dash-muted">
                <MessageSquare className="h-3.5 w-3.5" />
                Initial message
              </div>
              <p className="mt-2 text-sm leading-relaxed text-dash-text">
                {lead.initial_message}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="space-y-8 lg:col-span-2">
          <Card variant="panel" className="overflow-hidden p-0">
            <div className="dash-panel-header rounded-none border-dash-border bg-dash-surface-subtle">
              <div>
                <h2 className="dash-panel-header-title">Activity timeline</h2>
                <p className="dash-panel-header-description">
                  Notes, meetings, and tasks newest first.
                </p>
              </div>
            </div>
            <CardContent className="border-t border-dash-border bg-dash-surface p-6">
              {timelineItems.length > 0 ? (
                <ActivityTimeline items={timelineItems} />
              ) : (
                <p className="text-sm text-dash-muted">
                  No activities recorded yet. Add a note or log an interaction below.
                </p>
              )}
            </CardContent>
          </Card>

          <Card variant="panel" className="overflow-hidden p-0">
            <div className="dash-panel-header rounded-none border-dash-border bg-dash-surface-subtle">
              <div>
                <h2 className="dash-panel-header-title">Log activity</h2>
                <p className="dash-panel-header-description">
                  Creates a timeline entry for this candidate.
                </p>
              </div>
            </div>
            <CardContent className="border-t border-dash-border bg-dash-surface p-6">
              <LeadActivityForm leadId={lead.id} />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <LeadDetailActions
            leadId={lead.id}
            currentStage={lead.stage}
            stageLabels={STAGE_LABELS}
            stages={[
              ...PIPELINE_STAGES,
              ...TERMINAL_STAGES,
            ]}
          />

          <Card variant="panel" className="overflow-hidden p-0">
            <div className="dash-panel-header rounded-none border-dash-border bg-dash-surface-subtle">
              <h3 className="dash-panel-header-title">Details</h3>
            </div>
            <CardContent className="border-t border-dash-border bg-dash-surface p-5">
              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="text-xs font-medium text-dash-muted">Created</dt>
                  <dd className="mt-0.5 text-dash-text">{formatDate(lead.created_at)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-dash-muted">Last updated</dt>
                  <dd className="mt-0.5 text-dash-text">{formatDate(lead.updated_at)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-dash-muted">Stage since</dt>
                  <dd className="mt-0.5 text-dash-text">
                    {formatDate(lead.stage_changed_at)}
                  </dd>
                </div>
                {lead.how_heard_about_us && (
                  <div>
                    <dt className="text-xs font-medium text-dash-muted">How heard</dt>
                    <dd className="mt-0.5 text-dash-text">{lead.how_heard_about_us}</dd>
                  </div>
                )}
                {lead.assigned_to && (
                  <div>
                    <dt className="text-xs font-medium text-dash-muted">Assigned to</dt>
                    <dd className="mt-0.5 text-dash-text">{lead.assigned_to}</dd>
                  </div>
                )}
              </dl>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
