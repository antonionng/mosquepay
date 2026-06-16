import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import * as db from "@/lib/db";
import { getMosqueSlugFromRequest } from "@/lib/tenant";
import {
  requireAdminApiAuth,
  requireAdminApiPermission,
} from "@/lib/auth/api";

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
  if (body.status) {
    updates.status = body.status;
    if (body.status === "acknowledged" || body.status === "resolved") {
      updates.acknowledged_at = new Date().toISOString();
    }
  }
  if (body.case_id !== undefined) updates.case_id = body.case_id;
  if (body.severity) updates.severity = body.severity;

  const updated = await db.updatePastoralCareAlert(id, mosqueId, updates);
  if (!updated) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  return NextResponse.json({ alert: updated });
}
