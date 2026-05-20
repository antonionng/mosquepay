import { NextRequest, NextResponse } from "next/server";
import {
  isSupabaseConfigured,
  shouldUseInMemoryMock,
} from "@/lib/db/with-fallback";
import * as db from "@/lib/db";
import * as mockDb from "@/lib/mock-db";
import {
  generateGuestInvitationToken,
  hashGuestInvitationToken,
  hashVisitorToken,
} from "@/lib/guest-tokens";
import { buildPublicUrl, lodgeScopedGuestPath } from "@/lib/public-links";

function buildGuestUrl(request: NextRequest, lodgeSlug: string, token: string) {
  const base = (
    process.env.NEXT_PUBLIC_SITE_URL ?? request.nextUrl.origin
  ).replace(/\/$/, "");
  return buildPublicUrl(base, lodgeScopedGuestPath(lodgeSlug, token));
}

/**
 * Mint a single-use guest_invitation tied to this guest + event, then return
 * the lodge-branded guest URL. We re-use the existing checkout flow rather than building a
 * parallel checkout: the form pre-fills from the invitation's
 * recipient_name/recipient_email, so the visitor confirms dining + dietary
 * + pays in one place.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string; eventId: string }> }
) {
  const { token, eventId } = await params;
  const tokenHash = hashVisitorToken(token);

  if (isSupabaseConfigured()) {
    const guest = await db.getGuestByVisitorTokenHash(tokenHash);
    if (!guest) {
      return NextResponse.json(
        { error: "Visitor profile not found." },
        { status: 404 }
      );
    }
    if (guest.archived_at) {
      return NextResponse.json(
        { error: "This visitor profile is no longer active." },
        { status: 410 }
      );
    }
    const event = await db.getEventById(eventId, guest.lodge_id);
    if (!event) {
      return NextResponse.json({ error: "Event not found." }, { status: 404 });
    }
    if (event.guest_policy === "closed") {
      return NextResponse.json(
        { error: "This event does not accept guests." },
        { status: 403 }
      );
    }
    if (event.guest_policy === "blue_table" && !guest.is_mason) {
      return NextResponse.json(
        {
          error:
            "This event is for visiting brethren only. Please contact the lodge if you are a Mason.",
        },
        { status: 403 }
      );
    }

    const newToken = generateGuestInvitationToken();
    const invitation = await db.createGuestInvitation(guest.lodge_id, {
      event_id: eventId,
      inviter_member_id: null,
      inviter_admin_user_id: null,
      recipient_email: guest.email,
      recipient_name: guest.full_name,
      token_hash: hashGuestInvitationToken(newToken),
      payer: "guest",
      max_uses: 1,
      expires_at: null,
      guest_id: guest.id,
    });

    const lodge = await db.getLodgeById(guest.lodge_id);

    return NextResponse.json({
      url: buildGuestUrl(request, lodge?.slug ?? "lodge", newToken),
      invitation_id: invitation.id,
    });
  }

  if (!shouldUseInMemoryMock()) {
    return NextResponse.json(
      { error: "Database not configured." },
      { status: 503 }
    );
  }

  const guest = mockDb.getGuestByVisitorTokenHash(tokenHash);
  if (!guest) {
    return NextResponse.json(
      { error: "Visitor profile not found." },
      { status: 404 }
    );
  }
  const event = mockDb.getEventById(eventId, {
    lodge_slug: guest.lodge_slug,
  });
  if (!event) {
    return NextResponse.json({ error: "Event not found." }, { status: 404 });
  }
  if (event.guest_policy === "closed") {
    return NextResponse.json(
      { error: "This event does not accept guests." },
      { status: 403 }
    );
  }
  if (event.guest_policy === "blue_table" && !guest.is_mason) {
    return NextResponse.json(
      {
        error:
          "This event is for visiting brethren only. Please contact the lodge if you are a Mason.",
      },
      { status: 403 }
    );
  }

  const newToken = generateGuestInvitationToken();
  const invitation = mockDb.createGuestInvitation({
    event_id: eventId,
    inviter_member_id: null,
    inviter_admin_user_id: null,
    recipient_email: guest.email,
    recipient_name: guest.full_name,
    token_hash: hashGuestInvitationToken(newToken),
    payer: "guest",
    max_uses: 1,
    expires_at: null,
    lodge_slug: guest.lodge_slug,
    guest_id: guest.id,
  });

  return NextResponse.json({
    url: buildGuestUrl(request, guest.lodge_slug, newToken),
    invitation_id: invitation.id,
  });
}
