// crud-audit:ignore
// Public RSVP submission endpoint. Admin lifecycle management happens via the
// admin event surface; no PATCH/DELETE here by design.
import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import { rejectIfMockDisabled } from "@/lib/db/reject-mock";
import * as db from "@/lib/db";
import * as mockDb from "@/lib/mock-db";
import { getMosqueSlugFromRequest } from "@/lib/tenant";
import { resolveCheckoutFeesForMember } from "@/lib/fees/server-resolve";

export async function POST(request: NextRequest) {
  const _rejectMock = rejectIfMockDisabled();
  if (_rejectMock) return _rejectMock;

  try {
    const mosqueSlug = getMosqueSlugFromRequest(request);
    const body = await request.json();
    const event_id = body.event_id;
    const user_name = body.user_name?.trim();
    const user_email = body.user_email?.trim();
    const user_phone = body.user_phone?.trim() ?? null;
    const attending_ceremony = body.attending_ceremony !== false;
    const attending_dining = body.attending_dining === true;
    const number_of_guests = Math.min(10, Math.max(0, Number(body.number_of_guests) || 0));
    const dietary_requirements = body.dietary_requirements?.trim() ?? null;
    const special_requests = body.special_requests?.trim() ?? null;
    const rawGuests = Array.isArray(body.guests) ? body.guests : [];

    if (!event_id || !user_name || !user_email) {
      return NextResponse.json(
        { error: "Event, name, and email are required." },
        { status: 400 }
      );
    }

    const rsvpData = {
      event_id,
      user_name,
      user_email,
      user_phone,
      attending_ceremony,
      attending_dining,
      number_of_guests,
      dietary_requirements,
      special_requests,
      payment_required: false,
      payment_completed: false,
      payment_id: null,
      status: "confirmed",
    };

    if (isSupabaseConfigured()) {
      const mosqueId = await db.resolveMosqueId(mosqueSlug);
      if (!mosqueId) {
        return NextResponse.json({ error: "Mosque not found." }, { status: 404 });
      }

      // Same defence as the notice access route: when this service has
      // payments enabled and the member owes something, refuse the
      // no-payment branch. The form must route through checkout so the
      // RSVP only lands alongside a settled payment.
      if (attending_ceremony) {
        const event = await db.getEventById(event_id, mosqueId);
        if (event && event.enable_payments) {
          const resolved = await resolveCheckoutFeesForMember({
            mosqueId,
            event,
            memberEmail: user_email,
            attendingCeremony: true,
            attendingDining: attending_dining,
            guests: rawGuests
              .map((g: { guest_name?: string }) => ({
                guest_name: typeof g?.guest_name === "string" ? g.guest_name.trim() : "",
              }))
              .filter((g: { guest_name: string }) => g.guest_name.length > 0),
          });
          if (resolved.total > 0) {
            return NextResponse.json(
              {
                error:
                  "This event requires payment to confirm attendance. Please complete checkout.",
                requires_checkout: true,
                amount_due: resolved.total,
              },
              { status: 402 }
            );
          }
        }
      }

      const rsvp = await db.addRsvp(mosqueId, rsvpData);
      return NextResponse.json({ id: rsvp.id, success: true });
    }

    const rsvp = mockDb.addRsvp({ ...rsvpData, mosque_slug: mosqueSlug });
    return NextResponse.json({ id: rsvp.id, success: true });
  } catch (e) {
    console.error("RSVP API error:", e);
    return NextResponse.json(
      { error: "Something went wrong." },
      { status: 500 }
    );
  }
}
