// crud-audit:ignore-update
// Invitations are immutable once issued; revoke via DELETE on [invitationId].
import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured, shouldUseInMemoryMock } from "@/lib/db/with-fallback";
import { rejectIfMockDisabled } from "@/lib/db/reject-mock";
import * as db from "@/lib/db";
import * as mockDb from "@/lib/mock-db";
import { getMosqueSlugFromRequest } from "@/lib/tenant";
import {
  requireAdminApiAuth,
  requireAdminApiPermission,
} from "@/lib/auth/api";
import { writeAuditLog } from "@/lib/audit";
import {
  generateGuestInvitationToken,
  hashGuestInvitationToken,
} from "@/lib/guest-tokens";
import { buildPublicUrl, mosqueScopedGuestPath } from "@/lib/public-links";
import { sendGuestInviteEmail } from "@/lib/email/guest";

function buildGuestUrl(request: NextRequest, mosqueSlug: string, token: string) {
  const base = (
    process.env.NEXT_PUBLIC_SITE_URL ?? request.nextUrl.origin
  ).replace(/\/$/, "");
  return buildPublicUrl(base, mosqueScopedGuestPath(mosqueSlug, token));
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const unauthorized = await requireAdminApiAuth();
  if (unauthorized) return unauthorized;

  const { id: eventId } = await params;
  const mosqueSlug = getMosqueSlugFromRequest(request);

  if (isSupabaseConfigured()) {
    const mosqueId = await db.resolveMosqueId(mosqueSlug);
    if (!mosqueId) {
      return NextResponse.json({ error: "Mosque not found." }, { status: 404 });
    }
    const forbidden = await requireAdminApiPermission("services:write", mosqueId);
    if (forbidden) return forbidden;

    const invitations = await db.listGuestInvitationsForEvent(eventId, mosqueId);
    return NextResponse.json({ invitations });
  }

  if (!shouldUseInMemoryMock()) {
    return NextResponse.json({ invitations: [] });
  }

  const invitations = mockDb.listGuestInvitationsForEvent(eventId, {
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

  const { id: eventId } = await params;
  const mosqueSlug = getMosqueSlugFromRequest(request);

  try {
    const body = await request.json().catch(() => ({}));
    const recipientName = String(body.recipient_name ?? "").trim() || null;
    const recipientEmail = String(body.recipient_email ?? "").trim() || null;
    const payer: "guest" | "inviter" =
      body.payer === "inviter" ? "inviter" : "guest";
    const maxUses =
      body.max_uses == null || body.max_uses === ""
        ? null
        : Math.max(0, Number(body.max_uses));
    const expiresAt = body.expires_at
      ? new Date(body.expires_at).toISOString()
      : null;
    const sendEmail = body.send_email !== false;

    const token = generateGuestInvitationToken();
    const tokenHash = hashGuestInvitationToken(token);

    if (isSupabaseConfigured()) {
      const mosqueId = await db.resolveMosqueId(mosqueSlug);
      if (!mosqueId) {
        return NextResponse.json({ error: "Mosque not found." }, { status: 404 });
      }
      const forbidden = await requireAdminApiPermission("services:write", mosqueId);
      if (forbidden) return forbidden;

      const event = await db.getEventById(eventId, mosqueId);
      if (!event) {
        return NextResponse.json({ error: "Event not found." }, { status: 404 });
      }
      if (event.guest_policy === "closed") {
        return NextResponse.json(
          { error: "This event does not accept guest links. Set a guest policy first." },
          { status: 400 }
        );
      }

      const invitation = await db.createGuestInvitation(mosqueId, {
        event_id: eventId,
        inviter_member_id: null,
        inviter_admin_user_id: null,
        recipient_email: recipientEmail,
        recipient_name: recipientName,
        token_hash: tokenHash,
        payer,
        max_uses: maxUses,
        expires_at: expiresAt,
      });

      const inviteUrl = buildGuestUrl(request, mosqueSlug, token);
      let emailSent = false;
      if (sendEmail && recipientEmail) {
        const mosque = await db.getMosqueById(mosqueId);
        const result = await sendGuestInviteEmail({
          toEmail: recipientEmail,
          toName: recipientName ?? recipientEmail,
          mosqueName: mosque?.name ?? mosqueSlug,
          eventTitle: event.title,
          eventDate: event.event_date,
          eventTime: event.event_time,
          location: event.location,
          dressCode: event.dress_code,
          inviterName: null,
          inviteUrl,
        });
        emailSent = Boolean(result.sent);
      }

      await writeAuditLog({
        mosqueId,
        action: "created",
        entityType: "guest_invitation",
        entityId: invitation.id,
        summary: `Generated guest link for ${event.title}`,
        metadata: { email_sent: emailSent, payer },
      });

      return NextResponse.json({
        invitation,
        url: inviteUrl,
        email_sent: emailSent,
      });
    }

    if (!shouldUseInMemoryMock()) {
      return NextResponse.json(
        { error: "Database not configured." },
        { status: 503 }
      );
    }

    const event = mockDb.getEventById(eventId, { mosque_slug: mosqueSlug });
    if (!event) {
      return NextResponse.json({ error: "Event not found." }, { status: 404 });
    }
    if (event.guest_policy === "closed") {
      return NextResponse.json(
        { error: "This event does not accept guest links. Set a guest policy first." },
        { status: 400 }
      );
    }

    const invitation = mockDb.createGuestInvitation({
      event_id: eventId,
      inviter_member_id: null,
      inviter_admin_user_id: null,
      recipient_email: recipientEmail,
      recipient_name: recipientName,
      token_hash: tokenHash,
      payer,
      max_uses: maxUses,
      expires_at: expiresAt,
      mosque_slug: mosqueSlug,
    });

    return NextResponse.json({
      invitation,
      url: buildGuestUrl(request, mosqueSlug, token),
      email_sent: false,
    });
  } catch (error) {
    console.error("Guest invitation POST error:", error);
    return NextResponse.json(
      { error: "Could not create guest link." },
      { status: 500 }
    );
  }
}
