import { Resend } from "resend";
import { formatDate } from "@/lib/utils";
import {
  lodgePayFromEmail,
  renderSimpleMessageEmail,
} from "@/lib/email/templates";

type WinePledgeConfirmationArgs = {
  toEmail: string;
  toName: string;
  lodgeName: string;
  eventTitle: string;
  eventDate: string;
  eventTime: string | null;
  location: string | null;
  bottles: number;
  note: string | null;
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
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    console.warn(
      "RESEND_API_KEY not set; skipping wine pledge email to",
      args.toEmail
    );
    return { sent: false };
  }
  if (!args.toEmail) return { sent: false };
  if (args.bottles < 1) return { sent: false };

  const from = lodgePayFromEmail(
    process.env.RESEND_FROM_EMAIL ??
      process.env.EMAIL_FROM ??
      "LodgePay <noreply@lodgepayments.co.uk>"
  );

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

  const resend = new Resend(resendKey);
  const { error } = await resend.emails.send({
    from,
    to: args.toEmail,
    subject: `Wine pledge confirmed: ${args.eventTitle}`,
    html,
    text,
  });
  if (error) {
    console.error("Wine pledge email error:", error);
    return { sent: false };
  }
  return { sent: true };
}
