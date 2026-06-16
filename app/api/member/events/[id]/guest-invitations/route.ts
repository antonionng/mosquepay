// crud-audit:ignore-update
// Member-issued invitations are immutable; revoke via DELETE on this route.
import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import { rejectIfMockDisabled } from "@/lib/db/reject-mock";
import { createClient } from "@/lib/supabase/server";
import * as db from "@/lib/db";
import {
  generateGuestInvitationToken,
  hashGuestInvitationToken,
} from "@/lib/guest-tokens";
import { buildPublicUrl, mosqueScopedGuestPath } from "@/lib/public-links";
import { sendGuestInviteEmail } from "@/lib/email/guest";

async function buildGuestUrl(request: NextRequest, mosque: db.Mosque | null, token: string) {
  const base = (
    process.env.NEXT_PUBLIC_SITE_URL ?? request.nextUrl.origin
  ).replace(/\/$/, "");
  return buildPublicUrl(base, mosqueScopedGuestPath(mosque?.slug ?? "mosque", token));
}

async function resolveMember() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user?.email) return null;
  const member =
    (await db.getMemberByAuthUserId(user.id)) ??
    (await db.getMemberByEmailAcrossMosques(user.email));
  return member;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ invitations: [] });
  }
  const member = await resolveMember();
  if (!member) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: eventId } = await params;
  const all = await db.listGuestInvitationsForMember(
    member.id,
    member.mosque_id
  );
  const invitations = all.filter((inv) => inv.event_id === eventId);
  return NextResponse.json({ invitations });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const _rejectMock = rejectIfMockDisabled();
  if (_rejectMock) return _rejectMock;

  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Database not configured." },
      { status: 503 }
    );
  }

  const member = await resolveMember();
  if (!member) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: eventId } = await params;

  try {
    const body = await request.json().catch(() => ({}));
    const recipientName = String(body.recipient_name ?? "").trim() || null;
    const recipientEmail = String(body.recipient_email ?? "").trim() || null;
    const payer: "guest" | "inviter" =
      body.payer === "inviter" ? "inviter" : "guest";
    const sendEmail = body.send_email !== false;

    const event = await db.getEventById(eventId, member.mosque_id);
    if (!event) {
      return NextResponse.json({ error: "Event not found." }, { status: 404 });
    }
    if (event.guest_policy === "closed") {
      return NextResponse.json(
        { error: "This event does not accept guests." },
        { status: 403 }
      );
    }

    const token = generateGuestInvitationToken();
    const tokenHash = hashGuestInvitationToken(token);

    const invitation = await db.createGuestInvitation(member.mosque_id, {
      event_id: eventId,
      inviter_member_id: member.id,
      inviter_admin_user_id: null,
      recipient_email: recipientEmail,
      recipient_name: recipientName,
      token_hash: tokenHash,
      payer,
      max_uses: 1,
      expires_at: null,
    });

    const mosque = await db.getMosqueById(member.mosque_id);
    const inviteUrl = await buildGuestUrl(request, mosque, token);

    let emailSent = false;
    if (sendEmail && recipientEmail) {
      const result = await sendGuestInviteEmail({
        toEmail: recipientEmail,
        toName: recipientName ?? recipientEmail,
        mosqueName: mosque?.name ?? "the Mosque",
        eventTitle: event.title,
        eventDate: event.event_date,
        eventTime: event.event_time,
        location: event.location,
        dressCode: event.dress_code,
        inviterName: member.full_name,
        inviteUrl,
      });
      emailSent = Boolean(result.sent);
    }

    return NextResponse.json({
      invitation,
      url: inviteUrl,
      email_sent: emailSent,
    });
  } catch (error) {
    console.error("Member guest invitation POST error:", error);
    return NextResponse.json(
      { error: "Could not create guest link." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const _rejectMock = rejectIfMockDisabled();
  if (_rejectMock) return _rejectMock;

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ success: true });
  }

  const member = await resolveMember();
  if (!member) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: eventId } = await params;
  const url = new URL(request.url);
  const invitationId = url.searchParams.get("invitation_id");
  if (!invitationId) {
    return NextResponse.json(
      { error: "invitation_id is required" },
      { status: 400 }
    );
  }

  const invitation = await db.getGuestInvitationById(
    invitationId,
    member.mosque_id
  );
  if (!invitation || invitation.inviter_member_id !== member.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (invitation.event_id !== eventId) {
    return NextResponse.json({ error: "Mismatched event" }, { status: 400 });
  }
  await db.revokeGuestInvitation(invitationId, member.mosque_id);
  return NextResponse.json({ success: true });
}
