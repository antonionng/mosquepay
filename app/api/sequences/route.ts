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
import {
  getCurrentAdminContextAny,
} from "@/lib/auth/permissions";

function parseMonths(input: unknown): number[] {
  if (!Array.isArray(input)) return [];
  const months = input
    .map((m) => Number(m))
    .filter((m) => Number.isInteger(m) && m >= 1 && m <= 12);
  return Array.from(new Set(months)).sort((a, b) => a - b);
}

function parseInteger(value: unknown, min: number, max: number, fallback: number) {
  const n = Number(value);
  if (!Number.isInteger(n)) return fallback;
  if (n < min || n > max) return fallback;
  return n;
}

function parseWeekOfMonth(value: unknown): number | null {
  const n = Number(value);
  if (!Number.isInteger(n)) return null;
  if (n === -1 || (n >= 1 && n <= 5)) return n;
  return null;
}

function nullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function nullableTrim(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim();
  return t.length > 0 ? t : null;
}

export async function GET(request: NextRequest) {
  const _rejectMock = rejectIfMockDisabled();
  if (_rejectMock) return _rejectMock;

  const unauthorized = await requireAdminApiAuth();
  if (unauthorized) return unauthorized;

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ sequences: [] });
  }

  const lodgeSlug = getLodgeSlugFromRequest(request);
  const lodgeId = await db.resolveLodgeId(lodgeSlug);
  if (!lodgeId) {
    return NextResponse.json({ sequences: [] });
  }

  const sequences = await db.listMeetingSequences(lodgeId);
  return NextResponse.json({ sequences });
}

export async function POST(request: NextRequest) {
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
    const lodgeSlug = getLodgeSlugFromRequest(request);
    const lodgeId = await db.resolveLodgeId(lodgeSlug);
    if (!lodgeId) {
      return NextResponse.json({ error: "Lodge not found." }, { status: 404 });
    }
    const forbidden = await requireAdminApiPermission("meetings:write", lodgeId);
    if (forbidden) return forbidden;

    const body = await request.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) {
      return NextResponse.json(
        { error: "Sequence name is required." },
        { status: 400 }
      );
    }

    const day_of_week = parseInteger(body.day_of_week, 1, 7, 6);
    const week_of_month = parseWeekOfMonth(body.week_of_month);
    const months = parseMonths(body.months);
    if (week_of_month === null) {
      return NextResponse.json(
        { error: "week_of_month must be 1-5 or -1 (last)." },
        { status: 400 }
      );
    }
    if (months.length === 0) {
      return NextResponse.json(
        { error: "Pick at least one month." },
        { status: 400 }
      );
    }

    const admin = await getCurrentAdminContextAny(lodgeId);
    const sequence = await db.createMeetingSequence(lodgeId, {
      name,
      description: nullableTrim(body.description),
      event_type: typeof body.event_type === "string" && body.event_type.trim()
        ? body.event_type.trim()
        : "regular_meeting",
      day_of_week,
      week_of_month,
      months,
      default_event_time: nullableTrim(body.default_event_time),
      default_location: nullableTrim(body.default_location),
      default_temple_room: nullableTrim(body.default_temple_room),
      default_dress_code: nullableTrim(body.default_dress_code),
      default_dining_price: nullableNumber(body.default_dining_price),
      default_meeting_fee_amount: nullableNumber(body.default_meeting_fee_amount),
      default_enable_dining_rsvp: body.default_enable_dining_rsvp === true,
      default_enable_meeting_fee: body.default_enable_meeting_fee === true,
      default_enable_charity_donation: body.default_enable_charity_donation === true,
      default_charity_name: nullableTrim(body.default_charity_name),
      summons_lead_weeks: parseInteger(body.summons_lead_weeks, 1, 26, 6),
      summons_min_lead_weeks: parseInteger(body.summons_min_lead_weeks, 1, 26, 4),
      auto_draft_summons: body.auto_draft_summons !== false,
      active: body.active !== false,
      created_by_email: admin?.email ?? null,
    });

    await writeAuditLog({
      lodgeId,
      action: "created",
      entityType: "meeting_sequence",
      entityId: sequence.id,
      summary: `Created meeting sequence ${sequence.name}`,
    });

    return NextResponse.json({ sequence });
  } catch (error) {
    console.error("Sequences POST error:", error);
    return NextResponse.json(
      { error: "Failed to create sequence." },
      { status: 500 }
    );
  }
}
