import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import * as db from "@/lib/db";
import { getLodgeSlugFromRequest } from "@/lib/tenant";
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
  const lodgeSlug = getLodgeSlugFromRequest(request);
  const lodgeId = await db.resolveLodgeId(lodgeSlug);
  if (!lodgeId) {
    return NextResponse.json({ error: "Lodge not found." }, { status: 404 });
  }
  const forbidden = await requireAdminApiPermission("welfare:write", lodgeId);
  if (forbidden) return forbidden;

  const body = await request.json();
  const visit = await db.createWelfareVisit(lodgeId, {
    case_id: caseId,
    visited_at: body.visited_at ?? new Date().toISOString(),
    contact_method: body.contact_method ?? "visit",
    outcome: body.outcome?.trim() ?? null,
    notes: body.notes?.trim() ?? null,
    visited_by_admin_user_id: null,
    follow_up_due: body.follow_up_due ?? null,
  });

  await writeAuditLog({
    lodgeId,
    action: "welfare_visit_logged",
    entityType: "welfare_case",
    entityId: caseId,
    summary: `Logged ${visit.contact_method} visit`,
    metadata: { visit_id: visit.id },
  });

  return NextResponse.json({ visit }, { status: 201 });
}
