import { getAdminReadContext } from "@/lib/admin/read-context";
import { createServiceClient } from "@/lib/supabase/server";
import { TakePaymentClient } from "./take-payment-client";
import { EmptyState } from "@/components/ui/empty-state";
import { Banknote } from "lucide-react";

export const dynamic = "force-dynamic";

async function getMooovConnection(lodgeId: string) {
  try {
    const { data } = await createServiceClient()
      .schema("mooov")
      .from("lodges")
      .select("merchant_id,status")
      .eq("id", lodgeId)
      .maybeSingle<{ merchant_id: string; status: string }>();
    return data;
  } catch {
    return null;
  }
}

export default async function TakePaymentPage() {
  const ctx = await getAdminReadContext();
  if (ctx.mode !== "database" || !ctx.lodgeId) {
    return (
      <div className="space-y-6">
        <div className="admin-page-head">
          <div>
            <h1 className="admin-page-title">Take payment</h1>
            <p className="admin-page-copy">
              In-person QR payments for ad-hoc charity, raffle, and dining
              top-ups.
            </p>
          </div>
        </div>
        <EmptyState
          icon={Banknote}
          title="Take payment needs a live lodge"
          description="Connect Supabase and choose a lodge to use the in-person QR flow. Demo mode does not mint live payment sessions."
        />
      </div>
    );
  }

  const connection = await getMooovConnection(ctx.lodgeId);
  const connected = !!connection && connection.status === "active";

  return (
    <TakePaymentClient
      lodgeSlug={ctx.lodgeSlug}
      connected={connected}
      mooovStatus={connection?.status ?? null}
    />
  );
}
