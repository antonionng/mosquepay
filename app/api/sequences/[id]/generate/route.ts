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
import { generateSequenceDates } from "@/lib/meetings/sequences";
import type { Event } from "@/lib/db/types";

type Params = { params: Promise<{ id: string }> };

const MONTH_SHORT: Record<number, string> = {
  1: "jan",
  2: "feb",
  3: "mar",
  4: "apr",
  5: "may",
  6: "jun",
  7: "jul",
  8: "aug",
  9: "sep",
  10: "oct",
  11: "nov",
  12: "dec",
};

function buildSlug(name: string, year: number, month: number): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${base}-${MONTH_SHORT[month] ?? String(month)}-${year}`;
}

function ensureUniqueSlug(slug: string, taken: Set<string>): string {
  if (!taken.has(slug)) return slug;
  let i = 2;
  while (taken.has(`${slug}-${i}`)) i++;
  return `${slug}-${i}`;
}

export async function POST(request: NextRequest, { params }: Params) {
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

    const sequence = await db.getMeetingSequenceById(id, lodgeId);
    if (!sequence) {
      return NextResponse.json(
        { error: "Sequence not found." },
        { status: 404 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const startInput = typeof body.start_date === "string" ? body.start_date : null;
    const endInput = typeof body.end_date === "string" ? body.end_date : null;
    if (!startInput || !endInput) {
      return NextResponse.json(
        { error: "start_date and end_date are required (YYYY-MM-DD)." },
        { status: 400 }
      );
    }
    const startDate = new Date(`${startInput}T00:00:00.000Z`);
    const endDate = new Date(`${endInput}T23:59:59.000Z`);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      return NextResponse.json(
        { error: "Invalid start or end date." },
        { status: 400 }
      );
    }

    const dates = generateSequenceDates(sequence, startDate, endDate);
    if (dates.length === 0) {
      return NextResponse.json({ created: [], skipped: [] });
    }

    const existingEvents = await db.getEvents(lodgeId);
    const existingSlugs = new Set(existingEvents.map((event) => event.slug));
    const existingForSequence = await db.getEventsBySequenceId(id, lodgeId);
    const datesAlreadyTaken = new Set(
      existingForSequence.map((event) => event.event_date.slice(0, 10))
    );

    const created: Array<Pick<Event, "id" | "slug" | "event_date">> = [];
    const skipped: Array<{ date: string; reason: string }> = [];

    for (const candidate of dates) {
      if (datesAlreadyTaken.has(candidate.date)) {
        skipped.push({
          date: candidate.date,
          reason: "Already generated for this date.",
        });
        continue;
      }

      const slug = ensureUniqueSlug(
        buildSlug(sequence.name, candidate.year, candidate.month),
        existingSlugs
      );
      existingSlugs.add(slug);

      const event = await db.addEvent(lodgeId, {
        title: `${sequence.name} (${MONTH_SHORT[candidate.month]?.toUpperCase() ?? candidate.month} ${candidate.year})`,
        slug,
        description: sequence.description,
        event_type: sequence.event_type,
        event_date: candidate.iso,
        event_time: sequence.default_event_time,
        location: sequence.default_location ?? "Mark Masons' Hall",
        temple_room: sequence.default_temple_room,
        dress_code: sequence.default_dress_code,
        enable_rsvp: true,
        rsvp_deadline: null,
        max_attendees: null,
        enable_payments:
          sequence.default_enable_dining_rsvp ||
          sequence.default_enable_meeting_fee ||
          sequence.default_enable_raffle_donation,
        enable_dining_rsvp: sequence.default_enable_dining_rsvp,
        dining_price: sequence.default_dining_price,
        dining_description: null,
        enable_charity_donation: sequence.default_enable_charity_donation,
        charity_name: sequence.default_charity_name,
        charity_description: null,
        charity_suggested_amounts: [10, 20, 50, 100],
        charity_allow_custom: true,
        enable_raffle_donation: sequence.default_enable_raffle_donation,
        raffle_description: sequence.default_raffle_description,
        raffle_suggested_amounts: sequence.default_enable_raffle_donation
          ? [5, 10, 20, 50]
          : null,
        raffle_allow_custom: sequence.default_enable_raffle_donation,
        enable_raffle_wine_pledge: sequence.default_enable_raffle_wine_pledge,
        raffle_wine_description: sequence.default_raffle_wine_description,
        enable_meeting_fee: sequence.default_enable_meeting_fee,
        meeting_fee_amount: sequence.default_meeting_fee_amount,
        meeting_fee_description: null,
        enable_guest_tickets: false,
        guest_ticket_price: null,
        guest_ticket_description: null,
        guest_policy: "blue_table",
        featured_image_url: null,
        created_by: null,
        published: false,
        feature_on_website: false,
        sequence_id: sequence.id,
        sequence_position: candidate.position,
        summons_status: "none",
        summons_auto_drafted_at: null,
        summons_approved_at: null,
        summons_approved_by_email: null,
        summons_last_sent_at: null,
      });

      created.push({ id: event.id, slug: event.slug, event_date: event.event_date });
    }

    await writeAuditLog({
      lodgeId,
      action: "generated",
      entityType: "meeting_sequence",
      entityId: sequence.id,
      summary: `Generated ${created.length} meeting${created.length === 1 ? "" : "s"} from sequence ${sequence.name}`,
      metadata: { created: created.length, skipped: skipped.length },
    });

    return NextResponse.json({ created, skipped });
  } catch (error) {
    console.error("Sequence generate error:", error);
    return NextResponse.json(
      { error: "Failed to generate meetings." },
      { status: 500 }
    );
  }
}
