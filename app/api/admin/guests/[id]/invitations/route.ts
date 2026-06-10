// crud-audit:ignore
// Per-guest invitations are immutable; admins revoke via the per-event route.
import { NextRequest, NextResponse } from "next/server";
import {
  isSupabaseConfigured,
  shouldUseInMemoryMock,
} from "@/lib/db/with-fallback";
import { rejectIfMockDisabled } from "@/lib/db/reject-mock";
import * as db from "@/lib/db";
import * as mockDb from "@/lib/mock-db";
import { getChurchSlugFromRequest } from "@/lib/tenant";
import {
  requireAdminApiAuth,
  requireAdminApiPermission,
} from "@/lib/auth/api";
import { writeAuditLog } from "@/lib/audit";
import { isFeatureEnabled } from "@/lib/feature-flags";
import {
  generateGuestInvitationToken,
  generateNewcomerToken,
  hashGuestInvitationToken,
  hashNewcomerToken,
} from "@/lib/guest-tokens";
import { sendGuestInviteEmail } from "@/lib/email/guest";
import {
  buildPublicUrl,
  churchScopedGuestPath,
  churchScopedNewcomerPath,
} from "@/lib/public-links";

function buildGuestUrl(request: NextRequest, churchSlug: string, token: string) {
  const base = (
    process.env.NEXT_PUBLIC_SITE_URL ?? request.nextUrl.origin
  ).replace(/\/$/, "");
  return buildPublicUrl(base, churchScopedGuestPath(churchSlug, token));
}

function buildNewcomerUrl(request: NextRequest, churchSlug: string, token: string) {
  const base = (
    process.env.NEXT_PUBLIC_SITE_URL ?? request.nextUrl.origin
  ).replace(/\/$/, "");
  return buildPublicUrl(base, churchScopedNewcomerPath(churchSlug, token));
}

