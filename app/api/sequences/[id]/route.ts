import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import { rejectIfMockDisabled } from "@/lib/db/reject-mock";
import * as db from "@/lib/db";
import { getLodgeSlugFromRequest } from "@/lib/tenant";
import {
  requireAdminApiAuth,
  requireAdminApiPermission,
} from "@/lib/auth/api";
import { writeAuditLog } from "@/lib/audit";

type Params = { params: Promise<{ id: string }> };

function parseMonths(input: unknown): number[] | undefined {
  if (input === undefined) return undefined;
  if (!Array.isArray(input)) return undefined;
  const months = input
    .map((m) => Number(m))
    .filter((m) => Number.isInteger(m) && m >= 1 && m <= 12);
  return Array.from(new Set(months)).sort((a, b) => a - b);
}

function parseInt0(value: unknown, min: number, max: number): number | undefined {
  if (value === undefined) return undefined;
  const n = Number(value);
  if (!Number.isInteger(n)) return undefined;
  if (n < min || n > max) return undefined;
  return n;
}

function parseWeekOfMonth(value: unknown): number | null {
  const n = Number(value);
  if (!Number.isInteger(n)) return null;
  if (n === -1 || (n >= 1 && n <= 5)) return n;
  return null;
}

function parseDayOfWeek(value: unknown): number | null {
  const n = Number(value);
  if (!Number.isInteger(n)) return null;
  if (n >= 1 && n <= 7) return n;
  return null;
}

function parseMonthOverrides(
  input: unknown,
  activeMonths: number[]
):
  | Record<string, { week_of_month?: number; day_of_week?: number }>
  | undefined {
  if (input === undefined) return undefined;
  const out: Record<
    string,
    { week_of_month?: number; day_of_week?: number }
  > = {};
  if (input === null) return out;
  if (typeof input !== "object" || Array.isArray(input)) return out;
  const allowed = new Set(activeMonths);
  for (const [rawKey, rawValue] of Object.entries(
    input as Record<string, unknown>
  )) {
    const monthNum = Number(rawKey);
    if (!Number.isInteger(monthNum) || !allowed.has(monthNum)) continue;
    if (!rawValue || typeof rawValue !== "object") continue;
    const obj = rawValue as Record<string, unknown>;
    const entry: { week_of_month?: number; day_of_week?: number } = {};
    if (obj.week_of_month !== undefined && obj.week_of_month !== null) {
      const week = parseWeekOfMonth(obj.week_of_month);
      if (week !== null) entry.week_of_month = week;
    }
    if (obj.day_of_week !== undefined && obj.day_of_week !== null) {
      const day = parseDayOfWeek(obj.day_of_week);
      if (day !== null) entry.day_of_week = day;
    }
    if (entry.week_of_month !== undefined || entry.day_of_week !== undefined) {
      out[String(monthNum)] = entry;
    }
  }
  return out;
}

function nullableNumber(value: unknown): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function nullableTrim(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") return undefined;
  const t = value.trim();
  return t.length > 0 ? t : null;
}

