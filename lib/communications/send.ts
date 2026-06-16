import * as db from "@/lib/db";
import type { Member, Mosque } from "@/lib/db/types";
import { coerceButtonsInEmailHtml } from "@/lib/email/coerce-buttons";
import { renderBrandedEmail } from "@/lib/email/templates";
import { sendWithLog } from "@/lib/email/send-with-log";
import { applyMergeTags, type MergeTagContext } from "./templates";

export type Recipient = {
  email: string;
  name: string;
  member_id?: string | null;
  newcomer_id?: string | null;
  context: Record<string, string | undefined>;
};

export async function sendBatch({
  mosqueId,
  templateKey,
  subject,
  htmlBody,
  recipients,
  audienceLabel,
  fromOverride,
}: {
  mosqueId: string;
  templateKey: string | null;
  subject: string;
  htmlBody: string;
  recipients: Recipient[];
  audienceLabel?: string;
  fromOverride?: string;
}) {
  // We deliberately do NOT short-circuit on missing RESEND_API_KEY
  // here -- sendWithLog handles that case (records a "failed" row
  // with error="RESEND_API_KEY missing") so the audit trail is
  // identical between dev and prod. fromOverride is also handled
  // at the sendWithLog layer via env, so we just route through.
  void fromOverride;

  const sentRows: Parameters<typeof db.logMessages>[1] = [];
  let sent = 0;
  let failed = 0;

  for (const recipient of recipients) {
    const personalSubject = applyMergeTags(subject, recipient.context);
    const personalBody = coerceButtonsInEmailHtml(
      applyMergeTags(htmlBody, recipient.context),
    );
    const brandedBody = renderBrandedEmail({
      eyebrow: audienceLabel ?? "Mosque update",
      title: personalSubject,
      preview: personalSubject,
      children: personalBody,
    });
    const result = await sendWithLog({
      mosqueId,
      toEmail: recipient.email,
      toName: recipient.name,
      memberId: recipient.member_id ?? null,
      emailType: templateKey
        ? `broadcast_${templateKey}`
        : "broadcast_ad_hoc",
      entityType: "broadcast",
      entityId: null,
      dedupeKey: null,
      subject: personalSubject,
      html: brandedBody,
      metadata: {
        template_key: templateKey,
        audience_label: audienceLabel ?? null,
      },
    });
    if (result.ok) {
      sentRows.push({
        channel: "email",
        template_key: templateKey,
        subject: personalSubject,
        body_preview: personalBody.slice(0, 280),
        recipient_email: recipient.email,
        recipient_name: recipient.name,
        recipient_member_id: recipient.member_id ?? null,
        recipient_newcomer_id: recipient.newcomer_id ?? null,
        audience_label: audienceLabel ?? null,
        status: "sent",
        error_message: null,
        metadata: {},
        sent_by_admin_user_id: null,
        sent_at: new Date().toISOString(),
      });
      sent += 1;
    } else {
      failed += 1;
      sentRows.push({
        channel: "email",
        template_key: templateKey,
        subject: personalSubject,
        body_preview: personalBody.slice(0, 280),
        recipient_email: recipient.email,
        recipient_name: recipient.name,
        recipient_member_id: recipient.member_id ?? null,
        recipient_newcomer_id: recipient.newcomer_id ?? null,
        audience_label: audienceLabel ?? null,
        status: "failed",
        error_message: result.error,
        metadata: {},
        sent_by_admin_user_id: null,
        sent_at: null,
      });
    }
  }

  await db.logMessages(mosqueId, sentRows);
  return { sent, failed, skipped: 0 };
}

export function buildMemberContext(
  member: Member,
  mosque: Mosque | null,
  extra: Partial<MergeTagContext> = {}
): Record<string, string | undefined> {
  const [first = member.full_name, ...rest] = member.full_name.split(/\s+/);
  return {
    first_name: first,
    last_name: rest.join(" "),
    full_name: member.full_name,
    email: member.email,
    mosque_name: mosque?.name ?? "the mosque",
    ...extra,
  };
}
