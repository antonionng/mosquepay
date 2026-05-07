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
  const { id: memberId } = await params;
  const lodgeSlug = getLodgeSlugFromRequest(request);
  const lodgeId = await db.resolveLodgeId(lodgeSlug);
  if (!lodgeId) {
    return NextResponse.json({ error: "Lodge not found." }, { status: 404 });
  }
  const forbidden = await requireAdminApiPermission("members:write", lodgeId);
  if (forbidden) return forbidden;
  const body = await request.json().catch(() => ({}));
  const reason = String(body.reason ?? "manual_archive");
  const member = await db.archiveMember(memberId, lodgeId, reason);
  if (!member) {
    return NextResponse.json({ error: "Member not found." }, { status: 404 });
  }
  await writeAuditLog({
    lodgeId,
    action: "member_archived",
    entityType: "member",
    entityId: memberId,
    summary: `Member archived (${reason})`,
    metadata: { reason },
  });
  return NextResponse.json({ member });
}
