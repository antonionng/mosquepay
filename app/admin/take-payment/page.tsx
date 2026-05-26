import { redirect } from "next/navigation";
import { getAdminReadContext } from "@/lib/admin/read-context";
import { getCurrentAdminScope } from "@/lib/auth/permissions";
import { createServiceClient } from "@/lib/supabase/server";
import * as db from "@/lib/db";
import { TakePaymentClient } from "./take-payment-client";
import { EmptyState } from "@/components/ui/empty-state";
import { Banknote } from "lucide-react";

export const dynamic = "force-dynamic";

const RETURN_PATH = "/admin/take-payment";

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

async function getLodgeMembers(lodgeId: string) {
  // Light-weight list for the in-form picker. We deliberately fetch all
  // active members in one go (lodges are small — typically <100 members) so
  // the client can run the filter locally without a debounced API round-trip
  // mid-meeting on flaky venue Wi-Fi.
  try {
    const members = await db.getMembers(lodgeId, { status: "active" });
    return members.map((m) => ({
      id: m.id,
      full_name: m.full_name,
      email: m.email ?? null,
    }));
  } catch {
    return [];
  }
}

export default async function TakePaymentPage() {
  // Custom auth gate so an unauthenticated visitor lands BACK here after
  // logging in. The shared getAdminReadContext redirects to /admin/login
  // without a return URL, which is fine for nav-tab landings but defeats
  // the "bookmark this page on your phone home screen" use case the take-
  // payment route is built around.
  const scope = await getCurrentAdminScope();
  if (scope.kind === "none") {
    redirect(`/admin/login?from=${encodeURIComponent(RETURN_PATH)}`);
  }

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

  const [connection, members] = await Promise.all([
    getMooovConnection(ctx.lodgeId),
    getLodgeMembers(ctx.lodgeId),
  ]);
  const connected = !!connection && connection.status === "active";

  return (
    <TakePaymentClient
      lodgeSlug={ctx.lodgeSlug}
      connected={connected}
      mooovStatus={connection?.status ?? null}
      members={members}
    />
  );
}
