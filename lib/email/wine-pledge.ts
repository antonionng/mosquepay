import { formatDate } from "@/lib/utils";
import { renderSimpleMessageEmail } from "@/lib/email/templates";
import { sendWithLog } from "@/lib/email/send-with-log";

type WinePledgeConfirmationArgs = {
  toEmail: string;
  toName: string;
  churchName: string;
  eventTitle: string;
  eventDate: string;
  eventTime: string | null;
  location: string | null;
  bottles: number;
  note: string | null;
  churchId?: string | null;
  eventId?: string | null;
  memberId?: string | null;
};

/**
 * Confirms a "bring a bottle for the raffle" pledge. Wine pledges are
 * non-cash so this is purely an acknowledgement: no receipt, no link,
 * just the date, location and what we have you down for. We never block
 * the calling request on email delivery; the email is best-effort.
 */
export async function sendWinePledgeConfirmationEmail(
  args: WinePledgeConfirmationArgs
) {
  if (!args.toEmail) return { sent: false };
  if (args.bottles < 1) return { sent: false };

  const bottleLabel = args.bottles === 1 ? "1 bottle" : `${args.bottles} bottles`;

  const facts: string[] = [`Date: ${formatDate(args.eventDate)}`];
  if (args.eventTime) facts.push(`Time: ${args.eventTime}`);
  if (args.location) facts.push(`Location: ${args.location}`);

  const paragraphs: string[] = [
    `Thank you for pledging ${bottleLabel} of wine for the raffle at ${args.eventTitle}.`,
    facts.join(" · "),
    "Please bring your bottle(s) on the night and hand them to the raffle steward when you arrive. The proceeds support our charity giving.",
  ];

  if (args.note) {
    paragraphs.push(`Your note: ${args.note}`);
  }

  paragraphs.push(
    "If your plans change and you can no longer bring a bottle, just reply to this email so we can update the bring-list."
  );

  const html = renderSimpleMessageEmail({
    eyebrow: "Raffle wine pledge",
    title: `We have you down for ${bottleLabel}`,
    preview: `Wine pledge confirmed for ${args.eventTitle}.`,
    greeting: `Dear ${args.toName},`,
    paragraphs,
    note:
      "Wine pledges are recorded against your RSVP only, so we know how many bottles to expect on the night. There's nothing to pay.",
  });

  const text = `${paragraphs.join("\n\n")}\n`;

  const result = await sendWithLog({
    churchId: args.churchId ?? null,
    toEmail: args.toEmail,
    toName: args.toName,
    memberId: args.memberId ?? null,
    emailType: "wine_pledge_thanks_member",
    entityType: "event",
    entityId: args.eventId ?? null,
    dedupeKey: args.eventId
      ? `wine_${args.eventId}_${args.toEmail.toLowerCase()}`
      : null,
    subject: `Wine pledge confirmed: ${args.eventTitle}`,
    html,
    text,
    metadata: {
      church_name: args.churchName,
      event_title: args.eventTitle,
      bottles: args.bottles,
    },
  });

  return { sent: result.ok };
}
