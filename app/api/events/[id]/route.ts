import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import { rejectIfMockDisabled } from "@/lib/db/reject-mock";
import * as db from "@/lib/db";
import * as mockDb from "@/lib/mock-db";
import { getLodgeSlugFromRequest } from "@/lib/tenant";
import { requireAdminApiAuth, requireAdminApiPermission } from "@/lib/auth/api";
import { writeAuditLog } from "@/lib/audit";

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
    if (body.title != null) updates.title = body.title.trim();
    if (body.slug != null) updates.slug = body.slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-");
    if (body.description != null) updates.description = body.description.trim() || null;
    if (body.event_type != null) updates.event_type = body.event_type;
    if (body.event_date != null) updates.event_date = new Date(body.event_date).toISOString();
    if ("event_time" in body) updates.event_time = body.event_time || null;
    if (body.location != null) updates.location = body.location.trim() || null;
    if (body.temple_room != null) updates.temple_room = body.temple_room.trim() || null;
    if (body.dress_code != null) updates.dress_code = body.dress_code.trim() || null;
    if (typeof body.enable_rsvp === "boolean") updates.enable_rsvp = body.enable_rsvp;
    if (body.rsvp_deadline != null) updates.rsvp_deadline = body.rsvp_deadline ? new Date(body.rsvp_deadline).toISOString() : null;
    if (body.max_attendees != null) updates.max_attendees = body.max_attendees !== "" ? Number(body.max_attendees) : null;
    if (typeof body.enable_payments === "boolean") updates.enable_payments = body.enable_payments;
    if (typeof body.enable_dining_rsvp === "boolean") updates.enable_dining_rsvp = body.enable_dining_rsvp;
    if ("dining_price" in body) {
      updates.dining_price =
        body.dining_price == null || body.dining_price === "" ? null : Number(body.dining_price);
    }
    if (body.dining_description != null) updates.dining_description = body.dining_description.trim() || null;
    if (typeof body.dining_waived_for_all === "boolean")
      updates.dining_waived_for_all = body.dining_waived_for_all;
    if (typeof body.enable_charity_donation === "boolean") updates.enable_charity_donation = body.enable_charity_donation;
    if (body.charity_name != null) updates.charity_name = body.charity_name.trim() || null;
    if (body.charity_description != null) updates.charity_description = body.charity_description.trim() || null;
    if (Array.isArray(body.charity_suggested_amounts)) {
      updates.charity_suggested_amounts = body.charity_suggested_amounts
        .map((n: unknown) => Number(n))
        .filter((n: number) => Number.isFinite(n) && n > 0);
    }
    if (typeof body.charity_allow_custom === "boolean") {
      updates.charity_allow_custom = body.charity_allow_custom;
    }
    if (typeof body.enable_raffle_donation === "boolean") updates.enable_raffle_donation = body.enable_raffle_donation;
    if (body.raffle_description != null) updates.raffle_description = body.raffle_description.trim() || null;
    if (Array.isArray(body.raffle_suggested_amounts)) {
      updates.raffle_suggested_amounts = body.raffle_suggested_amounts
        .map((n: unknown) => Number(n))
        .filter((n: number) => Number.isFinite(n) && n > 0);
    }
    if (typeof body.raffle_allow_custom === "boolean") {
      updates.raffle_allow_custom = body.raffle_allow_custom;
    }
    if (typeof body.enable_raffle_wine_pledge === "boolean") {
      updates.enable_raffle_wine_pledge = body.enable_raffle_wine_pledge;
    }
    if (body.raffle_wine_description != null) {
      updates.raffle_wine_description =
        body.raffle_wine_description.trim() || null;
    }
    if (typeof body.enable_meeting_fee === "boolean") updates.enable_meeting_fee = body.enable_meeting_fee;
    if ("meeting_fee_amount" in body) {
      updates.meeting_fee_amount =
        body.meeting_fee_amount == null || body.meeting_fee_amount === ""
          ? null
          : Number(body.meeting_fee_amount);
    }
    if (body.meeting_fee_description != null) updates.meeting_fee_description = body.meeting_fee_description.trim() || null;
    if (typeof body.enable_guest_tickets === "boolean") updates.enable_guest_tickets = body.enable_guest_tickets;
    if ("guest_ticket_price" in body) {
      updates.guest_ticket_price =
        body.guest_ticket_price == null || body.guest_ticket_price === ""
          ? null
          : Number(body.guest_ticket_price);
    }
    if (body.guest_ticket_description != null) updates.guest_ticket_description = body.guest_ticket_description.trim() || null;
    if (typeof body.published === "boolean") updates.published = body.published;
    if (typeof body.feature_on_website === "boolean")
      updates.feature_on_website = body.feature_on_website;

    if (isSupabaseConfigured()) {
      const lodgeId = await db.resolveLodgeId(lodgeSlug);
      if (!lodgeId) {
        return NextResponse.json({ error: "Lodge not found." }, { status: 404 });
      }
      const forbidden = await requireAdminApiPermission("meetings:write", lodgeId);
      if (forbidden) return forbidden;
      const updated = await db.updateEvent(id, lodgeId, updates as Parameters<typeof db.updateEvent>[2]);
      if (!updated) {
        return NextResponse.json({ error: "Event not found." }, { status: 404 });
      }
      await writeAuditLog({
        lodgeId,
        action: "updated",
        entityType: "meeting",
        entityId: updated.id,
        summary: `Updated meeting ${updated.title}`,
        metadata: { fields: Object.keys(updates) },
      });
      return NextResponse.json({ success: true });
    }

    const updated = mockDb.updateEvent(id, updates as Parameters<typeof mockDb.updateEvent>[1], {
      lodge_slug: lodgeSlug,
    });

    if (!updated) {
      return NextResponse.json({ error: "Event not found." }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Events PATCH API error:", e);
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
    const updates = {
      published: false,
      updated_at: new Date().toISOString(),
    };

    if (isSupabaseConfigured()) {
      const lodgeId = await db.resolveLodgeId(lodgeSlug);
      if (!lodgeId) {
        return NextResponse.json({ error: "Lodge not found." }, { status: 404 });
      }
      const forbidden = await requireAdminApiPermission("meetings:write", lodgeId);
      if (forbidden) return forbidden;

      const updated = await db.updateEvent(id, lodgeId, updates);
      if (!updated) {
        return NextResponse.json({ error: "Event not found." }, { status: 404 });
      }
      await writeAuditLog({
        lodgeId,
        action: "unpublished",
        entityType: "meeting",
        entityId: updated.id,
        summary: `Unpublished meeting ${updated.title}`,
      });
      return NextResponse.json({ success: true, event: updated });
    }

    const updated = mockDb.updateEvent(id, updates, { lodge_slug: lodgeSlug });
    if (!updated) {
      return NextResponse.json({ error: "Event not found." }, { status: 404 });
    }
    return NextResponse.json({ success: true, event: updated });
  } catch (e) {
    console.error("Events DELETE API error:", e);
    return NextResponse.json(
      { error: "Something went wrong." },
      { status: 500 }
    );
  }
}
