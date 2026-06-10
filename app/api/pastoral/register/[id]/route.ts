import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import * as db from "@/lib/db";
import { getChurchSlugFromRequest } from "@/lib/tenant";
import {
  requireAdminApiAuth,
  requireAdminApiPermission,
} from "@/lib/auth/api";
import { writeAuditLog } from "@/lib/audit";

export async function PATCH(
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
  const forbidden = await requireAdminApiPermission("pastoral:write", churchId);
  if (forbidden) return forbidden;

  const body = await request.json();
  const updates: Record<string, unknown> = {};
  for (const key of [
    "full_name",
    "relationship",
    "contact_email",
    "contact_phone",
    "address",
    "last_contact_at",
    "notes",
  ]) {
    if (body[key] !== undefined) updates[key] = body[key];
  }

  const updated = await db.updatePastoralCareRegister(id, churchId, updates);
  if (!updated) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  await writeAuditLog({
    churchId,
    action: "pastoral_register_updated",
    entityType: "pastoral_register",
    entityId: id,
    summary: `Updated ${updated.register_type} entry: ${updated.full_name}`,
    metadata: updates,
  });

  return NextResponse.json({ entry: updated });
}
