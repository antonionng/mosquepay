import { redirect } from "next/navigation";
import * as db from "@/lib/db";
import { getAdminReadContext } from "@/lib/admin/read-context";
import { IntegrationsClient } from "./integrations-client";
import { createServiceClient } from "@/lib/supabase/server";

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
  const [credentials, jobs, lodge, mooovConnection] = await Promise.all([
    db.listIntegrationCredentials(ctx.lodgeId),
    db.listJobs({ lodgeId: ctx.lodgeId, limit: 25 }),
    db.getLodgeBySlug(ctx.lodgeSlug),
    getMooovConnection(ctx.lodgeId),
  ]);
  return (
    <IntegrationsClient
      lodgeSlug={ctx.lodgeSlug}
      lodgeName={lodge?.name ?? ""}
      credentials={JSON.parse(JSON.stringify(credentials))}
      jobs={JSON.parse(JSON.stringify(jobs))}
      mooovConnection={mooovConnection}
      initialFeedback={feedbackForMooovStatus(mooov)}
    />
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
