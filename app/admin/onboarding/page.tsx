import { redirect } from "next/navigation";
import * as db from "@/lib/db";
import { getAdminReadContext } from "@/lib/admin/read-context";
import { OnboardingWizard } from "./onboarding-client";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const ctx = await getAdminReadContext();
  if (ctx.mode !== "database" || !ctx.lodgeId) {
    redirect("/admin");
  }
  const lodgeId = ctx.lodgeId;

  const [lodge, members, dues, events, staff] = await Promise.all([
    db.getLodgeBySlug(ctx.lodgeSlug),
    db.getMembers(lodgeId, {}),
    db.getMemberDues(lodgeId, {}),
    db.getEvents(lodgeId, { upcoming: true }),
    db.listAdminUsersForLodge(lodgeId).catch(() => []),
  ]);

  return (
    <OnboardingWizard
      lodgeSlug={ctx.lodgeSlug}
      lodgeName={lodge?.name ?? "Your lodge"}
      counts={{
        members: members.length,
        dues: dues.length,
        events: events.length,
        staff: staff.length,
      }}
    />
  );
}
