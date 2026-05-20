import { Resend } from "resend";
import { formatDate } from "@/lib/utils";
import {
  lodgePayFromEmail,
  renderSimpleMessageEmail,
} from "@/lib/email/templates";

type GuestWelcomeArgs = {
  toEmail: string;
  toName: string;
  lodgeName: string;
  eventTitle: string;
  eventDate: string;
  eventTime: string | null;
  location: string | null;
  dressCode: string | null;
  inviterName?: string | null;
  totalPaid?: number | null;
  currency?: string | null;
  visitorPortalUrl?: string | null;
};

export async function sendGuestWelcomeEmail(args: GuestWelcomeArgs) {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    console.warn(
      "RESEND_API_KEY not set; skipping guest welcome email to",
      args.toEmail
    );
    return { sent: false };
  }
  if (!args.toEmail) return { sent: false };

  const from = lodgePayFromEmail(
    process.env.RESEND_FROM_EMAIL ??
      process.env.EMAIL_FROM ??
      "LodgePay <noreply@lodgepayments.co.uk>"
  );

  const paragraphs: string[] = [];
  if (args.inviterName) {
    paragraphs.push(
      `${args.inviterName} has invited you to attend ${args.eventTitle} at ${args.lodgeName}, and your place is now confirmed.`
    );
  } else {
    paragraphs.push(
      `Your place at ${args.eventTitle} (${args.lodgeName}) is now confirmed.`
    );
  }

  const facts: string[] = [`Date: ${formatDate(args.eventDate)}`];
  if (args.eventTime) facts.push(`Time: ${args.eventTime}`);
  if (args.location) facts.push(`Location: ${args.location}`);
  if (args.dressCode) facts.push(`Dress: ${args.dressCode}`);
  paragraphs.push(facts.join(" · "));

  if (typeof args.totalPaid === "number" && args.totalPaid > 0) {
    paragraphs.push(
      `Payment received: ${(args.currency ?? "GBP").toUpperCase()} ${args.totalPaid.toFixed(2)}. This payment is non-refundable.`
    );
  }

  paragraphs.push(
    "Please reply to this email if you need to update your dietary requirements or accessibility needs."
  );
  if (args.visitorPortalUrl) {
    paragraphs.push(
      `You can also review your details and any future visits at any time here: ${args.visitorPortalUrl}`
    );
  }

  const html = renderSimpleMessageEmail({
    eyebrow: "You're confirmed",
    title: `See you at ${args.eventTitle}`,
    preview: `Confirmed: ${args.eventTitle} on ${formatDate(args.eventDate)}.`,
    greeting: `Dear ${args.toName},`,
    paragraphs,
    note:
      "This invitation is private; please do not share it publicly. If you can no longer attend, please let the lodge know as soon as possible.",
  });

  const resend = new Resend(resendKey);
  const { error } = await resend.emails.send({
    from,
    to: args.toEmail,
    subject: `You're confirmed: ${args.eventTitle}`,
    html,
    text: `${paragraphs.join("\n\n")}\n`,
  });
  if (error) {
    console.error("Guest welcome email error:", error);
    return { sent: false };
  }
  return { sent: true };
}

type GuestInviteArgs = {
  toEmail: string;
  toName: string;
  lodgeName: string;
  eventTitle: string;
  eventDate: string;
  eventTime: string | null;
  location: string | null;
  dressCode: string | null;
  inviterName?: string | null;
  inviteUrl: string;
  visitorPortalUrl?: string | null;
  isFirstTime?: boolean;
};

export async function sendGuestInviteEmail(args: GuestInviteArgs) {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    console.warn(
      "RESEND_API_KEY not set; skipping guest invite email to",
      args.toEmail
    );
    return { sent: false };
  }
  if (!args.toEmail) return { sent: false };

  const from = lodgePayFromEmail(
    process.env.RESEND_FROM_EMAIL ??
      process.env.EMAIL_FROM ??
      "LodgePay <noreply@lodgepayments.co.uk>"
  );

  const paragraphs: string[] = [];
  if (args.inviterName) {
    paragraphs.push(
      `${args.inviterName} would like to invite you to ${args.eventTitle} at ${args.lodgeName}.`
    );
  } else {
    paragraphs.push(
      `${args.lodgeName} would like to invite you to ${args.eventTitle}.`
    );
  }

  const facts: string[] = [`Date: ${formatDate(args.eventDate)}`];
  if (args.eventTime) facts.push(`Time: ${args.eventTime}`);
  if (args.location) facts.push(`Location: ${args.location}`);
  if (args.dressCode) facts.push(`Dress: ${args.dressCode}`);
  paragraphs.push(facts.join(" · "));

  paragraphs.push(
    `To confirm your place and pay any dining or meeting fees, follow your private invitation link:\n${args.inviteUrl}`
  );

  if (args.visitorPortalUrl) {
    paragraphs.push(
      `Once you have attended you can revisit your details at any time here: ${args.visitorPortalUrl}`
    );
  }

  paragraphs.push(
    "Please do not share this link publicly; it is unique to you. If you can no longer attend, simply ignore this email and the lodge will know."
  );

  const html = renderSimpleMessageEmail({
    eyebrow: "You're invited",
    title: `${args.eventTitle}`,
    preview: `${args.lodgeName} invites you to ${args.eventTitle}.`,
    greeting: `Dear ${args.toName},`,
    paragraphs,
    note:
      "Payments are taken via secure card processing. As is custom in Masonry, places are confirmed at the point of payment and are non-refundable.",
  });

  const resend = new Resend(resendKey);
  const { error } = await resend.emails.send({
    from,
    to: args.toEmail,
    subject: `Invitation: ${args.eventTitle}`,
    html,
    text: `${paragraphs.join("\n\n")}\n`,
  });
  if (error) {
    console.error("Guest invite email error:", error);
    return { sent: false };
  }
  return { sent: true };
}

