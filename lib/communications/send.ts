import { Resend } from "resend";
import * as db from "@/lib/db";
import type { Member, Lodge } from "@/lib/db/types";
import { coerceButtonsInEmailHtml } from "@/lib/email/coerce-buttons";
import {
  lodgePayFromEmail,
  renderBrandedEmail,
} from "@/lib/email/templates";
import { applyMergeTags, type MergeTagContext } from "./templates";

export type Recipient = {
  email: string;
  name: string;
  member_id?: string | null;
  lead_id?: string | null;
  context: Record<string, string | undefined>;
};

export async function sendBatch({
  lodgeId,
  templateKey,
  subject,
  htmlBody,
  recipients,
  audienceLabel,
  fromOverride,
}: {
  lodgeId: string;
  templateKey: string | null;
  subject: string;
  htmlBody: string;
  recipients: Recipient[];
  audienceLabel?: string;
  fromOverride?: string;
}) {
  const resendKey = process.env.RESEND_API_KEY;
  const fromEmail = lodgePayFromEmail(
    fromOverride ??
    process.env.EMAIL_FROM ??
    "LodgePay <noreply@lodgepayments.co.uk>"
  );

  const sentRows: Parameters<typeof db.logMessages>[1] = [];
  let sent = 0;
  let failed = 0;

  if (!resendKey) {
    for (const recipient of recipients) {
      sentRows.push({
        channel: "email",
        template_key: templateKey,
        subject: applyMergeTags(subject, recipient.context),
        body_preview: coerceButtonsInEmailHtml(
          applyMergeTags(htmlBody, recipient.context)
        ).slice(0, 280),
        recipient_email: recipient.email,
        recipient_name: recipient.name,
        recipient_member_id: recipient.member_id ?? null,
        recipient_lead_id: recipient.lead_id ?? null,
        audience_label: audienceLabel ?? null,
        status: "skipped",
        error_message: "RESEND_API_KEY is not configured",
        metadata: { dry_run: true },
        sent_by_admin_user_id: null,
        sent_at: null,
      });
    }
    await db.logMessages(lodgeId, sentRows);
    return { sent: 0, failed: 0, skipped: recipients.length };
  }

  const resend = new Resend(resendKey);

  for (const recipient of recipients) {
    const personalSubject = applyMergeTags(subject, recipient.context);
    const personalBody = coerceButtonsInEmailHtml(
      applyMergeTags(htmlBody, recipient.context)
    );
    const brandedBody = renderBrandedEmail({
      eyebrow: audienceLabel ?? "Lodge update",
      title: personalSubject,
      preview: personalSubject,
      children: personalBody,
    });
    try {
      await resend.emails.send({
        from: fromEmail,
        to: recipient.email,
        subject: personalSubject,
        html: brandedBody,
      });
      sentRows.push({
        channel: "email",
        template_key: templateKey,
        subject: personalSubject,
        body_preview: personalBody.slice(0, 280),
        recipient_email: recipient.email,
        recipient_name: recipient.name,
        recipient_member_id: recipient.member_id ?? null,
        recipient_lead_id: recipient.lead_id ?? null,
        audience_label: audienceLabel ?? null,
        status: "sent",
        error_message: null,
        metadata: {},
        sent_by_admin_user_id: null,
        sent_at: new Date().toISOString(),
      });
      sent += 1;
    } catch (error) {
      failed += 1;
      sentRows.push({
        channel: "email",
        template_key: templateKey,
        subject: personalSubject,
        body_preview: personalBody.slice(0, 280),
        recipient_email: recipient.email,
        recipient_name: recipient.name,
        recipient_member_id: recipient.member_id ?? null,
        recipient_lead_id: recipient.lead_id ?? null,
        audience_label: audienceLabel ?? null,
        status: "failed",
        error_message:
          error instanceof Error ? error.message : "Unknown error",
        metadata: {},
        sent_by_admin_user_id: null,
        sent_at: null,
      });
    }
  }

  await db.logMessages(lodgeId, sentRows);
  return { sent, failed, skipped: 0 };
}

export function buildMemberContext(
  member: Member,
  lodge: Lodge | null,
  extra: Partial<MergeTagContext> = {}
): Record<string, string | undefined> {
  const [first = member.full_name, ...rest] = member.full_name.split(/\s+/);
  return {
    first_name: first,
    last_name: rest.join(" "),
    full_name: member.full_name,
    email: member.email,
    lodge_name: lodge?.name ?? "the lodge",
    ...extra,
  };
}
