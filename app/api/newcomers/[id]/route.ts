import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import { rejectIfMockDisabled } from "@/lib/db/reject-mock";
import * as db from "@/lib/db";
import * as mockDb from "@/lib/mock-db";
import { getChurchSlugFromRequest } from "@/lib/tenant";
import { requireAdminApiAuth } from "@/lib/auth/api";
import { writeAuditLog } from "@/lib/audit";

/** Stages accepted from admin CRM (list, detail, kanban) and public enquiry flow. */
const VALID_STAGES = [
  "expression_of_interest",
  "new_enquiry",
  "initial_contact",
  "service_scheduled",
  "proposal_church",
  "approved",
  "welcomed",
  "declined",
  "on_hold",
  "informal_service_1",
  "service_2",
  "preflight_service",
  "application_completion",
  "membership_class",
  "membership",
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
  "membership_decision_date",
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

    const churchSlug = getChurchSlugFromRequest(request);
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
      const churchId = await db.resolveChurchId(churchSlug);
      if (!churchId) {
        return NextResponse.json({ error: "Church not found." }, { status: 404 });
      }
      const updated = await db.updateNewcomer(id, churchId, updates);
      if (!updated) {
        return NextResponse.json({ error: "Newcomer not found." }, { status: 404 });
      }
      if (updates.stage) {
        await writeAuditLog({
          churchId,
          action: "stage_changed",
          entityType: "newcomer",
          entityId: updated.id,
          summary: `Newcomer ${updated.first_name} ${updated.last_name} moved to ${updated.stage}`,
        });
      }
      return NextResponse.json({ success: true, newcomer: updated });
    }

    const updated = mockDb.updateNewcomer(id, updates, { church_slug: churchSlug });
    if (!updated) {
      return NextResponse.json({ error: "Newcomer not found." }, { status: 404 });
    }

    return NextResponse.json({ success: true, newcomer: updated });
  } catch (e) {
    console.error("Newcomers PATCH API error:", e);
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

    const churchSlug = getChurchSlugFromRequest(request);

    if (isSupabaseConfigured()) {
      const churchId = await db.resolveChurchId(churchSlug);
      if (!churchId) {
        return NextResponse.json({ error: "Church not found." }, { status: 404 });
      }
      const existing = await db.getNewcomerById(id, churchId);
      if (!existing) {
        return NextResponse.json({ error: "Newcomer not found." }, { status: 404 });
      }
      const { deleted } = await db.deleteNewcomer(id, churchId);
      if (!deleted) {
        return NextResponse.json({ error: "Newcomer not found." }, { status: 404 });
      }
      await writeAuditLog({
        churchId,
        action: "deleted",
        entityType: "newcomer",
        entityId: id,
        summary: `Deleted newcomer ${existing.first_name} ${existing.last_name}`,
        metadata: { email: existing.email, stage: existing.stage },
      });
      return NextResponse.json({ success: true });
    }

    const { deleted } = mockDb.deleteNewcomer(id, { church_slug: churchSlug });
    if (!deleted) {
      return NextResponse.json({ error: "Newcomer not found." }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Newcomers DELETE API error:", e);
    return NextResponse.json(
      { error: "Something went wrong." },
      { status: 500 }
    );
  }
}
