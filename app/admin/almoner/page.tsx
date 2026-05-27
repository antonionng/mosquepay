import * as db from "@/lib/db";
import { getAdminReadContext } from "@/lib/admin/read-context";
import { AlmonerClient } from "./almoner-client";
import { EmptyState } from "@/components/ui/empty-state";
import { HeartHandshake } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AlmonerPage() {
  const ctx = await getAdminReadContext();
  if (ctx.mode !== "database" || !ctx.lodgeId) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <div className="admin-page-head">
          <div>
            <h1 className="admin-page-title">Almoner</h1>
            <p className="admin-page-copy">
              Welfare cases, visits, registers, and care alerts.
            </p>
          </div>
        </div>
        <EmptyState
          icon={HeartHandshake}
          title="Almoner needs a database"
          description="Connect Supabase and choose a lodge to manage welfare cases, visits, and registers."
        />
      </div>
    );
  }
  const lodgeId = ctx.lodgeId;

  const [cases, alerts, register, members] = await Promise.all([
    db.listWelfareCases(lodgeId),
    db.listWelfareAlerts(lodgeId, { status: "open" }),
    db.listWelfareRegister(lodgeId),
    db.getMembers(lodgeId, { status: "active" }),
  ]);

  return (
    <AlmonerClient
      cases={JSON.parse(JSON.stringify(cases))}
      alerts={JSON.parse(JSON.stringify(alerts))}
      register={JSON.parse(JSON.stringify(register))}
      members={members.map((m) => ({ id: m.id, full_name: m.full_name, email: m.email }))}
    />
  );
}
