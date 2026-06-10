import * as db from "@/lib/db";
import * as mockDb from "@/lib/mock-db";
import { getAdminReadContext } from "@/lib/admin/read-context";
import { AdminCharityClient } from "./charity-client";

export const dynamic = "force-dynamic";

export default async function AdminCharityPage() {
  const ctx = await getAdminReadContext();
  const useMock = ctx.mode === "mock";
  const churchId = ctx.mode === "database" ? ctx.churchId : null;
  const churchSlug = ctx.mode === "database" ? ctx.churchSlug : "default";

  const campaigns = useMock
    ? mockDb.getCharityCampaigns()
    : churchId
      ? await db.getCharityCampaigns(churchId)
      : [];
  const donations = useMock
    ? mockDb.getDonations()
    : churchId
      ? await db.getDonations(churchId)
      : [];
  const giftAidDeclarations = useMock
    ? mockDb.getGiftAidDeclarations()
    : churchId
      ? await db.getGiftAidDeclarations(churchId)
      : [];
  const serviceCollections = useMock || !churchId
    ? []
    : await db.getServiceCollections(churchId).catch(() => []);
  const gasdsClaims = useMock || !churchId
    ? []
    : await db.getGasdsClaims(churchId).catch(() => []);
  const church = useMock
    ? null
    : churchId
      ? await db.getChurchBySlug(churchSlug).catch(() => null)
      : null;
  const currentCampaignId = church?.current_charity_campaign_id ?? null;

  return (
    <AdminCharityClient
      campaigns={JSON.parse(JSON.stringify(campaigns))}
      donations={JSON.parse(JSON.stringify(donations))}
      giftAidDeclarations={JSON.parse(JSON.stringify(giftAidDeclarations))}
      serviceCollections={JSON.parse(JSON.stringify(serviceCollections))}
      gasdsClaims={JSON.parse(JSON.stringify(gasdsClaims))}
      currentCharityCampaignId={currentCampaignId}
      churchSlug={churchSlug}
    />
  );
}
