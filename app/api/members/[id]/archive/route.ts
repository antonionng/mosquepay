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
  const { id: memberId } = await params;
  const mosqueSlug = getMosqueSlugFromRequest(request);
  const mosqueId = await db.resolveMosqueId(mosqueSlug);
  if (!mosqueId) {
    return NextResponse.json({ error: "Mosque not found." }, { status: 404 });
  }
  const forbidden = await requireAdminApiPermission("members:write", mosqueId);
  if (forbidden) return forbidden;
  const body = await request.json().catch(() => ({}));
  const reason = String(body.reason ?? "manual_archive");
  const member = await db.archiveMember(memberId, mosqueId, reason);
  if (!member) {
    return NextResponse.json({ error: "Member not found." }, { status: 404 });
  }
  await writeAuditLog({
    mosqueId,
    action: "member_archived",
    entityType: "member",
    entityId: memberId,
    summary: `Member archived (${reason})`,
    metadata: { reason },
  });
  return NextResponse.json({ member });
}
