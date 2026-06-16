import { redirect } from "next/navigation";
import * as db from "@/lib/db";
import { getAdminReadContext } from "@/lib/admin/read-context";
import { IntegrationsClient } from "./integrations-client";
import { createServiceClient } from "@/lib/supabase/server";
import {
  MooovSetupRequiredBanner,
  type MooovSetupHint,
} from "@/components/admin/mooov-setup-required-banner";
import {
  MooovRepairRequiredBanner,
  type MooovRepairRequiredHint,
} from "@/components/admin/mooov-repair-required-banner";

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
  if (ctx.mode !== "database" || !ctx.mosqueId) {
    redirect("/admin");
  }
  const [credentials, jobs, mosque, mooovConnection, mooovSetupHint] =
    await Promise.all([
      db.listIntegrationCredentials(ctx.mosqueId),
      db.listJobs({ mosqueId: ctx.mosqueId, limit: 25 }),
      db.getMosqueBySlug(ctx.mosqueSlug),
      getMooovConnection(ctx.mosqueId),
      getMooovPendingSetupHint(ctx.mosqueId),
    ]);
  const repairHint = buildRepairHintFromConnection(mooovConnection);
  return (
    <div className="space-y-4 sm:space-y-6">
      {repairHint ? <MooovRepairRequiredBanner hint={repairHint} /> : null}
      {mooovSetupHint ? <MooovSetupRequiredBanner hint={mooovSetupHint} /> : null}
      <IntegrationsClient
        mosqueSlug={ctx.mosqueSlug}
        mosqueName={mosque?.name ?? ""}
        credentials={JSON.parse(JSON.stringify(credentials))}
        jobs={JSON.parse(JSON.stringify(jobs))}
        mooovConnection={mooovConnection}
        initialFeedback={feedbackForMooovStatus(mooov)}
      />
    </div>
  );
}

// Build the repair-required banner inputs from the latest
// mooov.mosques row. Returns null unless status='needs_repair' was set by
// the connect webhook in response to a payment.failed:account_invalid.
function buildRepairHintFromConnection(
  conn: Awaited<ReturnType<typeof getMooovConnection>>
): MooovRepairRequiredHint | null {
  if (!conn || conn.status !== "needs_repair") return null;
  const meta = conn.metadata ?? {};
  const lastFailureAt =
    typeof meta.last_failure_at === "string" ? meta.last_failure_at : undefined;
  const lastFailureReason =
    typeof meta.last_failure_reason === "string"
      ? meta.last_failure_reason
      : undefined;
  // Mooov's allowlist today: mosque-pay.com, www.mosque-pay.com,
  // *.vercel.app. Pin to www.mosque-pay.com so the auto-bounce works
  // for tenants on the mosque subdomain too (admin always lives on www).
  const returnUrl =
    (process.env.MOOOV_REDIRECT_BASE_URL ??
      process.env.NEXT_PUBLIC_SITE_URL ??
      "https://www.mosque-pay.com").replace(/\/$/, "") +
    "/admin/integrations";
  return {
    portalBaseUrl: process.env.MOOOV_PORTAL_BASE,
    returnUrl,
    lastFailureAt,
    lastFailureReason,
  };
}

async function getMooovConnection(mosqueId: string) {
  try {
    const { data } = await createServiceClient()
      .schema("mooov")
      .from("mosques")
      .select("merchant_id,status,metadata")
      .eq("id", mosqueId)
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
// app/api/giving/start so we can show the "Finish setup on Mooov" banner.
// Returns null when no recent payment_attempt failed with merchant_setup_required
// or when the persisted setup_url has already expired (Mooov mints them with a
// ~1h TTL and a retry will mint a fresh one). Swallow errors here so a
// transient DB blip never breaks the integrations page.
async function getMooovPendingSetupHint(
  mosqueId: string,
): Promise<MooovSetupHint | null> {
  try {
    // Read the LATEST attempt for this mosque unconditionally, then only
    // surface the banner if THAT attempt is the merchant_setup_required
    // failure. Filtering by failure_reason in the query is wrong: after a
    // successful retry, the latest attempt has failure_reason=null but the
    // latest *matching* row is still the older failed one, which would make
    // the banner re-appear with stale info on a now-healthy merchant.
    const { data } = await createServiceClient()
      .schema("mooov")
      .from("payment_attempts")
      .select("metadata,failure_reason")
      .eq("mosque_id", mosqueId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<{
        metadata: Record<string, unknown> | null;
        failure_reason: string | null;
      }>();
    if (!data || data.failure_reason !== "merchant_setup_required") return null;
    if (!data.metadata) return null;
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
