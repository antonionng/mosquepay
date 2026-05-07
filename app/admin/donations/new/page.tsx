import * as db from "@/lib/db";
import { getAdminReadContext } from "@/lib/admin/read-context";
import { redirect } from "next/navigation";
import { NewDonationClient } from "./new-donation-client";

export const dynamic = "force-dynamic";

export default async function NewDonationPage() {
  const ctx = await getAdminReadContext();
  if (ctx.mode !== "database" || !ctx.lodgeId) {
    redirect("/admin/donations");
  }
  const lodgeId = ctx.lodgeId;

  const [campaigns, declarations, events] = await Promise.all([
    db.getCharityCampaigns(lodgeId),
    db.getGiftAidDeclarations(lodgeId),
    db.getEvents(lodgeId),
  ]);

  return (
    <NewDonationClient
      campaigns={campaigns.map((c) => ({ id: c.id, name: c.name, status: c.status }))}
      declarations={declarations
        .filter((d) => !d.revoked_at)
        .map((d) => ({
          id: d.id,
          donor_name: d.donor_name,
          donor_email: d.donor_email,
        }))}
      events={events.map((e) => ({
        id: e.id,
        title: e.title,
        event_date: e.event_date,
      }))}
    />
  );
}
