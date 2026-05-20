// crud-audit:ignore-update
// Invitations are immutable once issued; revoke via DELETE on [invitationId].
import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured, shouldUseInMemoryMock } from "@/lib/db/with-fallback";
import { rejectIfMockDisabled } from "@/lib/db/reject-mock";
import * as db from "@/lib/db";
import * as mockDb from "@/lib/mock-db";
import { getLodgeSlugFromRequest } from "@/lib/tenant";
import {
  requireAdminApiAuth,
  requireAdminApiPermission,
} from "@/lib/auth/api";
import { writeAuditLog } from "@/lib/audit";
import {
  generateGuestInvitationToken,
  hashGuestInvitationToken,
} from "@/lib/guest-tokens";
import { buildPublicUrl, lodgeScopedGuestPath } from "@/lib/public-links";

function buildGuestUrl(request: NextRequest, lodgeSlug: string, token: string) {
  const base = (
    process.env.NEXT_PUBLIC_SITE_URL ?? request.nextUrl.origin
  ).replace(/\/$/, "");
  return buildPublicUrl(base, lodgeScopedGuestPath(lodgeSlug, token));
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const unauthorized = await requireAdminApiAuth();
  if (unauthorized) return unauthorized;

  const { id: eventId } = await params;
  const lodgeSlug = getLodgeSlugFromRequest(request);

  if (isSupabaseConfigured()) {
    const lodgeId = await db.resolveLodgeId(lodgeSlug);
    if (!lodgeId) {
      return NextResponse.json({ error: "Lodge not found." }, { status: 404 });
    }
    const forbidden = await requireAdminApiPermission("meetings:write", lodgeId);
    if (forbidden) return forbidden;

    const invitations = await db.listGuestInvitationsForEvent(eventId, lodgeId);
    return NextResponse.json({ invitations });
  }

  if (!shouldUseInMemoryMock()) {
    return NextResponse.json({ invitations: [] });
  }

  const invitations = mockDb.listGuestInvitationsForEvent(eventId, {
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

  const { id: eventId } = await params;
  const lodgeSlug = getLodgeSlugFromRequest(request);

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

    const token = generateGuestInvitationToken();
    const tokenHash = hashGuestInvitationToken(token);

    if (isSupabaseConfigured()) {
      const lodgeId = await db.resolveLodgeId(lodgeSlug);
      if (!lodgeId) {
        return NextResponse.json({ error: "Lodge not found." }, { status: 404 });
      }
      const forbidden = await requireAdminApiPermission("meetings:write", lodgeId);
      if (forbidden) return forbidden;

      const event = await db.getEventById(eventId, lodgeId);
      if (!event) {
        return NextResponse.json({ error: "Event not found." }, { status: 404 });
      }
      if (event.guest_policy === "closed") {
        return NextResponse.json(
          { error: "This event does not accept guest links. Set a guest policy first." },
          { status: 400 }
        );
      }

      const invitation = await db.createGuestInvitation(lodgeId, {
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

      await writeAuditLog({
        lodgeId,
        action: "created",
        entityType: "guest_invitation",
        entityId: invitation.id,
        summary: `Generated guest link for ${event.title}`,
      });

      return NextResponse.json({
        invitation,
        url: buildGuestUrl(request, lodgeSlug, token),
      });
    }

    if (!shouldUseInMemoryMock()) {
      return NextResponse.json(
        { error: "Database not configured." },
        { status: 503 }
      );
    }

    const event = mockDb.getEventById(eventId, { lodge_slug: lodgeSlug });
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
      lodge_slug: lodgeSlug,
    });

    return NextResponse.json({
      invitation,
      url: buildGuestUrl(request, lodgeSlug, token),
    });
  } catch (error) {
    console.error("Guest invitation POST error:", error);
    return NextResponse.json(
      { error: "Could not create guest link." },
      { status: 500 }
    );
  }
}
