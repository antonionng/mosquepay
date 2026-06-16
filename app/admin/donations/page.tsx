import * as db from "@/lib/db";
import * as mockDb from "@/lib/mock-db";
import { getAdminReadContext } from "@/lib/admin/read-context";
import { createServiceClient } from "@/lib/supabase/server";
import { getDefaultMosqueSlug } from "@/lib/tenant";
import { AdminDonationsClient } from "./donations-client";

export const dynamic = "force-dynamic";

async function getMooovConnectionStatus(mosqueId: string): Promise<string | null> {
  try {
    const { data } = await createServiceClient()
      .schema("mooov")
      .from("mosques")
      .select("status")
      .eq("id", mosqueId)
      .maybeSingle<{ status: string }>();
    return data?.status ?? null;
  } catch {
    return null;
  }
}

export default async function AdminDonationsPage() {
  const ctx = await getAdminReadContext();
  const useMock = ctx.mode === "mock";
  const mosqueId = ctx.mode === "database" ? ctx.mosqueId : null;
  const mosqueSlug = ctx.mode === "database" ? ctx.mosqueSlug : getDefaultMosqueSlug();

  const [donations, giftAidDeclarations, mooovStatus] = await Promise.all([
    useMock
      ? Promise.resolve(mockDb.getDonations())
      : mosqueId
        ? db.getDonations(mosqueId)
        : Promise.resolve([]),
    useMock
      ? Promise.resolve(mockDb.getGiftAidDeclarations())
      : mosqueId
        ? db.getGiftAidDeclarations(mosqueId)
        : Promise.resolve([]),
    useMock || !mosqueId
      ? Promise.resolve<string | null>(useMock ? "active" : null)
      : getMooovConnectionStatus(mosqueId),
  ]);

  return (
    <AdminDonationsClient
      donations={JSON.parse(JSON.stringify(donations))}
      giftAidDeclarations={JSON.parse(JSON.stringify(giftAidDeclarations))}
      mosqueSlug={mosqueSlug}
      paymentsConnected={mooovStatus === "active"}
    />
  );
}
