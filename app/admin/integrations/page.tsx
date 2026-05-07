import { redirect } from "next/navigation";
import * as db from "@/lib/db";
import { getAdminReadContext } from "@/lib/admin/read-context";
import { IntegrationsClient } from "./integrations-client";

export const dynamic = "force-dynamic";

export default async function IntegrationsPage() {
  const ctx = await getAdminReadContext();
  if (ctx.mode !== "database" || !ctx.lodgeId) {
    redirect("/admin");
  }
  const [credentials, jobs, lodge] = await Promise.all([
    db.listIntegrationCredentials(ctx.lodgeId),
    db.listJobs({ lodgeId: ctx.lodgeId, limit: 25 }),
    db.getLodgeBySlug(ctx.lodgeSlug),
  ]);
  return (
    <IntegrationsClient
      lodgeSlug={ctx.lodgeSlug}
      lodgeName={lodge?.name ?? ""}
      credentials={JSON.parse(JSON.stringify(credentials))}
      jobs={JSON.parse(JSON.stringify(jobs))}
    />
  );
}
