import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import * as db from "@/lib/db";

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function trimOrNull(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed.slice(0, 500) : null;
}

function parseGuests(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((guest) => {
      if (!guest || typeof guest !== "object") return null;
      const row = guest as Record<string, unknown>;
      const name = trimOrNull(row.guest_name);
      if (!name) return null;
      return {
        guest_name: name,
        dietary_requirements: trimOrNull(row.dietary_requirements),
      };
    })
    .filter(
      (guest): guest is { guest_name: string; dietary_requirements: string | null } =>
        guest !== null
    )
    .slice(0, 10);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Database not configured." },
      { status: 503 }
    );
  }

  const { token } = await params;
  const accessLink = await db.getEventSummonsAccessLinkByTokenHash(
    hashToken(token)
  );
  if (!accessLink) {
    return NextResponse.json({ error: "Summons link not found." }, { status: 404 });
  }
  if (accessLink.expires_at && new Date(accessLink.expires_at) < new Date()) {
    return NextResponse.json({ error: "Summons link has expired." }, { status: 410 });
  }

  const event = await db.getEventById(accessLink.event_id, accessLink.lodge_id);
  if (!event) {
    return NextResponse.json({ error: "Event not found." }, { status: 404 });
  }
  if (!event.enable_rsvp) {
    return NextResponse.json(
      { error: "RSVP is not enabled for this event." },
      { status: 400 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const attendingCeremony = Boolean(body.attending_ceremony);
  const attendingDining =
    attendingCeremony && event.enable_dining_rsvp
      ? Boolean(body.attending_dining)
      : false;
  const dietary = trimOrNull(body.dietary_requirements);
  const notes = trimOrNull(body.special_requests);
  const guests = attendingCeremony ? parseGuests(body.guests) : [];
  const existing = await db.getRsvpByEventAndEmail(
    event.id,
    accessLink.recipient_email,
    accessLink.lodge_id
  );

  if (existing) {
    const rsvp = await db.updateRsvp(existing.id, accessLink.lodge_id, {
      attending_ceremony: attendingCeremony,
      attending_dining: attendingDining,
      number_of_guests: guests.length,
      dietary_requirements: dietary,
      special_requests: notes,
      status: attendingCeremony ? "confirmed" : "apologies",
    });
    if (rsvp && guests.length > 0) {
      await db.addEventGuests(
        accessLink.lodge_id,
        guests.map((guest) => ({
          rsvp_id: rsvp.id,
          event_id: event.id,
          guest_name: guest.guest_name,
          dietary_requirements: guest.dietary_requirements,
          email: null,
          phone: null,
          guest_id: null,
          guest_invitation_id: null,
          source: "member_party",
          welcome_email_sent_at: null,
        }))
      );
    }
    return NextResponse.json({ success: true, rsvp });
  }

  const member =
    (await db.getMemberByEmail(accessLink.recipient_email, accessLink.lodge_id)) ??
    null;

  const rsvp = await db.addRsvp(accessLink.lodge_id, {
    event_id: event.id,
    user_name: accessLink.recipient_name ?? member?.full_name ?? accessLink.recipient_email,
    user_email: accessLink.recipient_email,
    user_phone: member?.phone ?? null,
    attending_ceremony: attendingCeremony,
    attending_dining: attendingDining,
    number_of_guests: guests.length,
    dietary_requirements: dietary ?? member?.dietary_requirements ?? null,
    special_requests: notes,
    payment_required: false,
    payment_completed: false,
    payment_id: null,
    status: attendingCeremony ? "confirmed" : "apologies",
  });

  if (guests.length > 0) {
    await db.addEventGuests(
      accessLink.lodge_id,
      guests.map((guest) => ({
        rsvp_id: rsvp.id,
        event_id: event.id,
        guest_name: guest.guest_name,
        dietary_requirements: guest.dietary_requirements,
        email: null,
        phone: null,
        guest_id: null,
        guest_invitation_id: null,
        source: "member_party",
        welcome_email_sent_at: null,
      }))
    );
  }

  return NextResponse.json({ success: true, rsvp });
}
