// crud-audit:ignore-update crud-audit:ignore-delete
// Admin-only newcomer creation. UPDATE + DELETE live on /api/newcomers/[id]; this
// collection route is intentionally POST-only.
import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import { rejectIfMockDisabled } from "@/lib/db/reject-mock";
import * as db from "@/lib/db";
import * as mockDb from "@/lib/mock-db";
import { getMosqueSlugFromRequest } from "@/lib/tenant";
import { requireAdminApiPermission } from "@/lib/auth/api";
import { writeAuditLog } from "@/lib/audit";

/**
 * Admin-only newcomer creation. Mirrors the public `/api/newcomers` POST but skips the
 * website consent gate and the newcomer auto-responder / mosque notification
 * emails: this path is for staff manually capturing a newcomer, not the
 * public intake form.
 */

function textValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function POST(request: NextRequest) {
  const _rejectMock = rejectIfMockDisabled();
  if (_rejectMock) return _rejectMock;

  try {
    const mosqueSlug = getMosqueSlugFromRequest(request);
    const mosqueId = await db.resolveMosqueId(mosqueSlug);
    if (!mosqueId) {
      return NextResponse.json({ error: "Mosque not found." }, { status: 404 });
    }

    const forbidden = await requireAdminApiPermission("services:write", mosqueId);
    if (forbidden) return forbidden;

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const first_name = textValue(body.first_name);
    const last_name = textValue(body.last_name);
    const email = textValue(body.email);
    const phone = textValue(body.phone) || null;
    const location = textValue(body.location) || null;
    const how_heard = textValue(body.how_heard) || null;
    const message = textValue(body.message) || null;

    if (!first_name || !last_name || !email || !isValidEmail(email)) {
      return NextResponse.json(
        { error: "First name, last name, and a valid email are required." },
        { status: 400 }
      );
    }

    if (isSupabaseConfigured()) {
      const newcomer = await db.addNewcomer(mosqueId, {
        first_name,
        last_name,
        email,
        phone,
        location,
        source: how_heard ?? "Admin entry",
        how_heard_about_us: how_heard,
        initial_message: message,
        stage: "expression_of_interest",
        assigned_to: null,
        proposer_member_id: null,
        proposer_name: null,
        seconder_member_id: null,
        seconder_name: null,
        next_step: null,
        next_step_due_date: null,
        proposal_date: null,
        membership_decision_date: null,
        interview_completed_at: null,
        consent_given_at: null,
        notes: null,
        converted_member_id: null,
        converted_at: null,
      });

      await writeAuditLog({
        mosqueId,
        action: "created",
        entityType: "newcomer",
        entityId: newcomer.id,
        summary: `Created newcomer ${first_name} ${last_name} (admin entry)`,
        metadata: { source: how_heard ?? "Admin entry" },
      });

      return NextResponse.json({ id: newcomer.id, newcomer, success: true }, { status: 201 });
    }

    const newcomer = mockDb.addNewcomer({
      mosque_slug: mosqueSlug,
      first_name,
      last_name,
      email,
      phone,
      location,
      source: how_heard ?? "Admin entry",
      how_heard_about_us: how_heard,
      initial_message: message,
      stage: "expression_of_interest",
      assigned_to: null,
    });

    return NextResponse.json({ id: newcomer.id, newcomer, success: true }, { status: 201 });
  } catch (e) {
    console.error("Admin newcomers POST error:", e);
    return NextResponse.json(
      { error: "Something went wrong." },
      { status: 500 }
    );
  }
}
