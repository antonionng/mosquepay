import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import * as db from "@/lib/db";
import { getLodgeSlugFromRequest } from "@/lib/tenant";
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

  const lodgeSlug = getLodgeSlugFromRequest(request);
  const lodgeId = await db.resolveLodgeId(lodgeSlug);
  if (!lodgeId) {
    return NextResponse.json({ error: "Lodge not found." }, { status: 404 });
  }
  const forbidden = await requireAdminApiPermission("members:write", lodgeId);
  if (forbidden) return forbidden;

  const body = await request.json();
  const subject: string = body.subject ?? "Lodge update";
  const html: string = body.html_body ?? "";
  const audience: "active_members" | "all_members" | "leads" =
    body.audience ?? "active_members";
  const templateKey: string | null = body.template_key ?? null;
  const dryRun: boolean = body.dry_run === true;

  const lodge = await db.getLodgeById(lodgeId);
  let recipients: Awaited<ReturnType<typeof sendBatch>> | null = null;

  if (audience === "leads") {
    const leads = await db.getLeads(lodgeId);
    const list = leads
      .filter((l) => l.email)
      .map((lead) => {
        const fullName = `${lead.first_name ?? ""} ${lead.last_name ?? ""}`.trim() || lead.email;
        return {
          email: lead.email,
          name: fullName,
          member_id: null,
          lead_id: lead.id,
          context: {
            first_name: lead.first_name || fullName.split(/\s+/)[0],
            last_name: lead.last_name ?? "",
            full_name: fullName,
            email: lead.email,
            lodge_name: lodge?.name ?? "the lodge",
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
      lodgeId,
      templateKey,
      subject,
      htmlBody: html,
      recipients: list,
      audienceLabel: "leads",
    });
  } else {
    const allMembers = await db.getMembers(lodgeId);
    const filtered =
      audience === "active_members"
        ? allMembers.filter((m) => m.membership_status === "active")
        : allMembers;
    const list = filtered.map((member) => ({
      email: member.email,
      name: member.full_name,
      member_id: member.id,
      lead_id: null,
      context: buildMemberContext(member, lodge),
    }));
    if (dryRun) {
      return NextResponse.json({
        dry_run: true,
        audience_count: list.length,
      });
    }
    recipients = await sendBatch({
      lodgeId,
      templateKey,
      subject,
      htmlBody: html,
      recipients: list,
      audienceLabel: audience,
    });
  }

  await writeAuditLog({
    lodgeId,
    action: "newsletter_sent",
    entityType: "newsletter",
    entityId: lodgeId,
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
