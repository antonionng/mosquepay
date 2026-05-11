import * as db from "@/lib/db";
import * as mockDb from "@/lib/mock-db";
import { getAdminReadContext } from "@/lib/admin/read-context";
import { AdminCharityClient } from "./charity-client";

export default async function AdminCharityPage() {
  const ctx = await getAdminReadContext();
  const useMock = ctx.mode === "mock";
  const lodgeId = ctx.mode === "database" ? ctx.lodgeId : null;

  const campaigns = useMock
    ? mockDb.getCharityCampaigns()
    : lodgeId
      ? await db.getCharityCampaigns(lodgeId)
      : [];
  const donations = useMock
    ? mockDb.getDonations()
    : lodgeId
      ? await db.getDonations(lodgeId)
      : [];
  const giftAidDeclarations = useMock
    ? mockDb.getGiftAidDeclarations()
    : lodgeId
      ? await db.getGiftAidDeclarations(lodgeId)
      : [];
  const meetingCollections = useMock || !lodgeId
    ? []
    : await db.getMeetingCollections(lodgeId).catch(() => []);
  const gasdsClaims = useMock || !lodgeId
    ? []
    : await db.getGasdsClaims(lodgeId).catch(() => []);

  return (
    <AdminCharityClient
      campaigns={JSON.parse(JSON.stringify(campaigns))}
      donations={JSON.parse(JSON.stringify(donations))}
      giftAidDeclarations={JSON.parse(JSON.stringify(giftAidDeclarations))}
      meetingCollections={JSON.parse(JSON.stringify(meetingCollections))}
      gasdsClaims={JSON.parse(JSON.stringify(gasdsClaims))}
    />
  );
}
