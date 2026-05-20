import { NextRequest, NextResponse } from "next/server";
import { createHash, randomBytes } from "crypto";
import { Resend } from "resend";
import { requireAdminApiAuth, requireAdminApiPermission } from "@/lib/auth/api";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import * as db from "@/lib/db";
import { getLodgeSlugFromRequest } from "@/lib/tenant";
import { writeAuditLog } from "@/lib/audit";
import {
  lodgePayFromEmail,
  renderSummonsEmail,
} from "@/lib/email/templates";
import { defaultAgendaItems, renderDefaultSummonsOpening } from "@/lib/summons/defaults";

type Params = { params: Promise<{ eventId: string }> };
type SummonsRecipient = { email: string; full_name: string };

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function POST(request: NextRequest, { params }: Params) {
  const unauthorized = await requireAdminApiAuth();
  if (unauthorized) return unauthorized;

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Database not configured." }, { status: 503 });
  }

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
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
    const lodgeSlug = getLodgeSlugFromRequest(request);
    const lodgeId = await db.resolveLodgeId(lodgeSlug);
    if (!lodgeId) {
      return NextResponse.json({ error: "Lodge not found." }, { status: 404 });
    }
    const forbidden = await requireAdminApiPermission("summons:write", lodgeId);
    if (forbidden) return forbidden;

    const [event, lodge, summons, members] = await Promise.all([
      db.getEventById(eventId, lodgeId),
      db.getLodgeById(lodgeId),
      db.getEventSummons(eventId, lodgeId),
      db.getMembers(lodgeId, { status: "active" }),
    ]);

    if (!event) {
      return NextResponse.json({ error: "Meeting not found." }, { status: 404 });
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? request.nextUrl.origin;
    const recipients: SummonsRecipient[] = testRecipientEmail
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
    const fromEmail = lodgePayFromEmail(
      process.env.RESEND_FROM_EMAIL ??
      process.env.EMAIL_FROM ??
      "LodgePay <noreply@lodgepayments.co.uk>"
    );
    const resend = new Resend(resendKey);
    const venue = [event.location, event.temple_room].filter(Boolean).join(", ");
    const agendaItems = summons?.agenda_items?.length
      ? summons.agenda_items
      : defaultAgendaItems();
    const openingText = summons?.opening_text ?? renderDefaultSummonsOpening(event, lodge);
    const menuItems = summons?.menu_items ?? [];
    const notices = summons?.notices ?? [];
    const failures: Array<{ email: string; message: string }> = [];
    const testUrls: Array<{ email: string; summons_url: string; rsvp_url: string }> = [];
    let sentCount = 0;

    for (const member of recipients) {
      try {
        const token = randomBytes(32).toString("base64url");
        const summonsUrl = `${siteUrl}/summons/${token}`;
        const rsvpUrl = `${summonsUrl}#rsvp`;
        if (testRecipientEmail) {
          testUrls.push({
            email: member.email,
            summons_url: summonsUrl,
            rsvp_url: rsvpUrl,
          });
        }
        await db.createEventSummonsAccessLink(lodgeId, {
          event_id: event.id,
          summons_id: summons?.id ?? null,
          send_id: null,
          recipient_email: member.email,
          recipient_name: member.full_name,
          token_hash: hashToken(token),
          expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
        });

        const result = await resend.emails.send({
          from: fromEmail,
          to: member.email,
          subject: `${testRecipientEmail ? "[Test] " : ""}Summons: ${event.title}`,
          html: renderSummonsEmail({
            memberName: member.full_name,
            lodgeName: lodge?.name ?? "your lodge",
            eventTitle: event.title,
            eventDate: event.event_date,
            venue,
            openingText,
            summonsUrl,
            rsvpUrl,
            agendaItems,
            menuItems,
            notices,
            masterElectName: summons?.master_elect_name ?? null,
            masterElectQualification: summons?.master_elect_qualification ?? null,
            visitingOfficers: summons?.visiting_officers ?? [],
            visitingOfficerName: summons?.visiting_officer_name ?? null,
            visitingOfficerEmail: summons?.visiting_officer_email ?? null,
            visitingOfficerPhone: summons?.visiting_officer_phone ?? null,
            nextMeetingDate: summons?.next_meeting_date ?? null,
            nextMeetingNote: summons?.next_meeting_note ?? null,
          }),
        });

        if (result.error) {
          throw new Error(result.error.message);
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

    const send = await db.createEventSummonsSend(lodgeId, {
      event_id: event.id,
      summons_id: summons?.id ?? null,
      sent_by: "admin",
      recipient_count: recipients.length,
      sent_count: sentCount,
      failed_count: failures.length,
      failures,
    });

    await writeAuditLog({
      lodgeId,
      action: "sent",
      entityType: "summons",
      entityId: summons?.id ?? event.id,
      summary: `Sent summons for ${event.title}`,
      metadata: {
        recipient_count: recipients.length,
        sent_count: sentCount,
        failed_count: failures.length,
        test_recipient_email: testRecipientEmail || null,
      },
    });
    return NextResponse.json({ send, test_urls: testUrls });
  } catch (error) {
    console.error("Summons send error:", error);
    return NextResponse.json({ error: "Failed to send summons." }, { status: 500 });
  }
}
