import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import * as db from "@/lib/db";
import { getMosqueSlugFromRequest } from "@/lib/tenant";
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
  const mosqueSlug = getMosqueSlugFromRequest(request);
  const mosqueId = await db.resolveMosqueId(mosqueSlug);
  if (!mosqueId) {
    return NextResponse.json({ error: "Mosque not found." }, { status: 404 });
  }
  const forbidden = await requireAdminApiPermission("pastoral:read", mosqueId);
  if (forbidden) return forbidden;

  const pastoralCase = await db.getPastoralCareCaseById(id, mosqueId);
  if (!pastoralCase) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  const visits = await db.listPastoralCareVisits(id, mosqueId);
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
  const mosqueSlug = getMosqueSlugFromRequest(request);
  const mosqueId = await db.resolveMosqueId(mosqueSlug);
  if (!mosqueId) {
    return NextResponse.json({ error: "Mosque not found." }, { status: 404 });
  }
  const forbidden = await requireAdminApiPermission("pastoral:write", mosqueId);
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

  const updated = await db.updatePastoralCareCase(id, mosqueId, updates);
  if (!updated) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  await writeAuditLog({
    mosqueId,
    action: "pastoral_case_updated",
    entityType: "pastoral_case",
    entityId: id,
    summary: `Updated pastoral case for ${updated.contact_name}`,
    metadata: { ...updates },
  });

  return NextResponse.json({ case: updated });
}
