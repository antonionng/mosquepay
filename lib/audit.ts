import * as db from "@/lib/db";
import {
  getCurrentAdminContextAny,
  getCurrentAdminScope,
} from "@/lib/auth/permissions";

export async function writeAuditLog({
  mosqueId,
  action,
  entityType,
  entityId,
  summary,
  metadata = {},
}: {
  mosqueId: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  summary?: string | null;
  metadata?: Record<string, unknown>;
}) {
  try {
    const admin = await getCurrentAdminContextAny(mosqueId);
    const scope = await getCurrentAdminScope();
    const enriched: Record<string, unknown> = { ...metadata };
    if (
      mosqueId &&
      (scope.kind === "platform" || scope.kind === "dummy")
    ) {
      enriched.impersonation = {
        operator_email: scope.email,
        operator_role: scope.role,
      };
    }
    await db.createAuditLog({
      mosque_id: mosqueId,
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
