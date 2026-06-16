import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import * as db from "@/lib/db";
import { getMosqueSlugFromRequest } from "@/lib/tenant";
import {
  requireAdminApiAuth,
  requireAdminApiPermission,
} from "@/lib/auth/api";
import { writeAuditLog } from "@/lib/audit";

export async function POST(
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
  const { id: caseId } = await params;
  const mosqueSlug = getMosqueSlugFromRequest(request);
  const mosqueId = await db.resolveMosqueId(mosqueSlug);
  if (!mosqueId) {
    return NextResponse.json({ error: "Mosque not found." }, { status: 404 });
  }
  const forbidden = await requireAdminApiPermission("pastoral:write", mosqueId);
  if (forbidden) return forbidden;

  const body = await request.json();
  const visit = await db.createPastoralCareVisit(mosqueId, {
    case_id: caseId,
    visited_at: body.visited_at ?? new Date().toISOString(),
    contact_method: body.contact_method ?? "visit",
    outcome: body.outcome?.trim() ?? null,
    notes: body.notes?.trim() ?? null,
    visited_by_admin_user_id: null,
    follow_up_due: body.follow_up_due ?? null,
  });

  await writeAuditLog({
    mosqueId,
    action: "pastoral_visit_logged",
    entityType: "pastoral_case",
    entityId: caseId,
    summary: `Logged ${visit.contact_method} visit`,
    metadata: { visit_id: visit.id },
  });

  return NextResponse.json({ visit }, { status: 201 });
}
