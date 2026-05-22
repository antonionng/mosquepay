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
import { getLodgeSlugFromRequest } from "@/lib/tenant";
import {
  requireAdminApiAuth,
  requireAdminApiPermission,
} from "@/lib/auth/api";
import { writeAuditLog } from "@/lib/audit";
import { isFeatureEnabled } from "@/lib/feature-flags";
import {
  generateGuestInvitationToken,
  generateVisitorToken,
  hashGuestInvitationToken,
  hashVisitorToken,
} from "@/lib/guest-tokens";
import { sendGuestInviteEmail } from "@/lib/email/guest";
import {
  buildPublicUrl,
  lodgeScopedGuestPath,
  lodgeScopedVisitorPath,
} from "@/lib/public-links";

function buildGuestUrl(request: NextRequest, lodgeSlug: string, token: string) {
  const base = (
    process.env.NEXT_PUBLIC_SITE_URL ?? request.nextUrl.origin
  ).replace(/\/$/, "");
  return buildPublicUrl(base, lodgeScopedGuestPath(lodgeSlug, token));
}

function buildVisitorUrl(request: NextRequest, lodgeSlug: string, token: string) {
  const base = (
    process.env.NEXT_PUBLIC_SITE_URL ?? request.nextUrl.origin
  ).replace(/\/$/, "");
  return buildPublicUrl(base, lodgeScopedVisitorPath(lodgeSlug, token));
}

async function ensureFlag(lodgeId: string | null) {
  const enabled = await isFeatureEnabled(lodgeId, "guest_links");
  if (enabled) return null;
  return NextResponse.json(
    { error: "Guest links are disabled for this lodge." },
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
  const lodgeSlug = getLodgeSlugFromRequest(request);

  if (isSupabaseConfigured()) {
    const lodgeId = await db.resolveLodgeId(lodgeSlug);
    if (!lodgeId) {
      return NextResponse.json({ error: "Lodge not found." }, { status: 404 });
    }
    const forbidden = await requireAdminApiPermission("members:read", lodgeId);
    if (forbidden) return forbidden;
    const flagBlocked = await ensureFlag(lodgeId);
    if (flagBlocked) return flagBlocked;
    const invitations = await db.listGuestInvitationsForGuest(guestId, lodgeId);
    return NextResponse.json({ invitations });
  }

  if (!shouldUseInMemoryMock()) {
    return NextResponse.json({ invitations: [] });
  }
  const invitations = mockDb.listGuestInvitationsForGuest(guestId, {
    lodge_slug: lodgeSlug,
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
  const lodgeSlug = getLodgeSlugFromRequest(request);

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
    const lodgeId = await db.resolveLodgeId(lodgeSlug);
    if (!lodgeId) {
      return NextResponse.json({ error: "Lodge not found." }, { status: 404 });
    }
    const forbidden = await requireAdminApiPermission("meetings:write", lodgeId);
    if (forbidden) return forbidden;
    const flagBlocked = await ensureFlag(lodgeId);
    if (flagBlocked) return flagBlocked;

    const guest = await db.getGuestById(guestId, lodgeId);
    if (!guest) {
      return NextResponse.json({ error: "Guest not found." }, { status: 404 });
    }
    const event = await db.getEventById(eventId, lodgeId);
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

    const invitation = await db.createGuestInvitation(lodgeId, {
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

    let visitorPortalUrl: string | null = null;
    if (!guest.visitor_token_hash) {
      const visitorToken = generateVisitorToken();
      await db.setGuestVisitorTokenHash(
        guest.id,
        lodgeId,
        hashVisitorToken(visitorToken)
      );
      visitorPortalUrl = buildVisitorUrl(request, lodgeSlug, visitorToken);
    }

    const inviteUrl = buildGuestUrl(request, lodgeSlug, token);

    let emailSent = false;
    if (sendEmail && guest.email) {
      const result = await sendGuestInviteEmail({
        toEmail: guest.email,
        toName: guest.full_name,
        lodgeName: (await db.getLodgeById(lodgeId))?.name ?? "the Lodge",
        eventTitle: event.title,
        eventDate: event.event_date,
        eventTime: event.event_time,
        location: event.location,
        dressCode: event.dress_code,
        inviterName: null,
        inviteUrl,
        visitorPortalUrl,
        isFirstTime: guest.visit_count === 0,
      });
      emailSent = Boolean(result.sent);
    }

    await writeAuditLog({
      lodgeId,
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

  const guest = mockDb.getGuestById(guestId, { lodge_slug: lodgeSlug });
  if (!guest) {
    return NextResponse.json({ error: "Guest not found." }, { status: 404 });
  }
  const event = mockDb.getEventById(eventId, { lodge_slug: lodgeSlug });
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
    lodge_slug: lodgeSlug,
    guest_id: guest.id,
  });

  return NextResponse.json({
    invitation,
    url: buildGuestUrl(request, lodgeSlug, token),
    email_sent: false,
  });
}