async function ensureFlag(churchId: string | null) {
  const enabled = await isFeatureEnabled(churchId, "guest_links");
  if (enabled) return null;
  return NextResponse.json(
    { error: "Guest links are disabled for this church." },
    { status: 403 }
  );
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const unauthorized = await requireAdminApiAuth();
  if (unauthorized) return unauthorized;

  const { id: guestId } = await params;
  const churchSlug = getChurchSlugFromRequest(request);

  if (isSupabaseConfigured()) {
    const churchId = await db.resolveChurchId(churchSlug);
    if (!churchId) {
      return NextResponse.json({ error: "Church not found." }, { status: 404 });
    }
    const forbidden = await requireAdminApiPermission("members:read", churchId);
    if (forbidden) return forbidden;
    const flagBlocked = await ensureFlag(churchId);
    if (flagBlocked) return flagBlocked;
    const invitations = await db.listGuestInvitationsForGuest(guestId, churchId);
    return NextResponse.json({ invitations });
  }

  if (!shouldUseInMemoryMock()) {
    return NextResponse.json({ invitations: [] });
  }
  const invitations = mockDb.listGuestInvitationsForGuest(guestId, {
    church_slug: churchSlug,
  });
  return NextResponse.json({ invitations });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const _rejectMock = rejectIfMockDisabled();
  if (_rejectMock) return _rejectMock;

  const unauthorized = await requireAdminApiAuth();
  if (unauthorized) return unauthorized;

  const { id: guestId } = await params;
  const churchSlug = getChurchSlugFromRequest(request);

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const eventId = String(body.event_id ?? "").trim();
  if (!eventId) {
    return NextResponse.json(
      { error: "event_id is required." },
      { status: 400 }
    );
  }
  const payer: "guest" | "inviter" =
    body.payer === "inviter" ? "inviter" : "guest";
  const sendEmail = body.send_email !== false;

  if (isSupabaseConfigured()) {
    const churchId = await db.resolveChurchId(churchSlug);
    if (!churchId) {
      return NextResponse.json({ error: "Church not found." }, { status: 404 });
    }
    const forbidden = await requireAdminApiPermission("services:write", churchId);
    if (forbidden) return forbidden;
    const flagBlocked = await ensureFlag(churchId);
    if (flagBlocked) return flagBlocked;

    const guest = await db.getGuestById(guestId, churchId);
    if (!guest) {
      return NextResponse.json({ error: "Guest not found." }, { status: 404 });
    }
    const event = await db.getEventById(eventId, churchId);
    if (!event) {
      return NextResponse.json({ error: "Event not found." }, { status: 404 });
    }
    if (event.guest_policy === "closed") {
      return NextResponse.json(
        {
          error:
            "This event does not accept guests. Update the guest policy first.",
        },
        { status: 400 }
      );
    }

    const token = generateGuestInvitationToken();
    const tokenHash = hashGuestInvitationToken(token);

    const invitation = await db.createGuestInvitation(churchId, {
      event_id: eventId,
      inviter_member_id: null,
      inviter_admin_user_id: null,
      recipient_email: guest.email,
      recipient_name: guest.full_name,
      token_hash: tokenHash,
      payer,
      max_uses: 1,
      expires_at: null,
      guest_id: guest.id,
    });

    let newcomerPortalUrl: string | null = null;
    if (!guest.newcomer_token_hash) {
      const newcomerToken = generateNewcomerToken();
      await db.setGuestNewcomerTokenHash(
        guest.id,
        churchId,
        hashNewcomerToken(newcomerToken)
      );
      newcomerPortalUrl = buildNewcomerUrl(request, churchSlug, newcomerToken);
    }

    const inviteUrl = buildGuestUrl(request, churchSlug, token);

    let emailSent = false;
    if (sendEmail && guest.email) {
      const result = await sendGuestInviteEmail({
        toEmail: guest.email,
        toName: guest.full_name,
        churchName: (await db.getChurchById(churchId))?.name ?? "the Church",
        eventTitle: event.title,
        eventDate: event.event_date,
        eventTime: event.event_time,
        location: event.location,
        dressCode: event.dress_code,
        inviterName: null,
        inviteUrl,
        newcomerPortalUrl,
        isFirstTime: guest.visit_count === 0,
      });
      emailSent = Boolean(result.sent);
    }

    await writeAuditLog({
      churchId,
      action: "created",
      entityType: "guest_invitation",
      entityId: invitation.id,
      summary: `Invited guest ${guest.full_name} to ${event.title}`,
      metadata: {
        guest_id: guest.id,
        email_sent: emailSent,
        payer,
      },
    });

    return NextResponse.json({
      invitation,
      url: inviteUrl,
      email_sent: emailSent,
    });
  }

  const guest = mockDb.getGuestById(guestId, { church_slug: churchSlug });
  if (!guest) {
    return NextResponse.json({ error: "Guest not found." }, { status: 404 });
  }
  const event = mockDb.getEventById(eventId, { church_slug: churchSlug });
  if (!event) {
    return NextResponse.json({ error: "Event not found." }, { status: 404 });
  }
  if (event.guest_policy === "closed") {
    return NextResponse.json(
      {
        error:
          "This event does not accept guests. Update the guest policy first.",
      },
      { status: 400 }
    );
  }

  const token = generateGuestInvitationToken();
  const tokenHash = hashGuestInvitationToken(token);
  const invitation = mockDb.createGuestInvitation({
    event_id: eventId,
    inviter_member_id: null,
    inviter_admin_user_id: null,
    recipient_email: guest.email,
    recipient_name: guest.full_name,
    token_hash: tokenHash,
    payer,
    max_uses: 1,
    expires_at: null,
    church_slug: churchSlug,
    guest_id: guest.id,
  });

  return NextResponse.json({
    invitation,
    url: buildGuestUrl(request, churchSlug, token),
    email_sent: false,
  });
}
