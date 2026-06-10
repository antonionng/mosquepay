import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import * as db from "@/lib/db";
import { getChurchSlugFromRequest } from "@/lib/tenant";
import {
  requireAdminApiAuth,
  requireAdminApiPermission,
} from "@/lib/auth/api";
import { writeAuditLog } from "@/lib/audit";

export async function GET(request: NextRequest) {
  const unauthorized = await requireAdminApiAuth();
  if (unauthorized) return unauthorized;
  if (!isSupabaseConfigured()) return NextResponse.json({ assignments: [] });
  const churchSlug = getChurchSlugFromRequest(request);
  const churchId = await db.resolveChurchId(churchSlug);
  if (!churchId) {
    return NextResponse.json({ error: "Church not found." }, { status: 404 });
  }
  const forbidden = await requireAdminApiPermission("members:write", churchId);
  if (forbidden) return forbidden;
  const active = request.nextUrl.searchParams.get("active") === "true";
  const assignments = await db.listMentorAssignments(churchId, { active });
  return NextResponse.json({ assignments });
}

export async function POST(request: NextRequest) {
  const unauthorized = await requireAdminApiAuth();
  if (unauthorized) return unauthorized;
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Database not configured." },
      { status: 503 }
    );
  }
  const churchSlug = getChurchSlugFromRequest(request);
  const churchId = await db.resolveChurchId(churchSlug);
  if (!churchId) {
    return NextResponse.json({ error: "Church not found." }, { status: 404 });
  }
  const forbidden = await requireAdminApiPermission("members:write", churchId);
  if (forbidden) return forbidden;

  const body = await request.json();
  const assignment = await db.createMentorAssignment(churchId, {
    mentor_member_id: body.mentor_member_id,
    mentee_member_id: body.mentee_member_id,
    started_at: body.started_at ?? new Date().toISOString().slice(0, 10),
    ended_at: body.ended_at ?? null,
    notes: body.notes ?? null,
  });
  await writeAuditLog({
    churchId,
    action: "mentor_assigned",
    entityType: "mentor_assignment",
    entityId: assignment.id,
    summary: `Assigned mentor`,
    metadata: { mentor: assignment.mentor_member_id, mentee: assignment.mentee_member_id },
  });
  return NextResponse.json({ assignment }, { status: 201 });
}