export async function GET(request: NextRequest, { params }: Params) {
  const _rejectMock = rejectIfMockDisabled();
  if (_rejectMock) return _rejectMock;

  const unauthorized = await requireAdminApiAuth();
  if (unauthorized) return unauthorized;

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ sequence: null, events: [] });
  }

  const { id } = await params;
  const lodgeSlug = getLodgeSlugFromRequest(request);
  const lodgeId = await db.resolveLodgeId(lodgeSlug);
  if (!lodgeId) {
    return NextResponse.json({ error: "Lodge not found." }, { status: 404 });
  }
  const sequence = await db.getMeetingSequenceById(id, lodgeId);
  if (!sequence) {
    return NextResponse.json({ error: "Sequence not found." }, { status: 404 });
  }
  const events = await db.getEventsBySequenceId(id, lodgeId);
  return NextResponse.json({ sequence, events });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const _rejectMock = rejectIfMockDisabled();
  if (_rejectMock) return _rejectMock;

  const unauthorized = await requireAdminApiAuth();
  if (unauthorized) return unauthorized;

  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Database not configured." },
      { status: 503 }
    );
  }

  try {
    const { id } = await params;
    const lodgeSlug = getLodgeSlugFromRequest(request);
    const lodgeId = await db.resolveLodgeId(lodgeSlug);
    if (!lodgeId) {
      return NextResponse.json({ error: "Lodge not found." }, { status: 404 });
    }
    const forbidden = await requireAdminApiPermission("meetings:write", lodgeId);
    if (forbidden) return forbidden;

    const body = await request.json();
    const updates: Parameters<typeof db.updateMeetingSequence>[2] = {};
    if (typeof body.name === "string") updates.name = body.name.trim();
    const description = nullableTrim(body.description);
    if (description !== undefined) updates.description = description;
    if (typeof body.event_type === "string" && body.event_type.trim())
      updates.event_type = body.event_type.trim();
    const day = parseInt0(body.day_of_week, 1, 7);
    if (day !== undefined) updates.day_of_week = day;
    const week = parseInt0(body.week_of_month, -1, 5);
    if (week !== undefined && (week === -1 || week >= 1))
      updates.week_of_month = week;
    const months = parseMonths(body.months);
    if (months !== undefined) {
      if (months.length === 0) {
        return NextResponse.json(
          { error: "Pick at least one month." },
          { status: 400 }
        );
      }
      updates.months = months;
    }
    if (body.month_overrides !== undefined) {
      // Validate against either the incoming months list or, if unchanged,
      // the existing one, so an override for a no-longer-selected month is
      // dropped and never persisted.
      let effectiveMonths = months;
      if (effectiveMonths === undefined) {
        const existing = await db.getMeetingSequenceById(id, lodgeId);
        if (!existing) {
          return NextResponse.json(
            { error: "Sequence not found." },
            { status: 404 }
          );
        }
        effectiveMonths = existing.months;
      }
      const overrides = parseMonthOverrides(
        body.month_overrides,
        effectiveMonths
      );
      if (overrides !== undefined) updates.month_overrides = overrides;
    }
    const time = nullableTrim(body.default_event_time);
    if (time !== undefined) updates.default_event_time = time;
    const location = nullableTrim(body.default_location);
    if (location !== undefined) updates.default_location = location;
    const temple = nullableTrim(body.default_temple_room);
    if (temple !== undefined) updates.default_temple_room = temple;
    const dress = nullableTrim(body.default_dress_code);
    if (dress !== undefined) updates.default_dress_code = dress;
    const dining = nullableNumber(body.default_dining_price);
    if (dining !== undefined) updates.default_dining_price = dining;
    const fee = nullableNumber(body.default_meeting_fee_amount);
    if (fee !== undefined) updates.default_meeting_fee_amount = fee;
    if (typeof body.default_enable_dining_rsvp === "boolean")
      updates.default_enable_dining_rsvp = body.default_enable_dining_rsvp;
    if (typeof body.default_enable_meeting_fee === "boolean")
      updates.default_enable_meeting_fee = body.default_enable_meeting_fee;
    if (typeof body.default_enable_charity_donation === "boolean")
      updates.default_enable_charity_donation = body.default_enable_charity_donation;
    const charityName = nullableTrim(body.default_charity_name);
    if (charityName !== undefined) updates.default_charity_name = charityName;
    if (typeof body.default_enable_raffle_donation === "boolean")
      updates.default_enable_raffle_donation = body.default_enable_raffle_donation;
    const raffleDesc = nullableTrim(body.default_raffle_description);
    if (raffleDesc !== undefined) updates.default_raffle_description = raffleDesc;
    if (typeof body.default_enable_raffle_wine_pledge === "boolean")
      updates.default_enable_raffle_wine_pledge =
        body.default_enable_raffle_wine_pledge;
    const wineDesc = nullableTrim(body.default_raffle_wine_description);
    if (wineDesc !== undefined) updates.default_raffle_wine_description = wineDesc;
    const lead = parseInt0(body.summons_lead_weeks, 1, 26);
    if (lead !== undefined) updates.summons_lead_weeks = lead;
    const minLead = parseInt0(body.summons_min_lead_weeks, 1, 26);
    if (minLead !== undefined) updates.summons_min_lead_weeks = minLead;
    if (typeof body.auto_draft_summons === "boolean")
      updates.auto_draft_summons = body.auto_draft_summons;
    if (typeof body.active === "boolean") updates.active = body.active;

    const sequence = await db.updateMeetingSequence(id, lodgeId, updates);
    if (!sequence) {
      return NextResponse.json({ error: "Sequence not found." }, { status: 404 });
    }

    await writeAuditLog({
      lodgeId,
      action: "updated",
      entityType: "meeting_sequence",
      entityId: sequence.id,
      summary: `Updated meeting sequence ${sequence.name}`,
      metadata: { fields: Object.keys(updates) },
    });

    return NextResponse.json({ sequence });
  } catch (error) {
    console.error("Sequence PATCH error:", error);
    return NextResponse.json(
      { error: "Failed to update sequence." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const _rejectMock = rejectIfMockDisabled();
  if (_rejectMock) return _rejectMock;

  const unauthorized = await requireAdminApiAuth();
  if (unauthorized) return unauthorized;

  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Database not configured." },
      { status: 503 }
    );
  }

  const { id } = await params;
  const lodgeSlug = getLodgeSlugFromRequest(request);
  const lodgeId = await db.resolveLodgeId(lodgeSlug);
  if (!lodgeId) {
    return NextResponse.json({ error: "Lodge not found." }, { status: 404 });
  }
  const forbidden = await requireAdminApiPermission("meetings:write", lodgeId);
  if (forbidden) return forbidden;

  const sequence = await db.getMeetingSequenceById(id, lodgeId);
  if (!sequence) {
    return NextResponse.json({ error: "Sequence not found." }, { status: 404 });
  }

  await db.deleteMeetingSequence(id, lodgeId);
  await writeAuditLog({
    lodgeId,
    action: "deleted",
    entityType: "meeting_sequence",
    entityId: id,
    summary: `Deleted meeting sequence ${sequence.name}`,
  });

  return NextResponse.json({ success: true });
}
