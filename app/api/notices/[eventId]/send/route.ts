import { NextRequest, NextResponse } from "next/server";
import { createHash, randomBytes } from "crypto";
import { requireAdminApiAuth, requireAdminApiPermission } from "@/lib/auth/api";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import * as db from "@/lib/db";
import { getChurchSlugFromRequest } from "@/lib/tenant";
import { writeAuditLog } from "@/lib/audit";
import {
  generateGuestInvitationToken,
  hashGuestInvitationToken,
} from "@/lib/guest-tokens";
import { buildPublicUrl, churchScopedGuestPath } from "@/lib/public-links";
import { sendGuestInviteEmail } from "@/lib/email/guest";
import { renderNoticeEmail } from "@/lib/email/templates";
import { sendWithLog } from "@/lib/email/send-with-log";
import { defaultAgendaItems, renderDefaultNoticeOpening } from "@/lib/notices/defaults";

type Params = { params: Promise<{ eventId: string }> };
type NoticeRecipient = { email: string; full_name: string };

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function POST(request: NextRequest, { params }: Params) {
  const unauthorized = await requireAdminApiAuth();
  if (unauthorized) return unauthorized;

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Database not configured." }, { status: 503 });
  }

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: "RESEND_API_KEY is not configured." }, { status: 503 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const testRecipientEmail =
      typeof body.test_recipient_email === "string"
        ? body.test_recipient_email.trim().toLowerCase()
        : "";
    const testRecipientName =
      typeof body.test_recipient_name === "string"
        ? body.test_recipient_name.trim()
        : "";
    const { eventId } = await params;
    const churchSlug = getChurchSlugFromRequest(request);
    const churchId = await db.resolveChurchId(churchSlug);
    if (!churchId) {
      return NextResponse.json({ error: "Church not found." }, { status: 404 });
    }
    const forbidden = await requireAdminApiPermission("notice:write", churchId);
    if (forbidden) return forbidden;

    const [event, church, notice, members, feeDefaults] = await Promise.all([
      db.getEventById(eventId, churchId),
      db.getChurchById(churchId),
      db.getServiceNotice(eventId, churchId),
      db.getMembers(churchId, { status: "active" }),
      db.getChurchFeeDefaults(churchId),
    ]);

    if (!event) {
      return NextResponse.json({ error: "Service not found." }, { status: 404 });
    }

    // Hard guard: a notice must have been explicitly approved by an admin
    // before it can be sent to the membership. Test sends bypass this so an
    // admin can still email themselves a preview.
    const status = event.notice_status ?? "none";
    if (!testRecipientEmail && status !== "approved" && status !== "sent") {
      return NextResponse.json(
        {
          error:
            "Notice has not been approved for sending. Open the notice editor and approve it first.",
          notice_status: status,
        },
        { status: 409 }
      );
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? request.nextUrl.origin;
    const recipients: NoticeRecipient[] = testRecipientEmail
      ? [
          {
            email: testRecipientEmail,
            full_name: testRecipientName || testRecipientEmail,
          },
        ]
      : members.map((member) => ({
          email: member.email,
          full_name: member.full_name,
        }));
    const venue = [event.location, event.temple_room].filter(Boolean).join(", ");
    const agendaItems = notice?.agenda_items?.length
      ? notice.agenda_items
      : defaultAgendaItems();
    const openingText = notice?.opening_text ?? renderDefaultNoticeOpening(event, church);
    const menuItems = notice?.menu_items ?? [];
    const notices = notice?.notices ?? [];
    const failures: Array<{ email: string; message: string }> = [];
    const testUrls: Array<{ email: string; notice_url: string; rsvp_url: string }> = [];
    let sentCount = 0;

    for (const member of recipients) {
      try {
        const token = randomBytes(32).toString("base64url");
        const noticeUrl = `${siteUrl}/notice/${token}`;
        const rsvpUrl = `${noticeUrl}#rsvp`;
        if (testRecipientEmail) {
          testUrls.push({
            email: member.email,
            notice_url: noticeUrl,
            rsvp_url: rsvpUrl,
          });
        }
        await db.createServiceNoticeAccessLink(churchId, {
          event_id: event.id,
          notice_id: notice?.id ?? null,
          send_id: null,
          recipient_email: member.email,
          recipient_name: member.full_name,
          token_hash: hashToken(token),
          expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
        });

        const result = await sendWithLog({
          churchId,
          toEmail: member.email,
          toName: member.full_name,
          emailType: "notice_member",
          entityType: "event",
          entityId: event.id,
          // Notice sends are admin-triggered; per-event re-sends are
          // legitimate. We do NOT dedupe on event_id alone or a re-
          // send after a typo would silently no-op.
          dedupeKey: null,
          subject: `${testRecipientEmail ? "[Test] " : ""}Notice: ${event.title}`,
          html: renderNoticeEmail({
            memberName: member.full_name,
            churchName: church?.name ?? "your church",
            eventTitle: event.title,
            eventDate: event.event_date,
            venue,
            openingText,
            noticeUrl,
            rsvpUrl,
            agendaItems,
            menuItems,
            notices,
            serviceLeadName: notice?.service_lead_name ?? null,
            serviceLeadRole: notice?.service_lead_role ?? null,
            newcomerContacts: notice?.newcomer_contacts ?? [],
            newcomerContactName: notice?.newcomer_contact_name ?? null,
            newcomerContactEmail: notice?.newcomer_contact_email ?? null,
            newcomerContactPhone: notice?.newcomer_contact_phone ?? null,
            nextServiceDate: notice?.next_service_date ?? null,
            nextServiceNote: notice?.next_service_note ?? null,
          }),
          metadata: {
            event_title: event.title,
            event_date: event.event_date,
            is_test: Boolean(testRecipientEmail),
          },
        });

        if (!result.ok) {
          throw new Error(result.error);
        }
        sentCount++;
      } catch (emailError) {
        failures.push({
          email: member.email,
          message:
            emailError instanceof Error
              ? emailError.message
              : "Unknown email send error",
        });
      }
    }

    let honoraryGuestInvitesSent = 0;

    if (!testRecipientEmail && notice?.include_honorary_guests !== false) {
      const honoraryGuests = await db.listHonoraryGuests(churchId);
      for (const guest of honoraryGuests) {
        if (!guest.email) continue;
        try {
          const existing = await db.listGuestInvitationsForEvent(eventId, churchId);
          const already = existing.some(
            (inv) =>
              inv.recipient_email?.toLowerCase() === guest.email?.toLowerCase() &&
              !inv.revoked_at
          );
          if (already) continue;

          const guestToken = generateGuestInvitationToken();
          const tokenHash = hashGuestInvitationToken(guestToken);
          await db.createGuestInvitation(churchId, {
            event_id: eventId,
            inviter_member_id: null,
            inviter_admin_user_id: null,
            recipient_email: guest.email,
            recipient_name: guest.full_name,
            token_hash: tokenHash,
            payer: "guest",
            max_uses: 1,
            expires_at: null,
            guest_id: guest.id,
          });

          const inviteUrl = buildPublicUrl(
            siteUrl.replace(/\/$/, ""),
            churchScopedGuestPath(church?.slug ?? churchSlug, guestToken)
          );
          const result = await sendGuestInviteEmail({
            toEmail: guest.email,
            toName: guest.full_name,
            churchName: church?.name ?? "your church",
            eventTitle: event.title,
            eventDate: event.event_date,
            eventTime: event.event_time,
            location: event.location,
            dressCode: event.dress_code,
            inviterName: null,
            inviteUrl,
          });
          if (result.sent) honoraryGuestInvitesSent++;
        } catch (guestInviteError) {
          failures.push({
            email: guest.email,
            message:
              guestInviteError instanceof Error
                ? guestInviteError.message
                : "Honorary guest invite failed",
          });
        }
      }
    }

    const send = await db.createServiceNoticeSend(churchId, {
      event_id: event.id,
      notice_id: notice?.id ?? null,
      sent_by: "admin",
      recipient_count: recipients.length,
      sent_count: sentCount,
      failed_count: failures.length,
      failures,
    });

    if (!testRecipientEmail && sentCount > 0) {
      await db.setServiceNoticeStatus(event.id, churchId, "sent", {
        notice_last_sent_at: new Date().toISOString(),
      });
    }

    await writeAuditLog({
      churchId,
      action: "sent",
      entityType: "notice",
      entityId: notice?.id ?? event.id,
      summary: `Sent notice for ${event.title}`,
      metadata: {
        recipient_count: recipients.length,
        sent_count: sentCount,
        failed_count: failures.length,
        honorary_guest_invites_sent: honoraryGuestInvitesSent,
        test_recipient_email: testRecipientEmail || null,
      },
    });
    return NextResponse.json({ send, test_urls: testUrls });
  } catch (error) {
    console.error("Notice send error:", error);
    return NextResponse.json({ error: "Failed to send notice." }, { status: 500 });
  }
}
