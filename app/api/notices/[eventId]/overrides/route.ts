import { NextRequest, NextResponse } from "next/server";
import { requireAdminApiAuth, requireAdminApiPermission } from "@/lib/auth/api";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import * as db from "@/lib/db";
import { getMosqueSlugFromRequest } from "@/lib/tenant";
import { getCurrentAdminContextAny } from "@/lib/auth/permissions";
import { writeAuditLog } from "@/lib/audit";

type Params = { params: Promise<{ eventId: string }> };

type OverrideBody = {
  subject_type?: "member" | "guest";
  subject_id?: string;
  levy_amount?: number | null;
  dining_amount?: number | null;
  levy_waived?: boolean;
  dining_waived?: boolean;
  note?: string | null;
};

function normaliseAmount(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100) / 100;
}

export async function GET(request: NextRequest, { params }: Params) {
  const unauthorized = await requireAdminApiAuth();
  if (unauthorized) return unauthorized;
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Database not configured." }, { status: 503 });
  }

  const { eventId } = await params;
  const mosqueSlug = getMosqueSlugFromRequest(request);
  const mosqueId = await db.resolveMosqueId(mosqueSlug);
  if (!mosqueId) {
    return NextResponse.json({ error: "Mosque not found." }, { status: 404 });
  }
  const forbidden = await requireAdminApiPermission("notice:write", mosqueId);
  if (forbidden) return forbidden;

  const overrides = await db.listEventFeeOverrides(mosqueId, eventId);
  return NextResponse.json({ overrides });
}

export async function POST(request: NextRequest, { params }: Params) {
  const unauthorized = await requireAdminApiAuth();
  if (unauthorized) return unauthorized;
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Database not configured." }, { status: 503 });
  }

  const { eventId } = await params;
  const mosqueSlug = getMosqueSlugFromRequest(request);
  const mosqueId = await db.resolveMosqueId(mosqueSlug);
  if (!mosqueId) {
    return NextResponse.json({ error: "Mosque not found." }, { status: 404 });
  }
  const forbidden = await requireAdminApiPermission("notice:write", mosqueId);
  if (forbidden) return forbidden;

  const body = (await request.json().catch(() => ({}))) as OverrideBody;
  if (body.subject_type !== "member" && body.subject_type !== "guest") {
    return NextResponse.json(
      { error: "subject_type must be 'member' or 'guest'." },
      { status: 400 }
    );
  }
  if (!body.subject_id) {
    return NextResponse.json(
      { error: "subject_id is required." },
      { status: 400 }
    );
  }

  const admin = await getCurrentAdminContextAny(mosqueId);
  const note =
    typeof body.note === "string" ? body.note.trim().slice(0, 500) || null : null;

  const override = await db.upsertEventFeeOverride(mosqueId, {
    event_id: eventId,
    subject_type: body.subject_type,
    subject_id: body.subject_id,
    levy_amount: normaliseAmount(body.levy_amount),
    dining_amount: normaliseAmount(body.dining_amount),
    levy_waived: body.levy_waived === true,
    dining_waived: body.dining_waived === true,
    note,
    created_by_email: admin?.email ?? null,
  });

  await writeAuditLog({
    mosqueId,
    action: "fee_override_set",
    entityType: "event_fee_override",
    entityId: override.id,
    summary: `Set fee override on event ${eventId} for ${body.subject_type} ${body.subject_id}`,
    metadata: {
      event_id: eventId,
      subject_type: body.subject_type,
      subject_id: body.subject_id,
      levy_waived: override.levy_waived,
      dining_waived: override.dining_waived,
      levy_amount: override.levy_amount,
      dining_amount: override.dining_amount,
      note,
    },
  });

  return NextResponse.json({ override });
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const unauthorized = await requireAdminApiAuth();
  if (unauthorized) return unauthorized;
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Database not configured." }, { status: 503 });
  }

  const { eventId } = await params;
  const mosqueSlug = getMosqueSlugFromRequest(request);
  const mosqueId = await db.resolveMosqueId(mosqueSlug);
  if (!mosqueId) {
    return NextResponse.json({ error: "Mosque not found." }, { status: 404 });
  }
  const forbidden = await requireAdminApiPermission("notice:write", mosqueId);
  if (forbidden) return forbidden;

  const url = new URL(request.url);
  const subjectType = url.searchParams.get("subject_type");
  const subjectId = url.searchParams.get("subject_id");
  if (subjectType !== "member" && subjectType !== "guest") {
    return NextResponse.json(
      { error: "subject_type must be 'member' or 'guest'." },
      { status: 400 }
    );
  }
  if (!subjectId) {
    return NextResponse.json(
      { error: "subject_id is required." },
      { status: 400 }
    );
  }

  await db.deleteEventFeeOverride(mosqueId, eventId, subjectType, subjectId);

  await writeAuditLog({
    mosqueId,
    action: "fee_override_cleared",
    entityType: "event_fee_override",
    entityId: `${eventId}:${subjectType}:${subjectId}`,
    summary: `Cleared fee override on event ${eventId} for ${subjectType} ${subjectId}`,
    metadata: { event_id: eventId, subject_type: subjectType, subject_id: subjectId },
  });

  return NextResponse.json({ ok: true });
}
