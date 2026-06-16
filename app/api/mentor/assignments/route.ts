import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import * as db from "@/lib/db";
import { getMosqueSlugFromRequest } from "@/lib/tenant";
import {
  requireAdminApiAuth,
  requireAdminApiPermission,
} from "@/lib/auth/api";
import { writeAuditLog } from "@/lib/audit";

export async function GET(request: NextRequest) {
  const unauthorized = await requireAdminApiAuth();
  if (unauthorized) return unauthorized;
  if (!isSupabaseConfigured()) return NextResponse.json({ assignments: [] });
  const mosqueSlug = getMosqueSlugFromRequest(request);
  const mosqueId = await db.resolveMosqueId(mosqueSlug);
  if (!mosqueId) {
    return NextResponse.json({ error: "Mosque not found." }, { status: 404 });
  }
  const forbidden = await requireAdminApiPermission("members:write", mosqueId);
  if (forbidden) return forbidden;
  const active = request.nextUrl.searchParams.get("active") === "true";
  const assignments = await db.listMentorAssignments(mosqueId, { active });
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
  const mosqueSlug = getMosqueSlugFromRequest(request);
  const mosqueId = await db.resolveMosqueId(mosqueSlug);
  if (!mosqueId) {
    return NextResponse.json({ error: "Mosque not found." }, { status: 404 });
  }
  const forbidden = await requireAdminApiPermission("members:write", mosqueId);
  if (forbidden) return forbidden;

  const body = await request.json();
  const assignment = await db.createMentorAssignment(mosqueId, {
    mentor_member_id: body.mentor_member_id,
    mentee_member_id: body.mentee_member_id,
    started_at: body.started_at ?? new Date().toISOString().slice(0, 10),
    ended_at: body.ended_at ?? null,
    notes: body.notes ?? null,
  });
  await writeAuditLog({
    mosqueId,
    action: "mentor_assigned",
    entityType: "mentor_assignment",
    entityId: assignment.id,
    summary: `Assigned mentor`,
    metadata: { mentor: assignment.mentor_member_id, mentee: assignment.mentee_member_id },
  });
  return NextResponse.json({ assignment }, { status: 201 });
}
