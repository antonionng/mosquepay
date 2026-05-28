import * as db from "@/lib/db";
import { getAdminReadContext } from "@/lib/admin/read-context";
import { TreasurerClient } from "./treasurer-client";
import { EmptyState } from "@/components/ui/empty-state";
import { Wallet } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function TreasurerPage() {
  const ctx = await getAdminReadContext();
  if (ctx.mode !== "database" || !ctx.lodgeId) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <div className="admin-page-head">
          <div>
            <h1 className="admin-page-title">Treasurer</h1>
            <p className="admin-page-copy">
              Cash book ledger, dues bulk run, and reconciliation tools.
            </p>
          </div>
        </div>
        <EmptyState
          icon={Wallet}
          title="Treasurer needs a database"
          description="Connect Supabase and choose a lodge to use the treasurer tools. Demo mode is read-only for finance."
        />
      </div>
    );
  }
  const lodgeId = ctx.lodgeId;

  const [
    ledger,
    lodgeDues,
    members,
    outstandingInstalments,
    scheduleCounts,
  ] = await Promise.all([
    db.getTreasurerLedger(lodgeId),
    db.getLodgeDues(lodgeId),
    db.getMembers(lodgeId, { status: "active" }),
    db.getOutstandingInstalments(lodgeId),
    db.countDuesSchedulesByStatus(lodgeId),
  ]);

  return (
    <TreasurerClient
      ledger={JSON.parse(JSON.stringify(ledger))}
      lodgeDues={JSON.parse(JSON.stringify(lodgeDues))}
      activeMembers={members.length}
      outstandingInstalments={JSON.parse(
        JSON.stringify(outstandingInstalments)
      )}
      scheduleCounts={scheduleCounts}
    />
  );
}
