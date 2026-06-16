import type { Mosque } from "@/lib/db/types";
import { renderNotificationEmail } from "@/lib/email/templates";
import { sendWithLog } from "@/lib/email/send-with-log";

const CONTACT_NOTIFICATION_EMAIL = "ag@experrt.com";

type WebsiteNotificationInput = {
  mosque: Pick<Mosque, "name" | "support_email" | "secretary_name"> | null;
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
  mosque: WebsiteNotificationInput["mosque"],
  recipients?: string[] | null
) {
  if (recipients?.length) return recipients;
  return mosque?.support_email ? [mosque.support_email] : [CONTACT_NOTIFICATION_EMAIL];
}

function plainRows(rows: WebsiteNotificationInput["rows"]) {
  return rows
    .filter((row) => row.value)
    .map((row) => `${row.label}: ${row.value}`)
    .join("\n");
}

export async function sendWebsiteNotification({
  mosque,
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
  const to = notificationRecipients(mosque, recipients);
  const safeRows = rows
    .filter((row) => row.value)
    .map((row) => ({ label: row.label, value: String(row.value) }));

  const html = renderNotificationEmail({
    eyebrow,
    title,
    preview,
    intro,
    rows: [
      { label: "Mosque", value: mosque?.name ?? "Selected mosque" },
      ...safeRows,
    ],
    message: message?.trim() || undefined,
  });
  const text = `${title}\n\nMosque: ${mosque?.name ?? "Selected mosque"}\n${plainRows(rows)}${
    message ? `\n\n${message}` : ""
  }`;

  // sendWithLog only takes a single primary recipient. For multi-
  // recipient notifications we send one email per recipient so each
  // gets its own audit row and BCC mirror.
  const results = await Promise.all(
    to.map((addr) =>
      sendWithLog({
        mosqueId: null,
        toEmail: addr,
        emailType: "website_notification",
        entityType: "mosque",
        entityId: null,
        dedupeKey: null,
        subject,
        html,
        text,
        replyTo: replyTo?.trim() || null,
        metadata: { mosque_name: mosque?.name ?? null, eyebrow },
      }),
    ),
  );

  const sentAll = results.every((r) => r.ok);
  return { sent: sentAll, to };
}
