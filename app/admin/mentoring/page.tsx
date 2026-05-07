import * as db from "@/lib/db";
import { getAdminReadContext } from "@/lib/admin/read-context";
import { MentoringClient } from "./mentoring-client";
import { EmptyState } from "@/components/ui/empty-state";
import { GraduationCap } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function MentoringPage() {
  const ctx = await getAdminReadContext();
  if (ctx.mode !== "database" || !ctx.lodgeId) {
    return (
      <div className="space-y-6">
        <div className="admin-page-head">
          <div>
            <h1 className="admin-page-title">Mentoring</h1>
            <p className="admin-page-copy">
              Track progression sign-offs, mentor assignments, and the officer ladder.
            </p>
          </div>
        </div>
        <EmptyState
          icon={GraduationCap}
          title="Mentoring needs a database"
          description="Connect Supabase and choose a lodge to manage mentor assignments and officer progression."
        />
      </div>
    );
  }
  const lodgeId = ctx.lodgeId;

  const [members, assignments, contacts, rungs] = await Promise.all([
    db.getMembers(lodgeId, { status: "active" }),
    db.listMentorAssignments(lodgeId, { active: true }),
    db.listMentorContacts(lodgeId),
    db.listOfficerLadder(lodgeId),
  ]);

  const memberMini = members.map((m) => ({
    id: m.id,
    full_name: m.full_name,
    rank: m.rank,
    date_of_initiation: m.date_of_initiation,
    date_of_passing: m.date_of_passing,
    date_of_raising: m.date_of_raising,
    progression_signed_off_initiation: m.progression_signed_off_initiation,
    progression_signed_off_passing: m.progression_signed_off_passing,
    progression_signed_off_raising: m.progression_signed_off_raising,
  }));

  return (
    <MentoringClient
      members={memberMini}
      assignments={JSON.parse(JSON.stringify(assignments))}
      contacts={JSON.parse(JSON.stringify(contacts))}
      rungs={JSON.parse(JSON.stringify(rungs))}
    />
  );
}
