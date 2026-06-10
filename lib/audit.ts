import * as db from "@/lib/db";
import {
  getCurrentAdminContextAny,
  getCurrentAdminScope,
} from "@/lib/auth/permissions";

export async function writeAuditLog({
  churchId,
  action,
  entityType,
  entityId,
  summary,
  metadata = {},
}: {
  churchId: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  summary?: string | null;
  metadata?: Record<string, unknown>;
}) {
  try {
    const admin = await getCurrentAdminContextAny(churchId);
    const scope = await getCurrentAdminScope();
    const enriched: Record<string, unknown> = { ...metadata };
    if (
      churchId &&
      (scope.kind === "platform" || scope.kind === "dummy")
    ) {
      enriched.impersonation = {
        operator_email: scope.email,
        operator_role: scope.role,
      };
    }
    await db.createAuditLog({
      church_id: churchId,
      actor_email: admin?.email ?? null,
      actor_role: admin?.role ?? null,
      action,
      entity_type: entityType,
      entity_id: entityId ?? null,
      summary: summary ?? null,
      metadata: enriched,
    });
  } catch (error) {
    console.error("Audit log write failed:", error);
  }
}
