import { redirect } from "next/navigation";
import * as db from "@/lib/db";
import { getAdminReadContext } from "@/lib/admin/read-context";
import { OnboardingWizard } from "./onboarding-client";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const ctx = await getAdminReadContext();
  if (ctx.mode !== "database" || !ctx.mosqueId) {
    redirect("/admin");
  }
  const mosqueId = ctx.mosqueId;

  const [mosque, members, giving, events, staff] = await Promise.all([
    db.getMosqueBySlug(ctx.mosqueSlug),
    db.getMembers(mosqueId, {}),
    db.getMemberGiving(mosqueId, {}),
    db.getEvents(mosqueId, { upcoming: true }),
    db.listAdminUsersForMosque(mosqueId).catch(() => []),
  ]);

  return (
    <OnboardingWizard
      mosqueSlug={ctx.mosqueSlug}
      mosqueName={mosque?.name ?? "Your mosque"}
      counts={{
        members: members.length,
        giving: giving.length,
        events: events.length,
        staff: staff.length,
      }}
    />
  );
}
