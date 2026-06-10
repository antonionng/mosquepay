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
  const forbidden = await requireAdminApiPermission("members:write", churchId);
  if (forbidden) return forbidden;

  const body = await request.json();
  const updates: Record<string, unknown> = {};
  if (body.notes !== undefined) updates.notes = body.notes;
  if (body.end === true) {
    updates.ended_at = new Date().toISOString().slice(0, 10);
  } else if (body.end === false) {
    updates.ended_at = null;
  } else if (body.ended_at !== undefined) {
    updates.ended_at = body.ended_at;
  }

  const updated = await db.updateMentorAssignment(id, churchId, updates);
  if (!updated) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  await writeAuditLog({
    churchId,
    action: updates.ended_at ? "mentor_assignment_ended" : "mentor_assignment_updated",
    entityType: "mentor_assignment",
    entityId: id,
    summary: updates.ended_at
      ? "Ended mentor assignment"
      : "Updated mentor assignment",
    metadata: updates,
  });

  return NextResponse.json({ assignment: updated });
}
