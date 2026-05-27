import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { LeadsKanban } from "@/components/crm/leads-kanban";
import * as db from "@/lib/db";
import * as mockDb from "@/lib/mock-db";
import { getAdminReadContext } from "@/lib/admin/read-context";
import { List, Plus } from "lucide-react";
import { getLeadPrompt } from "@/lib/leads/next-action";

const STAGES = [
  "expression_of_interest",
  "initial_contact",
  "meeting_scheduled",
  "proposal_lodge",
  "approved",
  "initiated",
  "declined",
  "on_hold",
] as const;

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
const NOW_TS = Date.now();

export default async function LeadsKanbanPage() {
  const ctx = await getAdminReadContext();
  const useMock = ctx.mode === "mock";
  const lodgeId = ctx.mode === "database" ? ctx.lodgeId : null;
  const allLeads = useMock
    ? mockDb.getLeads()
    : lodgeId
      ? await db.getLeads(lodgeId)
      : [];

  const leads = await Promise.all(allLeads.map(async (l) => {
    const activities = useMock
      ? mockDb.getLeadActivities(l.id)
      : lodgeId
        ? await db.getLeadActivities(l.id, lodgeId)
        : [];
    const lastActivity = activities[0] ?? null;
    const daysSinceActivity = lastActivity
      ? Math.floor(
          (NOW_TS - new Date(lastActivity.created_at).getTime()) / 86400000
        )
      : Math.floor(
          (NOW_TS - new Date(l.created_at).getTime()) / 86400000
        );
    const daysInStage = Math.floor(
      (NOW_TS - new Date(l.stage_changed_at).getTime()) / 86400000
    );

    const prompt = getLeadPrompt({
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
      stage: l.stage,
      source: l.source,
      daysInStage,
      daysSinceActivity,
      lastActivityType: lastActivity?.activity_type ?? null,
      converted_at: l.converted_at ?? null,
      promptLabel: prompt.label,
      promptReason: prompt.reason,
      promptSeverity: prompt.severity,
    };
  }));

  return (
    <div className="space-y-5 sm:space-y-8">
      <div className="admin-page-head">
        <div>
          <h1 className="admin-page-title">Pipeline Board</h1>
          <p className="admin-page-copy">
            Drag candidates between stages to update their progression.
          </p>
        </div>
        <div className="admin-action-row">
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/leads" className="flex items-center gap-2">
              <List className="h-4 w-4" />
              List View
            </Link>
          </Button>
          <Button asChild variant="dashboard" size="sm">
            <Link href="/admin/leads/new" className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              New lead
            </Link>
          </Button>
        </div>
      </div>

      <Card variant="panel" className="overflow-hidden p-0">
        <div className="dash-panel-header rounded-none border-dash-border bg-dash-surface-subtle">
          <div>
            <h2 className="dash-panel-header-title">Kanban</h2>
            <p className="dash-panel-header-description">
              Stages match the list view; drops persist via the same API as bulk moves.
            </p>
          </div>
        </div>
        <CardContent className="border-t border-dash-border bg-dash-surface p-4 lg:p-5">
          <LeadsKanban
            initialLeads={leads}
            stages={[...STAGES]}
            stageLabels={STAGE_LABELS}
          />
        </CardContent>
      </Card>
    </div>
  );
}
