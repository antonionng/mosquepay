import { notFound } from "next/navigation";
import * as db from "@/lib/db";
import { getAdminReadContext } from "@/lib/admin/read-context";
import { CharityCampaignDetailClient } from "./campaign-detail-client";

export const dynamic = "force-dynamic";

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await getAdminReadContext();
  if (ctx.mode !== "database" || !ctx.churchId) {
    notFound();
  }
  const churchId = ctx.churchId;
  const campaign = await db.getCharityCampaignById(id, churchId);
  if (!campaign) notFound();

  const [donations, allDonations, events, giftAid] = await Promise.all([
    db.getDonationsByCampaign(id, churchId),
    db.getDonations(churchId),
    db.getEvents(churchId),
    db.getGiftAidDeclarations(churchId),
  ]);

  const eventTitleMap = new Map(events.map((e) => [e.id, e.title] as const));
  const giftAidByEmail = new Map(
    giftAid
      .filter((g) => !g.revoked_at)
      .map((g) => [g.donor_email.toLowerCase(), g] as const)
  );

  // Match service (event) collections by charity_name match (legacy data without campaign_id)
  const possibleMatches = allDonations.filter(
    (d) =>
      d.campaign_id === id ||
      (d.event_id &&
        eventTitleMap.has(d.event_id) &&
        d.donor_email && // basic guard
        events.find((e) => e.id === d.event_id)?.charity_name === campaign.name)
  );

  return (
    <CharityCampaignDetailClient
      campaign={JSON.parse(JSON.stringify(campaign))}
      donations={JSON.parse(
        JSON.stringify(possibleMatches.length > donations.length ? possibleMatches : donations)
      )}
      eventTitleMap={Array.from(eventTitleMap.entries())}
      giftAidEmails={Array.from(giftAidByEmail.keys())}
    />
  );
}
