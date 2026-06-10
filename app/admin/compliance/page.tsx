import { redirect } from "next/navigation";
import * as db from "@/lib/db";
import { getAdminReadContext } from "@/lib/admin/read-context";
import {
  getCurrentAdminContextAny,
  getCurrentAdminScope,
} from "@/lib/auth/permissions";
import { ComplianceClient } from "./compliance-client";

export const dynamic = "force-dynamic";

export default async function CompliancePage() {
  const ctx = await getAdminReadContext();
  if (ctx.mode !== "database" || !ctx.churchId) {
    redirect("/admin");
  }
  const churchId = ctx.churchId;
  const adminCtx = await getCurrentAdminContextAny(churchId);
  const scope = await getCurrentAdminScope();
  const adminEmail =
    scope.kind === "platform" || scope.kind === "church" || scope.kind === "dummy"
      ? scope.email
      : null;
  const adminUser = adminEmail
    ? await db.getAdminUserByEmail(adminEmail, churchId)
    : null;

  const [settings, sars] = await Promise.all([
    db.getDataRetentionSettings(churchId),
    db.listSubjectAccessRequests(churchId),
  ]);

  return (
    <ComplianceClient
      role={adminCtx?.role ?? "secretary"}
      mfaEnabled={adminUser?.mfa_enabled ?? false}
      mfaEnrolledAt={adminUser?.mfa_enrolled_at ?? null}
      settings={JSON.parse(JSON.stringify(settings))}
      sars={JSON.parse(JSON.stringify(sars))}
    />
  );
}
