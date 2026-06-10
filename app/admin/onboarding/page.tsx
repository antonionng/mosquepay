import { redirect } from "next/navigation";
import * as db from "@/lib/db";
import { getAdminReadContext } from "@/lib/admin/read-context";
import { OnboardingWizard } from "./onboarding-client";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const ctx = await getAdminReadContext();
  if (ctx.mode !== "database" || !ctx.churchId) {
    redirect("/admin");
  }
  const churchId = ctx.churchId;

  const [church, members, giving, events, staff] = await Promise.all([
    db.getChurchBySlug(ctx.churchSlug),
    db.getMembers(churchId, {}),
    db.getMemberGiving(churchId, {}),
    db.getEvents(churchId, { upcoming: true }),
    db.listAdminUsersForChurch(churchId).catch(() => []),
  ]);

  return (
    <OnboardingWizard
      churchSlug={ctx.churchSlug}
      churchName={church?.name ?? "Your church"}
      counts={{
        members: members.length,
        giving: giving.length,
        events: events.length,
        staff: staff.length,
      }}
    />
  );
}
