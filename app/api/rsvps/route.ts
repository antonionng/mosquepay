import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import * as db from "@/lib/db";
import * as mockDb from "@/lib/mock-db";
import { getLodgeSlugFromRequest } from "@/lib/tenant";

export async function POST(request: NextRequest) {
  try {
    const lodgeSlug = getLodgeSlugFromRequest(request);
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
      const lodgeId = await db.resolveLodgeId(lodgeSlug);
      if (!lodgeId) {
        return NextResponse.json({ error: "Lodge not found." }, { status: 404 });
      }
      const rsvp = await db.addRsvp(lodgeId, rsvpData);
      return NextResponse.json({ id: rsvp.id, success: true });
    }

    const rsvp = mockDb.addRsvp({ ...rsvpData, lodge_slug: lodgeSlug });
    return NextResponse.json({ id: rsvp.id, success: true });
  } catch (e) {
    console.error("RSVP API error:", e);
    return NextResponse.json(
      { error: "Something went wrong." },
      { status: 500 }
    );
  }
}
