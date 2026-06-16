import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import * as db from "@/lib/db";
import { getMosqueSlugFromRequest } from "@/lib/tenant";
import {
  requireAdminApiAuth,
  requireAdminApiPermission,
} from "@/lib/auth/api";
import { writeAuditLog } from "@/lib/audit";
import { sendBatch, buildMemberContext } from "@/lib/communications/send";

export async function POST(request: NextRequest) {
  const unauthorized = await requireAdminApiAuth();
  if (unauthorized) return unauthorized;
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Database not configured." },
      { status: 503 }
    );
  }

  const mosqueSlug = getMosqueSlugFromRequest(request);
  const mosqueId = await db.resolveMosqueId(mosqueSlug);
  if (!mosqueId) {
    return NextResponse.json({ error: "Mosque not found." }, { status: 404 });
  }
  const forbidden = await requireAdminApiPermission("members:write", mosqueId);
  if (forbidden) return forbidden;

  const body = await request.json();
  const subject: string = body.subject ?? "Mosque update";
  const html: string = body.html_body ?? "";
  const audience: "active_members" | "all_members" | "newcomers" =
    body.audience ?? "active_members";
  const templateKey: string | null = body.template_key ?? null;
  const dryRun: boolean = body.dry_run === true;
  const recipientEmail =
    typeof body.recipient_email === "string"
      ? body.recipient_email.trim().toLowerCase()
      : "";
  const recipientName =
    typeof body.recipient_name === "string" ? body.recipient_name.trim() : "";

  const mosque = await db.getMosqueById(mosqueId);
  let recipients: Awaited<ReturnType<typeof sendBatch>> | null = null;

  if (recipientEmail) {
    const name = recipientName || recipientEmail;
    const firstName = name.split(/\s+/)[0] || name;
    const list = [
      {
        email: recipientEmail,
        name,
        member_id: null,
        newcomer_id: null,
        context: {
          first_name: firstName,
          last_name: name.split(/\s+/).slice(1).join(" "),
          full_name: name,
          email: recipientEmail,
          mosque_name: mosque?.name ?? "the mosque",
        },
      },
    ];
    if (dryRun) {
      return NextResponse.json({
        dry_run: true,
        audience_count: list.length,
      });
    }
    recipients = await sendBatch({
      mosqueId,
      templateKey,
      subject,
      htmlBody: html,
      recipients: list,
      audienceLabel: "selected_recipient",
    });
  } else if (audience === "newcomers") {

    const newcomers = await db.getNewcomers(mosqueId);
    const list = newcomers
      .filter((l) => l.email)
      .map((newcomer) => {
        const fullName = `${newcomer.first_name ?? ""} ${newcomer.last_name ?? ""}`.trim() || newcomer.email;
        return {
          email: newcomer.email,
          name: fullName,
          member_id: null,
          newcomer_id: newcomer.id,
          context: {
            first_name: newcomer.first_name || fullName.split(/\s+/)[0],
            last_name: newcomer.last_name ?? "",
            full_name: fullName,
            email: newcomer.email,
            mosque_name: mosque?.name ?? "the mosque",
          },
        };
      });
    if (dryRun) {
      return NextResponse.json({
        dry_run: true,
        audience_count: list.length,
      });
    }
    recipients = await sendBatch({
      mosqueId,
      templateKey,
      subject,
      htmlBody: html,
      recipients: list,
      audienceLabel: "newcomers",
    });
  } else {
    const allMembers = await db.getMembers(mosqueId);
    const filtered =
      audience === "active_members"
        ? allMembers.filter((m) => m.membership_status === "active")
        : allMembers;
    const list = filtered.map((member) => ({
      email: member.email,
      name: member.full_name,
      member_id: member.id,
      newcomer_id: null,
      context: buildMemberContext(member, mosque),
    }));
    if (dryRun) {
      return NextResponse.json({
        dry_run: true,
        audience_count: list.length,
      });
    }
    recipients = await sendBatch({
      mosqueId,
      templateKey,
      subject,
      htmlBody: html,
      recipients: list,
      audienceLabel: audience,
    });
  }

  await writeAuditLog({
    mosqueId,
    action: "newsletter_sent",
    entityType: "newsletter",
    entityId: mosqueId,
    summary: `Sent ${recipients.sent} newsletter emails`,
    metadata: {
      audience,
      sent: recipients.sent,
      failed: recipients.failed,
      skipped: recipients.skipped,
    },
  });

  return NextResponse.json(recipients);
}
