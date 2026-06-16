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
import { getMosqueSlugFromRequest } from "@/lib/tenant";
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
  mosqueScopedGuestPath,
  mosqueScopedNewcomerPath,
} from "@/lib/public-links";

function buildGuestUrl(request: NextRequest, mosqueSlug: string, token: string) {
  const base = (
    process.env.NEXT_PUBLIC_SITE_URL ?? request.nextUrl.origin
  ).replace(/\/$/, "");
  return buildPublicUrl(base, mosqueScopedGuestPath(mosqueSlug, token));
}

function buildNewcomerUrl(request: NextRequest, mosqueSlug: string, token: string) {
  const base = (
    process.env.NEXT_PUBLIC_SITE_URL ?? request.nextUrl.origin
  ).replace(/\/$/, "");
  return buildPublicUrl(base, mosqueScopedNewcomerPath(mosqueSlug, token));
}

async function ensureFlag(mosqueId: string | null) {
  const enabled = await isFeatureEnabled(mosqueId, "guest_links");
  if (enabled) return null;
  return NextResponse.json(
    { error: "Guest links are disabled for this mosque." },
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
  const mosqueSlug = getMosqueSlugFromRequest(request);

  if (isSupabaseConfigured()) {
    const mosqueId = await db.resolveMosqueId(mosqueSlug);
    if (!mosqueId) {
      return NextResponse.json({ error: "Mosque not found." }, { status: 404 });
    }
    const forbidden = await requireAdminApiPermission("members:read", mosqueId);
    if (forbidden) return forbidden;
    const flagBlocked = await ensureFlag(mosqueId);
    if (flagBlocked) return flagBlocked;
    const invitations = await db.listGuestInvitationsForGuest(guestId, mosqueId);
    return NextResponse.json({ invitations });
  }

  if (!shouldUseInMemoryMock()) {
    return NextResponse.json({ invitations: [] });
  }
  const invitations = mockDb.listGuestInvitationsForGuest(guestId, {
    mosque_slug: mosqueSlug,
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
  const mosqueSlug = getMosqueSlugFromRequest(request);

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
    const mosqueId = await db.resolveMosqueId(mosqueSlug);
    if (!mosqueId) {
      return NextResponse.json({ error: "Mosque not found." }, { status: 404 });
    }
    const forbidden = await requireAdminApiPermission("services:write", mosqueId);
    if (forbidden) return forbidden;
    const flagBlocked = await ensureFlag(mosqueId);
    if (flagBlocked) return flagBlocked;

    const guest = await db.getGuestById(guestId, mosqueId);
    if (!guest) {
      return NextResponse.json({ error: "Guest not found." }, { status: 404 });
    }
    const event = await db.getEventById(eventId, mosqueId);
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

    const invitation = await db.createGuestInvitation(mosqueId, {
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
        mosqueId,
        hashNewcomerToken(newcomerToken)
      );
      newcomerPortalUrl = buildNewcomerUrl(request, mosqueSlug, newcomerToken);
    }

    const inviteUrl = buildGuestUrl(request, mosqueSlug, token);

    let emailSent = false;
    if (sendEmail && guest.email) {
      const result = await sendGuestInviteEmail({
        toEmail: guest.email,
        toName: guest.full_name,
        mosqueName: (await db.getMosqueById(mosqueId))?.name ?? "the Mosque",
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
      mosqueId,
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

  const guest = mockDb.getGuestById(guestId, { mosque_slug: mosqueSlug });
  if (!guest) {
    return NextResponse.json({ error: "Guest not found." }, { status: 404 });
  }
  const event = mockDb.getEventById(eventId, { mosque_slug: mosqueSlug });
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
    mosque_slug: mosqueSlug,
    guest_id: guest.id,
  });

  return NextResponse.json({
    invitation,
    url: buildGuestUrl(request, mosqueSlug, token),
    email_sent: false,
  });
}
