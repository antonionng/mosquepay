import * as db from "@/lib/db";
import * as mockDb from "@/lib/mock-db";
import { getAdminReadContext } from "@/lib/admin/read-context";
import { AdminCharityClient } from "./charity-client";

export const dynamic = "force-dynamic";

export default async function AdminCharityPage() {
  const ctx = await getAdminReadContext();
  const useMock = ctx.mode === "mock";
  const mosqueId = ctx.mode === "database" ? ctx.mosqueId : null;
  const mosqueSlug = ctx.mode === "database" ? ctx.mosqueSlug : "default";

  const campaigns = useMock
    ? mockDb.getCharityCampaigns()
    : mosqueId
      ? await db.getCharityCampaigns(mosqueId)
      : [];
  const donations = useMock
    ? mockDb.getDonations()
    : mosqueId
      ? await db.getDonations(mosqueId)
      : [];
  const giftAidDeclarations = useMock
    ? mockDb.getGiftAidDeclarations()
    : mosqueId
      ? await db.getGiftAidDeclarations(mosqueId)
      : [];
  const serviceCollections = useMock || !mosqueId
    ? []
    : await db.getServiceCollections(mosqueId).catch(() => []);
  const gasdsClaims = useMock || !mosqueId
    ? []
    : await db.getGasdsClaims(mosqueId).catch(() => []);
  const mosque = useMock
    ? null
    : mosqueId
      ? await db.getMosqueBySlug(mosqueSlug).catch(() => null)
      : null;
  const currentCampaignId = mosque?.current_charity_campaign_id ?? null;

  return (
    <AdminCharityClient
      campaigns={JSON.parse(JSON.stringify(campaigns))}
      donations={JSON.parse(JSON.stringify(donations))}
      giftAidDeclarations={JSON.parse(JSON.stringify(giftAidDeclarations))}
      serviceCollections={JSON.parse(JSON.stringify(serviceCollections))}
      gasdsClaims={JSON.parse(JSON.stringify(gasdsClaims))}
      currentCharityCampaignId={currentCampaignId}
      mosqueSlug={mosqueSlug}
    />
  );
}
