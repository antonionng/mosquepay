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
  if (!isSupabaseConfigured()) return NextResponse.json({ consents: [] });
  const { id: memberId } = await params;
  const lodgeSlug = getLodgeSlugFromRequest(request);
  const lodgeId = await db.resolveLodgeId(lodgeSlug);
  if (!lodgeId) {
    return NextResponse.json({ error: "Lodge not found." }, { status: 404 });
  }
  const forbidden = await requireAdminApiPermission("members:read", lodgeId);
  if (forbidden) return forbidden;
  return NextResponse.json({
    consents: await db.listMemberConsents(lodgeId, memberId),
  });
}

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
  const { id: memberId } = await params;
  const lodgeSlug = getLodgeSlugFromRequest(request);
  const lodgeId = await db.resolveLodgeId(lodgeSlug);
  if (!lodgeId) {
    return NextResponse.json({ error: "Lodge not found." }, { status: 404 });
  }
  const forbidden = await requireAdminApiPermission("members:write", lodgeId);
  if (forbidden) return forbidden;
  const body = await request.json();
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const consent = await db.recordMemberConsent(lodgeId, {
    member_id: memberId,
    consent_key: body.consent_key,
    granted: body.granted ?? true,
    granted_at: body.granted_at ?? new Date().toISOString(),
    revoked_at: null,
    source: body.source ?? "admin",
    ip_address: ip,
    user_agent: request.headers.get("user-agent") ?? null,
    notes: body.notes ?? null,
  });
  await writeAuditLog({
    lodgeId,
    action: "consent_recorded",
    entityType: "member_consent",
    entityId: consent.id,
    summary: `Recorded ${body.consent_key} (${body.granted ? "granted" : "denied"})`,
    metadata: { consent_key: body.consent_key, granted: body.granted },
  });
  return NextResponse.json({ consent }, { status: 201 });
}
