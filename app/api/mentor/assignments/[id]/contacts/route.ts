import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import * as db from "@/lib/db";
import { getMosqueSlugFromRequest } from "@/lib/tenant";
import {
  requireAdminApiAuth,
  requireAdminApiPermission,
} from "@/lib/auth/api";

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
  const { id: assignmentId } = await params;
  const mosqueSlug = getMosqueSlugFromRequest(request);
  const mosqueId = await db.resolveMosqueId(mosqueSlug);
  if (!mosqueId) {
    return NextResponse.json({ error: "Mosque not found." }, { status: 404 });
  }
  const forbidden = await requireAdminApiPermission("members:write", mosqueId);
  if (forbidden) return forbidden;
  const body = await request.json();

  const assignments = await db.listMentorAssignments(mosqueId);
  const assignment = assignments.find((a) => a.id === assignmentId);

  const contact = await db.createMentorContact(mosqueId, {
    assignment_id: assignmentId,
    mentor_member_id: assignment?.mentor_member_id ?? null,
    mentee_member_id: assignment?.mentee_member_id ?? null,
    contacted_at: body.contacted_at ?? new Date().toISOString(),
    contact_method: body.contact_method ?? "service",
    topic: body.topic ?? null,
    notes: body.notes ?? null,
  });
  return NextResponse.json({ contact }, { status: 201 });
}
