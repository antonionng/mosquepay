import * as db from "@/lib/db";
import { getAdminReadContext } from "@/lib/admin/read-context";
import { notFound, redirect } from "next/navigation";
import { DonationDetailClient } from "./donation-detail-client";

export const dynamic = "force-dynamic";

export default async function DonationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await getAdminReadContext();
  if (ctx.mode !== "database" || !ctx.lodgeId) {
    redirect("/admin/donations");
  }
  const lodgeId = ctx.lodgeId;

  const donation = await db.getDonationById(id, lodgeId);
  if (!donation) notFound();

  const [campaigns, declarations, events, payment, declaration, auditLogs] =
    await Promise.all([
      db.getCharityCampaigns(lodgeId),
      db.getGiftAidDeclarations(lodgeId),
      db.getEvents(lodgeId),
      donation.payment_id
        ? db.getPaymentById(donation.payment_id, lodgeId)
        : Promise.resolve(null),
      donation.gift_aid_declaration_id
        ? db.getGiftAidDeclarationById(donation.gift_aid_declaration_id, lodgeId)
        : Promise.resolve(null),
      db.listAuditLogsByEntity(lodgeId, "donation", id),
    ]);

  const event = donation.event_id
    ? events.find((e) => e.id === donation.event_id) ?? null
    : null;
  const campaign = donation.campaign_id
    ? campaigns.find((c) => c.id === donation.campaign_id) ?? null
    : null;

  return (
    <DonationDetailClient
      donation={JSON.parse(JSON.stringify(donation))}
      payment={payment ? JSON.parse(JSON.stringify(payment)) : null}
      declaration={declaration ? JSON.parse(JSON.stringify(declaration)) : null}
      event={event ? { id: event.id, title: event.title } : null}
      campaign={campaign ? { id: campaign.id, name: campaign.name } : null}
      campaigns={campaigns.map((c) => ({ id: c.id, name: c.name }))}
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
      }))}
      auditLogs={JSON.parse(JSON.stringify(auditLogs))}
    />
  );
}
