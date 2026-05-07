import * as db from "@/lib/db";
import { getAdminReadContext } from "@/lib/admin/read-context";
import { CommunicationsClient } from "./communications-client";
import {
  AUTOMATION_KEYS,
  AUTOMATION_LABELS,
} from "@/lib/communications/automations";
import { SYSTEM_TEMPLATES } from "@/lib/communications/templates";
import { EmptyState } from "@/components/ui/empty-state";
import { Megaphone } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function CommunicationsPage() {
  const ctx = await getAdminReadContext();
  if (ctx.mode !== "database" || !ctx.lodgeId) {
    return (
      <div className="space-y-6">
        <div className="admin-page-head">
          <div>
            <h1 className="admin-page-title">Communications</h1>
            <p className="admin-page-copy">
              Send newsletters, manage templates, and toggle automations.
            </p>
          </div>
        </div>
        <EmptyState
          icon={Megaphone}
          title="Communications needs a database"
          description="Connect Supabase and choose a lodge to send newsletters and manage templates."
        />
      </div>
    );
  }
  const lodgeId = ctx.lodgeId;

  const [templates, recentMessages, settings, members] = await Promise.all([
    db.listMessageTemplates(lodgeId),
    db.listMessages(lodgeId, { limit: 50 }),
    db.listAutomationSettings(lodgeId),
    db.getMembers(lodgeId, { status: "active" }),
  ]);

  const automations = AUTOMATION_KEYS.map((key) => ({
    key,
    label: AUTOMATION_LABELS[key],
    enabled: settings.find((s) => s.automation_key === key)?.enabled ?? false,
    last_run_at:
      settings.find((s) => s.automation_key === key)?.last_run_at ?? null,
  }));

  return (
    <CommunicationsClient
      templates={JSON.parse(JSON.stringify(templates))}
      messages={JSON.parse(JSON.stringify(recentMessages))}
      automations={automations}
      marketplaceTemplates={SYSTEM_TEMPLATES.map((template) => ({
        ...template,
        installed: templates.some(
          (installed) => installed.template_key === template.template_key
        ),
      }))}
      audienceCounts={{
        active_members: members.filter((m) => m.membership_status === "active")
          .length,
      }}
    />
  );
}
