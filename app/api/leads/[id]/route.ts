import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import { rejectIfMockDisabled } from "@/lib/db/reject-mock";
import * as db from "@/lib/db";
import * as mockDb from "@/lib/mock-db";
import { getLodgeSlugFromRequest } from "@/lib/tenant";
import { requireAdminApiAuth } from "@/lib/auth/api";
import { writeAuditLog } from "@/lib/audit";

/** Stages accepted from admin CRM (list, detail, kanban) and public enquiry flow. */
const VALID_STAGES = [
  "expression_of_interest",
  "new_enquiry",
  "initial_contact",
  "meeting_scheduled",
  "proposal_lodge",
  "approved",
  "initiated",
  "declined",
  "on_hold",
  "informal_meeting_1",
  "meeting_2",
  "preflight_meeting",
  "application_completion",
  "initiation_briefing",
  "initiation",
];

const ALLOWED_FIELDS = new Set([
  "stage",
  "assigned_to",
  "first_name",
  "last_name",
  "phone",
  "location",
  "proposer_member_id",
  "proposer_name",
  "seconder_member_id",
  "seconder_name",
  "next_step",
  "next_step_due_date",
  "proposal_date",
  "ballot_date",
  "interview_completed_at",
  "consent_given_at",
  "notes",
]);

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const _rejectMock = rejectIfMockDisabled();
  if (_rejectMock) return _rejectMock;

  const { id } = await params;
  try {
    const unauthorized = await requireAdminApiAuth();
    if (unauthorized) return unauthorized;

    const lodgeSlug = getLodgeSlugFromRequest(request);
    const body = await request.json();
    const updates: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(body)) {
      if (ALLOWED_FIELDS.has(key)) {
        updates[key] = value === "" ? null : value;
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update." },
        { status: 400 }
      );
    }

    if (
      updates.stage !== undefined &&
      typeof updates.stage === "string" &&
      !VALID_STAGES.includes(updates.stage)
    ) {
      return NextResponse.json(
        { error: "Valid stage is required." },
        { status: 400 }
      );
    }

    if (isSupabaseConfigured()) {
      const lodgeId = await db.resolveLodgeId(lodgeSlug);
      if (!lodgeId) {
        return NextResponse.json({ error: "Lodge not found." }, { status: 404 });
      }
      const updated = await db.updateLead(id, lodgeId, updates);
      if (!updated) {
        return NextResponse.json({ error: "Lead not found." }, { status: 404 });
      }
      if (updates.stage) {
        await writeAuditLog({
          lodgeId,
          action: "stage_changed",
          entityType: "lead",
          entityId: updated.id,
          summary: `Lead ${updated.first_name} ${updated.last_name} moved to ${updated.stage}`,
        });
      }
      return NextResponse.json({ success: true, lead: updated });
    }

    const updated = mockDb.updateLead(id, updates, { lodge_slug: lodgeSlug });
    if (!updated) {
      return NextResponse.json({ error: "Lead not found." }, { status: 404 });
    }

    return NextResponse.json({ success: true, lead: updated });
  } catch (e) {
    console.error("Leads PATCH API error:", e);
    return NextResponse.json(
      { error: "Something went wrong." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const _rejectMock = rejectIfMockDisabled();
  if (_rejectMock) return _rejectMock;

  const { id } = await params;
  try {
    const unauthorized = await requireAdminApiAuth();
    if (unauthorized) return unauthorized;

    const lodgeSlug = getLodgeSlugFromRequest(request);

    if (isSupabaseConfigured()) {
      const lodgeId = await db.resolveLodgeId(lodgeSlug);
      if (!lodgeId) {
        return NextResponse.json({ error: "Lodge not found." }, { status: 404 });
      }
      const existing = await db.getLeadById(id, lodgeId);
      if (!existing) {
        return NextResponse.json({ error: "Lead not found." }, { status: 404 });
      }
      const { deleted } = await db.deleteLead(id, lodgeId);
      if (!deleted) {
        return NextResponse.json({ error: "Lead not found." }, { status: 404 });
      }
      await writeAuditLog({
        lodgeId,
        action: "deleted",
        entityType: "lead",
        entityId: id,
        summary: `Deleted lead ${existing.first_name} ${existing.last_name}`,
        metadata: { email: existing.email, stage: existing.stage },
      });
      return NextResponse.json({ success: true });
    }

    const { deleted } = mockDb.deleteLead(id, { lodge_slug: lodgeSlug });
    if (!deleted) {
      return NextResponse.json({ error: "Lead not found." }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Leads DELETE API error:", e);
    return NextResponse.json(
      { error: "Something went wrong." },
      { status: 500 }
    );
  }
}