type GuestSelfRegisterArgs = {
  toEmail: string;
  toName: string;
  lodgeName: string;
  visitorPortalUrl: string;
  upcomingCount: number;
};

export async function sendGuestSelfRegisterEmail(args: GuestSelfRegisterArgs) {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    console.warn(
      "RESEND_API_KEY not set; skipping guest self-register email to",
      args.toEmail
    );
    return { sent: false };
  }
  if (!args.toEmail) return { sent: false };

  const from = lodgePayFromEmail(
    process.env.RESEND_FROM_EMAIL ??
      process.env.EMAIL_FROM ??
      "LodgePay <noreply@lodgepayments.co.uk>"
  );

  const paragraphs: string[] = [
    `Thank you for adding yourself to the ${args.lodgeName} visitor directory.`,
  ];
  if (args.upcomingCount > 0) {
    paragraphs.push(
      args.upcomingCount === 1
        ? "There is one upcoming event you can book yourself into right now."
        : `There are ${args.upcomingCount} upcoming events you can book yourself into right now.`
    );
  } else {
    paragraphs.push(
      "There are no events open to visitors at the moment. We will let you know when something new is announced."
    );
  }
  paragraphs.push(
    `Your private visitor link is below. Use it any time to book future visits, update your dietary requirements, or review your visit history. Please do not share it publicly.\n${args.visitorPortalUrl}`
  );

  const html = renderSimpleMessageEmail({
    eyebrow: "You're in",
    title: `Welcome to ${args.lodgeName}`,
    preview: `Your visitor profile at ${args.lodgeName} is ready.`,
    greeting: `Dear ${args.toName},`,
    paragraphs,
    note: "This link is unique to you and never expires unless the lodge revokes it. Bookmark it for next time.",
  });

  const resend = new Resend(resendKey);
  const { error } = await resend.emails.send({
    from,
    to: args.toEmail,
    subject: `Welcome to ${args.lodgeName}`,
    html,
    text: `${paragraphs.join("\n\n")}\n`,
  });
  if (error) {
    console.error("Guest self-register email error:", error);
    return { sent: false };
  }
  return { sent: true };
}

type GuestPostEventArgs = {
  toEmail: string;
  toName: string;
  lodgeName: string;
  eventTitle: string;
  charityRaised?: number | null;
  visitorPortalUrl?: string | null;
};

export async function sendGuestPostEventEmail(args: GuestPostEventArgs) {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) return { sent: false };
  if (!args.toEmail) return { sent: false };

  const from = lodgePayFromEmail(
    process.env.RESEND_FROM_EMAIL ??
      process.env.EMAIL_FROM ??
      "LodgePay <noreply@lodgepayments.co.uk>"
  );

  const paragraphs: string[] = [
    `Thank you for joining us at ${args.eventTitle}. It was a pleasure to welcome you.`,
  ];
  if (typeof args.charityRaised === "number" && args.charityRaised > 0) {
    paragraphs.push(
      `Together we raised £${args.charityRaised.toFixed(2)} for our chosen charity. Thank you for your generosity.`
    );
  }
  paragraphs.push(
    `If you would like to know about future ${args.lodgeName} events, simply reply and we will be in touch.`
  );
  if (args.visitorPortalUrl) {
    paragraphs.push(
      `You can review your visit history and update your dietary requirements at any time here: ${args.visitorPortalUrl}`
    );
  }

  const html = renderSimpleMessageEmail({
    eyebrow: "Thank you",
    title: "Thank you for joining us",
    preview: `Thank you for attending ${args.eventTitle}.`,
    greeting: `Dear ${args.toName},`,
    paragraphs,
  });

  const resend = new Resend(resendKey);
  const { error } = await resend.emails.send({
    from,
    to: args.toEmail,
    subject: `Thank you for joining us at ${args.eventTitle}`,
    html,
    text: `${paragraphs.join("\n\n")}\n`,
  });
  if (error) {
    console.error("Guest post-event email error:", error);
    return { sent: false };
  }
  return { sent: true };
}
