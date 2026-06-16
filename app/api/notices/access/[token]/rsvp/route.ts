import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import * as db from "@/lib/db";
import { sendWinePledgeConfirmationEmail } from "@/lib/email/wine-pledge";
import { resolveCheckoutFeesForMember } from "@/lib/fees/server-resolve";

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
  const accessLink = await db.getServiceNoticeAccessLinkByTokenHash(
    hashToken(token)
  );
  if (!accessLink) {
    return NextResponse.json({ error: "Notice link not found." }, { status: 404 });
  }
  if (accessLink.expires_at && new Date(accessLink.expires_at) < new Date()) {
    return NextResponse.json({ error: "Notice link has expired." }, { status: 410 });
  }

  const event = await db.getEventById(accessLink.event_id, accessLink.mosque_id);
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

  // Defence in depth: never let an attending RSVP land here when the
  // event has payments enabled and the member actually owes something
  // (service fee, dining, guest tickets). The form is supposed to send
  // them through /api/payments/create-checkout-session instead. If they
  // bypass it we refuse with a 402 so the RSVP can only ever land
  // alongside a settled payment via the Mooov webhook.
  if (attendingCeremony && event.enable_payments) {
    const resolved = await resolveCheckoutFeesForMember({
      mosqueId: accessLink.mosque_id,
      event,
      memberEmail: accessLink.recipient_email,
      attendingCeremony: true,
      attendingDining,
      guests: guests.map((g) => ({ guest_name: g.guest_name })),
    });
    if (resolved.total > 0) {
      return NextResponse.json(
        {
          error:
            "This service requires payment to confirm attendance. Please use the Confirm and pay button.",
          requires_checkout: true,
          amount_due: resolved.total,
        },
        { status: 402 }
      );
    }
  }

  // Wine pledge is only honoured when the event has it switched on and the
  // member is actually planning to attend. Bottles is clamped to a sane
  // range so a stray paste of a giant number can't poison the bring-list.
  const winePledgeRequested =
    event.enable_raffle_wine_pledge === true &&
    attendingCeremony &&
    body.raffle_wine_pledged === true;
  const wineBottles = winePledgeRequested
    ? Math.max(
        1,
        Math.min(20, Math.floor(Number(body.raffle_wine_bottles) || 1))
      )
    : 0;
  const wineNote = winePledgeRequested ? trimOrNull(body.raffle_wine_note) : null;

  const existing = await db.getRsvpByEventAndEmail(
    event.id,
    accessLink.recipient_email,
    accessLink.mosque_id
  );

  const wasPledgedBefore = existing?.raffle_wine_pledged === true;
  const shouldEmailWinePledge =
    winePledgeRequested && wineBottles > 0 && !wasPledgedBefore;
  // Capture the values the helper depends on so the closure does not need
  // to rely on control-flow narrowing of outer `const` references (TS does
  // not narrow `event`/`accessLink` inside a nested function declaration).
  const recipientEmail = accessLink.recipient_email;
  const recipientName = accessLink.recipient_name;
  const mosqueIdForEmail = accessLink.mosque_id;
  const eventTitleForEmail = event.title;
  const eventDateForEmail = event.event_date;
  const eventTimeForEmail = event.event_time;
  const eventLocationForEmail = event.location;

  async function maybeSendWinePledgeEmail() {
    if (!shouldEmailWinePledge) return;
    try {
      const mosque = await db.getMosqueById(mosqueIdForEmail);
      await sendWinePledgeConfirmationEmail({
        toEmail: recipientEmail,
        toName: recipientName ?? recipientEmail,
        mosqueName: mosque?.name ?? "your mosque",
        eventTitle: eventTitleForEmail,
        eventDate: eventDateForEmail,
        eventTime: eventTimeForEmail,
        location: eventLocationForEmail,
        bottles: wineBottles,
        note: wineNote,
      });
    } catch (error) {
      console.error("Wine pledge email failed:", error);
    }
  }

  if (existing) {
    const rsvp = await db.updateRsvp(existing.id, accessLink.mosque_id, {
      attending_ceremony: attendingCeremony,
      attending_dining: attendingDining,
      number_of_guests: guests.length,
      dietary_requirements: dietary,
      special_requests: notes,
      status: attendingCeremony ? "confirmed" : "apologies",
      raffle_wine_pledged: winePledgeRequested,
      raffle_wine_bottles: wineBottles,
      raffle_wine_note: wineNote,
    });
    if (rsvp && guests.length > 0) {
      await db.addEventGuests(
        accessLink.mosque_id,
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
    await maybeSendWinePledgeEmail();
    return NextResponse.json({ success: true, rsvp });
  }

  const member =
    (await db.getMemberByEmail(accessLink.recipient_email, accessLink.mosque_id)) ??
    null;

  const rsvp = await db.addRsvp(accessLink.mosque_id, {
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
    raffle_wine_pledged: winePledgeRequested,
    raffle_wine_bottles: wineBottles,
    raffle_wine_note: wineNote,
  });

  if (guests.length > 0) {
    await db.addEventGuests(
      accessLink.mosque_id,
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

  await maybeSendWinePledgeEmail();

  return NextResponse.json({ success: true, rsvp });
}
