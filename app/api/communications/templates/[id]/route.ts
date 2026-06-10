import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import * as db from "@/lib/db";
import { getChurchSlugFromRequest } from "@/lib/tenant";
import {
  requireAdminApiAuth,
  requireAdminApiPermission,
} from "@/lib/auth/api";
import { writeAuditLog } from "@/lib/audit";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const unauthorized = await requireAdminApiAuth();
  if (unauthorized) return unauthorized;
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Database not configured." },
      { status: 503 }
    );
  }
  const { id } = await params;
  const churchSlug = getChurchSlugFromRequest(request);
  const churchId = await db.resolveChurchId(churchSlug);
  if (!churchId) {
    return NextResponse.json({ error: "Church not found." }, { status: 404 });
  }
  const forbidden = await requireAdminApiPermission("members:write", churchId);
  if (forbidden) return forbidden;

  const result = await db.deleteMessageTemplate(churchId, id);
  if (!result.deleted) {
    return NextResponse.json(
      { error: "System templates cannot be deleted." },
      { status: 400 }
    );
  }

  await writeAuditLog({
    churchId,
    action: "message_template_deleted",
    entityType: "message_template",
    entityId: id,
    summary: "Deleted custom message template",
  });

  return NextResponse.json({ deleted: true });
}
