import * as db from "@/lib/db";
import { getAdminReadContext } from "@/lib/admin/read-context";
import { TreasurerClient } from "./treasurer-client";
import { EmptyState } from "@/components/ui/empty-state";
import { Wallet } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function TreasurerPage() {
  const ctx = await getAdminReadContext();
  if (ctx.mode !== "database" || !ctx.mosqueId) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <div className="admin-page-head">
          <div>
            <h1 className="admin-page-title">Treasurer</h1>
            <p className="admin-page-copy">
              Cash book ledger, giving bulk run, and reconciliation tools.
            </p>
          </div>
        </div>
        <EmptyState
          icon={Wallet}
          title="Treasurer needs a database"
          description="Connect Supabase and choose a mosque to use the treasurer tools. Demo mode is read-only for finance."
        />
      </div>
    );
  }
  const mosqueId = ctx.mosqueId;

  const currentYear = await db.getCurrentMosqueYear(mosqueId).catch(() => null);

  const [
    ledger,
    mosqueGiving,
    members,
    outstandingInstalments,
    scheduleCounts,
    methodBreakdown,
  ] = await Promise.all([
    db.getTreasurerLedger(mosqueId),
    db.getMosqueGiving(mosqueId),
    db.getMembers(mosqueId, { status: "active" }),
    db.getOutstandingInstalments(mosqueId),
    db.countGivingSchedulesByStatus(mosqueId),
    db.countMemberGivingByPaymentMethod(mosqueId, {
      yearStart: currentYear?.start_date,
      yearEnd: currentYear?.end_date,
    }),
  ]);

  return (
    <TreasurerClient
      ledger={JSON.parse(JSON.stringify(ledger))}
      mosqueGiving={JSON.parse(JSON.stringify(mosqueGiving))}
      activeMembers={members.length}
      outstandingInstalments={JSON.parse(
        JSON.stringify(outstandingInstalments)
      )}
      scheduleCounts={scheduleCounts}
      methodBreakdown={methodBreakdown}
      currentYearLabel={currentYear?.label ?? null}
    />
  );
}
