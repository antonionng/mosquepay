import * as db from "@/lib/db";
import * as mockDb from "@/lib/mock-db";
import { getAdminReadContext } from "@/lib/admin/read-context";
import { createServiceClient } from "@/lib/supabase/server";
import { getDefaultChurchSlug } from "@/lib/tenant";
import { AdminDonationsClient } from "./donations-client";

export const dynamic = "force-dynamic";

async function getMooovConnectionStatus(churchId: string): Promise<string | null> {
  try {
    const { data } = await createServiceClient()
      .schema("mooov")
      .from("churches")
      .select("status")
      .eq("id", churchId)
      .maybeSingle<{ status: string }>();
    return data?.status ?? null;
  } catch {
    return null;
  }
}

export default async function AdminDonationsPage() {
  const ctx = await getAdminReadContext();
  const useMock = ctx.mode === "mock";
  const churchId = ctx.mode === "database" ? ctx.churchId : null;
  const churchSlug = ctx.mode === "database" ? ctx.churchSlug : getDefaultChurchSlug();

  const [donations, giftAidDeclarations, mooovStatus] = await Promise.all([
    useMock
      ? Promise.resolve(mockDb.getDonations())
      : churchId
        ? db.getDonations(churchId)
        : Promise.resolve([]),
    useMock
      ? Promise.resolve(mockDb.getGiftAidDeclarations())
      : churchId
        ? db.getGiftAidDeclarations(churchId)
        : Promise.resolve([]),
    useMock || !churchId
      ? Promise.resolve<string | null>(useMock ? "active" : null)
      : getMooovConnectionStatus(churchId),
  ]);

  return (
    <AdminDonationsClient
      donations={JSON.parse(JSON.stringify(donations))}
      giftAidDeclarations={JSON.parse(JSON.stringify(giftAidDeclarations))}
      churchSlug={churchSlug}
      paymentsConnected={mooovStatus === "active"}
    />
  );
}
