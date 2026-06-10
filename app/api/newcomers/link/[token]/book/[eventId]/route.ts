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
  hashNewcomerToken,
} from "@/lib/guest-tokens";
import { buildPublicUrl, churchScopedGuestPath } from "@/lib/public-links";

function buildGuestUrl(request: NextRequest, churchSlug: string, token: string) {
  const base = (
    process.env.NEXT_PUBLIC_SITE_URL ?? request.nextUrl.origin
  ).replace(/\/$/, "");
  return buildPublicUrl(base, churchScopedGuestPath(churchSlug, token));
}

/**
 * Mint a single-use guest_invitation tied to this guest + event, then return
 * the church-branded guest URL. We re-use the existing checkout flow rather than building a
 * parallel checkout: the form pre-fills from the invitation's
 * recipient_name/recipient_email, so the newcomer confirms dining + dietary
 * + pays in one place.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string; eventId: string }> }
) {
  const { token, eventId } = await params;
  const tokenHash = hashNewcomerToken(token);

  if (isSupabaseConfigured()) {
    const guest = await db.getGuestByNewcomerTokenHash(tokenHash);
    if (!guest) {
      return NextResponse.json(
        { error: "Newcomer profile not found." },
        { status: 404 }
      );
    }
    if (guest.archived_at) {
      return NextResponse.json(
        { error: "This newcomer profile is no longer active." },
        { status: 410 }
      );
    }
    const event = await db.getEventById(eventId, guest.church_id);
    if (!event) {
      return NextResponse.json({ error: "Event not found." }, { status: 404 });
    }
    if (event.guest_policy === "closed") {
      return NextResponse.json(
        { error: "This event does not accept guests." },
        { status: 403 }
      );
    }
    if (event.guest_policy === "blue_table" && !guest.is_member) {
      return NextResponse.json(
        {
          error:
            "This event is for newcomer members only. Please contact the church if you are a member.",
        },
        { status: 403 }
      );
    }

    const newToken = generateGuestInvitationToken();
    const invitation = await db.createGuestInvitation(guest.church_id, {
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

    const church = await db.getChurchById(guest.church_id);

    return NextResponse.json({
      url: buildGuestUrl(request, church?.slug ?? "church", newToken),
      invitation_id: invitation.id,
    });
  }

  if (!shouldUseInMemoryMock()) {
    return NextResponse.json(
      { error: "Database not configured." },
      { status: 503 }
    );
  }

  const guest = mockDb.getGuestByNewcomerTokenHash(tokenHash);
  if (!guest) {
    return NextResponse.json(
      { error: "Newcomer profile not found." },
      { status: 404 }
    );
  }
  const event = mockDb.getEventById(eventId, {
    church_slug: guest.church_slug,
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
  if (event.guest_policy === "blue_table" && !guest.is_member) {
    return NextResponse.json(
      {
        error:
          "This event is for newcomer members only. Please contact the church if you are a member.",
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
    church_slug: guest.church_slug,
    guest_id: guest.id,
  });

  return NextResponse.json({
    url: buildGuestUrl(request, guest.church_slug, newToken),
    invitation_id: invitation.id,
  });
}
