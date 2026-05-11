import type { Lodge } from "@/lib/db/types";
import { lodgePayFromEmail, renderNotificationEmail } from "@/lib/email/templates";

const CONTACT_NOTIFICATION_EMAIL = "ag@experrt.com";

type WebsiteNotificationInput = {
  lodge: Pick<Lodge, "name" | "support_email" | "secretary_name"> | null;
  replyTo?: string | null;
  subject: string;
  eyebrow: string;
  title: string;
  preview: string;
  intro: string;
  rows: Array<{ label: string; value: string | null | undefined }>;
  message?: string | null;
  recipients?: string[] | null;
};

function notificationRecipients(
  lodge: WebsiteNotificationInput["lodge"],
  recipients?: string[] | null
) {
  if (recipients?.length) return recipients;
  return lodge?.support_email ? [lodge.support_email] : [CONTACT_NOTIFICATION_EMAIL];
}

function plainRows(rows: WebsiteNotificationInput["rows"]) {
  return rows
    .filter((row) => row.value)
    .map((row) => `${row.label}: ${row.value}`)
    .join("\n");
}

export async function sendWebsiteNotification({
  lodge,
  replyTo,
  subject,
  eyebrow,
  title,
  preview,
  intro,
  rows,
  message,
  recipients,
}: WebsiteNotificationInput) {
  const resendKey = process.env.RESEND_API_KEY;
  const to = notificationRecipients(lodge, recipients);
  if (!resendKey) {
    return { sent: false, to, reason: "Resend not configured." };
  }

  const { Resend } = await import("resend");
  const resend = new Resend(resendKey);
  const safeRows = rows
    .filter((row) => row.value)
    .map((row) => ({ label: row.label, value: String(row.value) }));

  await resend.emails.send({
    from: lodgePayFromEmail(process.env.EMAIL_FROM),
    to,
    replyTo: replyTo?.trim() || undefined,
    subject,
    html: renderNotificationEmail({
      eyebrow,
      title,
      preview,
      intro,
      rows: [
        { label: "Lodge", value: lodge?.name ?? "Selected lodge" },
        ...safeRows,
      ],
      message: message?.trim() || undefined,
    }),
    text: `${title}\n\nLodge: ${lodge?.name ?? "Selected lodge"}\n${plainRows(rows)}${
      message ? `\n\n${message}` : ""
    }`,
  });

  return { sent: true, to };
}
