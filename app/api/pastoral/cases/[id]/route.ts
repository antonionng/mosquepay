import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import * as db from "@/lib/db";
import { getChurchSlugFromRequest } from "@/lib/tenant";
import {
  requireAdminApiAuth,
  requireAdminApiPermission,
} from "@/lib/auth/api";
import { writeAuditLog } from "@/lib/audit";

export async function GET(
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
  const forbidden = await requireAdminApiPermission("pastoral:read", churchId);
  if (forbidden) return forbidden;

  const pastoralCase = await db.getPastoralCareCaseById(id, churchId);
  if (!pastoralCase) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  const visits = await db.listPastoralCareVisits(id, churchId);
  return NextResponse.json({ case: pastoralCase, visits });
}

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
    "status",
    "severity",
    "summary",
    "next_action",
    "next_action_due",
    "case_type",
    "contact_phone",
    "contact_email",
  ]) {
    if (body[key] !== undefined) updates[key] = body[key];
  }
  if (body.status === "closed") {
    updates.closed_at = new Date().toISOString();
  } else if (body.status && body.status !== "closed") {
    updates.closed_at = null;
  }

  const updated = await db.updatePastoralCareCase(id, churchId, updates);
  if (!updated) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  await writeAuditLog({
    churchId,
    action: "pastoral_case_updated",
    entityType: "pastoral_case",
    entityId: id,
    summary: `Updated pastoral case for ${updated.contact_name}`,
    metadata: { ...updates },
  });

  return NextResponse.json({ case: updated });
}
