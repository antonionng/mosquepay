import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import * as db from "@/lib/db";
import { getLodgeSlugFromRequest } from "@/lib/tenant";
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
  const lodgeSlug = getLodgeSlugFromRequest(request);
  const lodgeId = await db.resolveLodgeId(lodgeSlug);
  if (!lodgeId) {
    return NextResponse.json({ error: "Lodge not found." }, { status: 404 });
  }
  const forbidden = await requireAdminApiPermission("welfare:read", lodgeId);
  if (forbidden) return forbidden;

  const welfareCase = await db.getWelfareCaseById(id, lodgeId);
  if (!welfareCase) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  const visits = await db.listWelfareVisits(id, lodgeId);
  return NextResponse.json({ case: welfareCase, visits });
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
  const lodgeSlug = getLodgeSlugFromRequest(request);
  const lodgeId = await db.resolveLodgeId(lodgeSlug);
  if (!lodgeId) {
    return NextResponse.json({ error: "Lodge not found." }, { status: 404 });
  }
  const forbidden = await requireAdminApiPermission("welfare:write", lodgeId);
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

  const updated = await db.updateWelfareCase(id, lodgeId, updates);
  if (!updated) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  await writeAuditLog({
    lodgeId,
    action: "welfare_case_updated",
    entityType: "welfare_case",
    entityId: id,
    summary: `Updated welfare case for ${updated.contact_name}`,
    metadata: { ...updates },
  });

  return NextResponse.json({ case: updated });
}
