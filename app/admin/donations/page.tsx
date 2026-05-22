import * as db from "@/lib/db";
import * as mockDb from "@/lib/mock-db";
import { getAdminReadContext } from "@/lib/admin/read-context";
import { createServiceClient } from "@/lib/supabase/server";
import { getDefaultLodgeSlug } from "@/lib/tenant";
import { AdminDonationsClient } from "./donations-client";

export const dynamic = "force-dynamic";

async function getMooovConnectionStatus(lodgeId: string): Promise<string | null> {
  try {
    const { data } = await createServiceClient()
      .schema("mooov")
      .from("lodges")
      .select("status")
      .eq("id", lodgeId)
      .maybeSingle<{ status: string }>();
    return data?.status ?? null;
  } catch {
    return null;
  }
}

export default async function AdminDonationsPage() {
  const ctx = await getAdminReadContext();
  const useMock = ctx.mode === "mock";
  const lodgeId = ctx.mode === "database" ? ctx.lodgeId : null;
  const lodgeSlug = ctx.mode === "database" ? ctx.lodgeSlug : getDefaultLodgeSlug();

  const [donations, giftAidDeclarations, mooovStatus] = await Promise.all([
    useMock
      ? Promise.resolve(mockDb.getDonations())
      : lodgeId
        ? db.getDonations(lodgeId)
        : Promise.resolve([]),
    useMock
      ? Promise.resolve(mockDb.getGiftAidDeclarations())
      : lodgeId
        ? db.getGiftAidDeclarations(lodgeId)
        : Promise.resolve([]),
    useMock || !lodgeId
      ? Promise.resolve<string | null>(useMock ? "active" : null)
      : getMooovConnectionStatus(lodgeId),
  ]);

  return (
    <AdminDonationsClient
      donations={JSON.parse(JSON.stringify(donations))}
      giftAidDeclarations={JSON.parse(JSON.stringify(giftAidDeclarations))}
      lodgeSlug={lodgeSlug}
      paymentsConnected={mooovStatus === "active"}
    />
  );
}
