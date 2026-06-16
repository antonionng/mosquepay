// crud-audit:ignore
// Member-side RSVP submission. Lives as a single POST against the parent
// event; admin RSVP management uses /api/rsvps and /api/admin endpoints.
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import * as db from "@/lib/db";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Database not configured." }, { status: 503 });
  }
  const { id: eventId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user || !user.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const member =
    (await db.getMemberByAuthUserId(user.id)) ??
    (await db.getMemberByEmailAcrossMosques(user.email));
  if (!member) {
    return NextResponse.json({ error: "Member profile not found." }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const attendingCeremony = Boolean(body.attending_ceremony);
  const attendingDining = body.attending_dining === undefined
    ? attendingCeremony
    : Boolean(body.attending_dining);
  const guests = Math.min(
    10,
    Math.max(0, Number(body.number_of_guests ?? 0) || 0)
  );
  const reason: string | null = body.reason
    ? String(body.reason).trim().slice(0, 280) || null
    : null;
  const dietary: string | null = body.dietary_requirements
    ? String(body.dietary_requirements).trim().slice(0, 280) || null
    : member.dietary_requirements ?? null;

  const event = await db.getEventById(eventId, member.mosque_id);
  if (!event) {
    return NextResponse.json({ error: "Event not found." }, { status: 404 });
  }
  if (!event.enable_rsvp) {
    return NextResponse.json(
      { error: "RSVP is not enabled for this event." },
      { status: 400 }
    );
  }

  const existing = await db.getRsvpByEventAndEmail(
    eventId,
    member.email,
    member.mosque_id
  );

  let rsvp = null;
  if (existing) {
    rsvp = await db.updateRsvp(existing.id, member.mosque_id, {
      attending_ceremony: attendingCeremony,
      attending_dining: attendingCeremony ? attendingDining : false,
      number_of_guests: attendingCeremony ? guests : 0,
      dietary_requirements: dietary,
      special_requests: reason,
      status: attendingCeremony ? "confirmed" : "apologies",
    });
  } else {
    rsvp = await db.addRsvp(member.mosque_id, {
      event_id: eventId,
      user_name: member.full_name,
      user_email: member.email,
      user_phone: member.phone,
      attending_ceremony: attendingCeremony,
      attending_dining: attendingCeremony ? attendingDining : false,
      number_of_guests: attendingCeremony ? guests : 0,
      dietary_requirements: dietary,
      special_requests: reason,
      payment_required: false,
      payment_completed: false,
      payment_id: null,
      status: attendingCeremony ? "confirmed" : "apologies",
    });
  }

  return NextResponse.json({ success: true, rsvp });
}
