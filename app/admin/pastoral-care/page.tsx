import * as db from "@/lib/db";
import { getAdminReadContext } from "@/lib/admin/read-context";
import { PastoralCareClient } from "./pastoral-care-client";
import { EmptyState } from "@/components/ui/empty-state";
import { HeartHandshake } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function PastoralCarePage() {
  const ctx = await getAdminReadContext();
  if (ctx.mode !== "database" || !ctx.mosqueId) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <div className="admin-page-head">
          <div>
            <h1 className="admin-page-title">PastoralCare</h1>
            <p className="admin-page-copy">
              PastoralCare cases, visits, registers, and care alerts.
            </p>
          </div>
        </div>
        <EmptyState
          icon={HeartHandshake}
          title="PastoralCare needs a database"
          description="Connect Supabase and choose a mosque to manage pastoral cases, visits, and registers."
        />
      </div>
    );
  }
  const mosqueId = ctx.mosqueId;

  const [cases, alerts, register, members] = await Promise.all([
    db.listPastoralCareCases(mosqueId),
    db.listPastoralCareAlerts(mosqueId, { status: "open" }),
    db.listPastoralCareRegister(mosqueId),
    db.getMembers(mosqueId, { status: "active" }),
  ]);

  return (
    <PastoralCareClient
      cases={JSON.parse(JSON.stringify(cases))}
      alerts={JSON.parse(JSON.stringify(alerts))}
      register={JSON.parse(JSON.stringify(register))}
      members={members.map((m) => ({ id: m.id, full_name: m.full_name, email: m.email }))}
    />
  );
}
