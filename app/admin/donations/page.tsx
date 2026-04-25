import * as db from "@/lib/db";
import * as mockDb from "@/lib/mock-db";
import { getAdminReadContext } from "@/lib/admin/read-context";
import { AdminDonationsClient } from "./donations-client";

export default async function AdminDonationsPage() {
  const ctx = await getAdminReadContext();
  const useMock = ctx.mode === "mock";
  const lodgeId = ctx.mode === "database" ? ctx.lodgeId : null;

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

  return (
    <AdminDonationsClient
      donations={JSON.parse(JSON.stringify(donations))}
      giftAidDeclarations={JSON.parse(JSON.stringify(giftAidDeclarations))}
    />
  );
}
