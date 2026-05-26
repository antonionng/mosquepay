import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import { rejectIfMockDisabled } from "@/lib/db/reject-mock";
import * as db from "@/lib/db";
import * as mockDb from "@/lib/mock-db";
import { getLodgeSlugFromRequest } from "@/lib/tenant";
import { requireAdminApiAuth, requireAdminApiPermission } from "@/lib/auth/api";
import { writeAuditLog } from "@/lib/audit";
import { filterPubliclyVisible } from "@/lib/events/public-visibility";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const lodgeSlug = getLodgeSlugFromRequest(request);

  if (isSupabaseConfigured()) {
    const lodgeId = await db.resolveLodgeId(lodgeSlug);
    if (!lodgeId) {
      return NextResponse.json([]);
    }
    const events = await db.getEvents(lodgeId, { published: true });
    return NextResponse.json(filterPubliclyVisible(events));
  }

  const _rejectMock = rejectIfMockDisabled();
  if (_rejectMock) return _rejectMock;

  const events = mockDb.getEvents({ lodge_slug: lodgeSlug });
  return NextResponse.json(filterPubliclyVisible(events));
}

export async function POST(request: NextRequest) {
  const _rejectMock = rejectIfMockDisabled();
  if (_rejectMock) return _rejectMock;

  try {
    const unauthorized = await requireAdminApiAuth();
    if (unauthorized) return unauthorized;

    const lodgeSlug = getLodgeSlugFromRequest(request);
    const body = await request.json();
    const title = body.title?.trim();
    const slug = body.slug?.trim()?.toLowerCase().replace(/[^a-z0-9-]/g, "-");
    const event_type = body.event_type ?? "lodge_meeting";
    const event_date = body.event_date;
    if (!title || !slug || !event_date) {
      return NextResponse.json(
        { error: "Title, slug, and event date are required." },
        { status: 400 }
      );
    }

    const eventData = {
      title,
      slug,
      description: body.description?.trim() ?? null,
      event_type,
      event_date: new Date(event_date).toISOString(),
      event_time: body.event_time ?? null,
      location: body.location?.trim() ?? "Mark Masons' Hall",
      temple_room: body.temple_room?.trim() ?? null,
      dress_code: body.dress_code?.trim() ?? null,
      enable_rsvp: body.enable_rsvp !== false,
      rsvp_deadline: body.rsvp_deadline ? new Date(body.rsvp_deadline).toISOString() : null,
      max_attendees: body.max_attendees != null && body.max_attendees !== ""
        ? Number(body.max_attendees)
        : null,
      enable_payments: body.enable_payments === true,
      enable_dining_rsvp: body.enable_dining_rsvp === true,
      dining_price: body.dining_price != null ? Number(body.dining_price) : null,
      dining_description: body.dining_description?.trim() ?? null,
      dining_waived_for_all: body.dining_waived_for_all === true,
      enable_charity_donation: body.enable_charity_donation === true,
      charity_name: body.charity_name?.trim() ?? null,
      charity_description: body.charity_description?.trim() ?? null,
      charity_suggested_amounts: [10, 20, 50, 100],
      charity_allow_custom: true,
      enable_raffle_donation: body.enable_raffle_donation === true,
      raffle_description: body.raffle_description?.trim() ?? "Help fund evening raffle prizes",
      raffle_suggested_amounts: [5, 10, 20, 50],
      raffle_allow_custom: true,
      enable_meeting_fee: body.enable_meeting_fee === true,
      meeting_fee_amount: body.meeting_fee_amount != null ? Number(body.meeting_fee_amount) : null,
      meeting_fee_description: body.meeting_fee_description?.trim() ?? null,
      enable_guest_tickets: body.enable_guest_tickets === true,
      guest_ticket_price: body.guest_ticket_price != null ? Number(body.guest_ticket_price) : null,
      guest_ticket_description: body.guest_ticket_description?.trim() ?? null,
      guest_policy:
        body.guest_policy === "white_table" || body.guest_policy === "closed"
          ? body.guest_policy
          : "blue_table",
      featured_image_url: null,
      created_by: null,
      published: body.published !== false,
      feature_on_website: body.feature_on_website === true,
    } satisfies Omit<
      db.Event,
      | "id"
      | "lodge_id"
      | "created_at"
      | "updated_at"
      | "sequence_id"
      | "sequence_position"
      | "summons_status"
      | "summons_auto_drafted_at"
      | "summons_approved_at"
      | "summons_approved_by_email"
      | "summons_last_sent_at"
    >;

    if (isSupabaseConfigured()) {
      const lodgeId = await db.resolveLodgeId(lodgeSlug);
      if (!lodgeId) {
        return NextResponse.json({ error: "Lodge not found." }, { status: 404 });
      }
      const forbidden = await requireAdminApiPermission("meetings:write", lodgeId);
      if (forbidden) return forbidden;
      const event = await db.addEvent(lodgeId, eventData);
      await writeAuditLog({
        lodgeId,
        action: "created",
        entityType: "meeting",
        entityId: event.id,
        summary: `Created meeting ${event.title}`,
      });
      return NextResponse.json({ id: event.id, success: true });
    }

    const event = mockDb.addEvent({ ...eventData, lodge_slug: lodgeSlug });
    return NextResponse.json({ id: event.id, success: true });
  } catch (e) {
    console.error("Events API error:", e);
    return NextResponse.json(
      { error: "Something went wrong." },
      { status: 500 }
    );
  }
}
