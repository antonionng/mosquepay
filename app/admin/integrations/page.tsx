import { redirect } from "next/navigation";
import * as db from "@/lib/db";
import { getAdminReadContext } from "@/lib/admin/read-context";
import { IntegrationsClient } from "./integrations-client";
import { createServiceClient } from "@/lib/supabase/server";
import {
  MooovSetupRequiredBanner,
  type MooovSetupHint,
} from "@/components/admin/mooov-setup-required-banner";

export const dynamic = "force-dynamic";

function feedbackForMooovStatus(status: string | undefined) {
  switch (status) {
    case "connected":
      return "Mooov connected.";
    case "invalid_state":
      return "Mooov did not connect because the session expired or the browser state did not match. Please try Connect Mooov again in the same browser tab.";
    case "error":
      return "Mooov did not connect because the token exchange failed. Please retry, and contact support if it happens again.";
    default:
      return null;
  }
}

export default async function IntegrationsPage({
  searchParams,
}: {
  searchParams: Promise<{ mooov?: string }>;
}) {
  const { mooov } = await searchParams;
  const ctx = await getAdminReadContext();
  if (ctx.mode !== "database" || !ctx.lodgeId) {
    redirect("/admin");
  }
  const [credentials, jobs, lodge, mooovConnection, mooovSetupHint] =
    await Promise.all([
      db.listIntegrationCredentials(ctx.lodgeId),
      db.listJobs({ lodgeId: ctx.lodgeId, limit: 25 }),
      db.getLodgeBySlug(ctx.lodgeSlug),
      getMooovConnection(ctx.lodgeId),
      getMooovPendingSetupHint(ctx.lodgeId),
    ]);
  return (
    <div className="space-y-6">
      {mooovSetupHint ? <MooovSetupRequiredBanner hint={mooovSetupHint} /> : null}
      <IntegrationsClient
        lodgeSlug={ctx.lodgeSlug}
        lodgeName={lodge?.name ?? ""}
        credentials={JSON.parse(JSON.stringify(credentials))}
        jobs={JSON.parse(JSON.stringify(jobs))}
        mooovConnection={mooovConnection}
        initialFeedback={feedbackForMooovStatus(mooov)}
      />
    </div>
  );
}

async function getMooovConnection(lodgeId: string) {
  try {
    const { data } = await createServiceClient()
      .schema("mooov")
      .from("lodges")
      .select("merchant_id,status,metadata")
      .eq("id", lodgeId)
      .maybeSingle<{
        merchant_id: string;
        status: string;
        metadata: Record<string, unknown>;
      }>();
    return data
      ? {
          merchantId: data.merchant_id,
          status: data.status,
          metadata: data.metadata,
        }
      : null;
  } catch {
    return null;
  }
}

// Fetch the freshest unexpired merchant_setup hint persisted by
// app/api/dues/start so we can show the "Finish setup on Mooov" banner.
// Returns null when no recent payment_attempt failed with merchant_setup_required
// or when the persisted setup_url has already expired (Mooov mints them with a
// ~1h TTL and a retry will mint a fresh one). Swallow errors here so a
// transient DB blip never breaks the integrations page.
async function getMooovPendingSetupHint(
  lodgeId: string,
): Promise<MooovSetupHint | null> {
  try {
    const { data } = await createServiceClient()
      .schema("mooov")
      .from("payment_attempts")
      .select("metadata")
      .eq("lodge_id", lodgeId)
      .eq("failure_reason", "merchant_setup_required")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<{ metadata: Record<string, unknown> | null }>();
    if (!data?.metadata) return null;
    const ms = (data.metadata as Record<string, unknown>).merchant_setup;
    if (!ms || typeof ms !== "object") return null;
    const obj = ms as Record<string, unknown>;
    const setupUrl = typeof obj.setup_url === "string" ? obj.setup_url : null;
    const expiresAt =
      typeof obj.setup_url_expires_at === "string"
        ? obj.setup_url_expires_at
        : null;
    if (!setupUrl || !expiresAt) return null;
    if (new Date(expiresAt).getTime() <= Date.now()) return null;
    return {
      setup_url: setupUrl,
      setup_url_expires_at: expiresAt,
      providers: Array.isArray(obj.providers)
        ? (obj.providers as MooovSetupHint["providers"])
        : undefined,
      message: typeof obj.message === "string" ? obj.message : undefined,
      docs_url: typeof obj.docs_url === "string" ? obj.docs_url : undefined,
    };
  } catch {
    return null;
  }
}
