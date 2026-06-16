import * as db from "@/lib/db";
import Link from "next/link";
import { getAdminReadContext } from "@/lib/admin/read-context";
import { EmptyState } from "@/components/ui/empty-state";
import { Repeat } from "lucide-react";
import { GivingSchedulesClient } from "./schedules-client";

export const dynamic = "force-dynamic";

export default async function AdminGivingSchedulesPage() {
  const ctx = await getAdminReadContext();
  if (ctx.mode !== "database" || !ctx.mosqueId) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <div className="admin-page-head">
          <div>
            <h1 className="admin-page-title">Monthly subscriptions</h1>
            <p className="admin-page-copy">
              All saved-charge giving schedules for this mosque. Health, progress,
              and per-member actions.
            </p>
          </div>
        </div>
        <EmptyState
          icon={Repeat}
          title="Subscriptions need a database"
          description="Connect Supabase and choose a mosque to see the giving schedules list."
        />
      </div>
    );
  }
  const mosqueId = ctx.mosqueId;

  const [schedules, counts, members] = await Promise.all([
    db.listGivingSchedules(mosqueId, { limit: 500 }),
    db.countGivingSchedulesByStatus(mosqueId),
    db.getMembers(mosqueId),
  ]);

  // Build an email -> { id, full_name } map so we can deep-link to
  // /admin/members/[id] without an extra round-trip per row.
  const memberByEmail = new Map<string, { id: string; full_name: string }>();
  for (const m of members) {
    if (m.email) {
      memberByEmail.set(m.email.toLowerCase(), {
        id: m.id,
        full_name: m.full_name,
      });
    }
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="admin-page-head">
        <div>
          <h1 className="admin-page-title">Monthly subscriptions</h1>
          <p className="admin-page-copy">
            Saved-charge giving schedules for this mosque. Click a row for the
            full member view.
          </p>
        </div>
        <Link
          href="/admin/treasurer"
          className="text-sm text-slate-500 underline-offset-4 hover:text-slate-900 hover:underline"
        >
          Back to treasurer
        </Link>
      </div>
      <GivingSchedulesClient
        initialSchedules={JSON.parse(JSON.stringify(schedules))}
        counts={counts}
        memberLookup={Object.fromEntries(memberByEmail.entries())}
      />
    </div>
  );
}
