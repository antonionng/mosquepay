import { formatDate } from "@/lib/utils";
import { renderSimpleMessageEmail } from "@/lib/email/templates";
import { sendWithLog } from "@/lib/email/send-with-log";

type GuestWelcomeArgs = {
  toEmail: string;
  toName: string;
  churchName: string;
  eventTitle: string;
  eventDate: string;
  eventTime: string | null;
  location: string | null;
  dressCode: string | null;
  inviterName?: string | null;
  totalPaid?: number | null;
  currency?: string | null;
  newcomerPortalUrl?: string | null;
  /** Optional church id so the email_log row carries tenant context. */
  churchId?: string | null;
  /** Optional event id so we can dedupe per (event, recipient). */
  eventId?: string | null;
};

export async function sendGuestWelcomeEmail(args: GuestWelcomeArgs) {
  if (!args.toEmail) return { sent: false };

  const paragraphs: string[] = [];
  if (args.inviterName) {
    paragraphs.push(
      `${args.inviterName} has invited you to attend ${args.eventTitle} at ${args.churchName}, and your place is now confirmed.`,
    );
  } else {
    paragraphs.push(
      `Your place at ${args.eventTitle} (${args.churchName}) is now confirmed.`,
    );
  }

  const facts: string[] = [`Date: ${formatDate(args.eventDate)}`];
  if (args.eventTime) facts.push(`Time: ${args.eventTime}`);
  if (args.location) facts.push(`Location: ${args.location}`);
  if (args.dressCode) facts.push(`Dress: ${args.dressCode}`);
  paragraphs.push(facts.join(" · "));

  if (typeof args.totalPaid === "number" && args.totalPaid > 0) {
    paragraphs.push(
      `Payment received: ${(args.currency ?? "GBP").toUpperCase()} ${args.totalPaid.toFixed(2)}. This payment is non-refundable.`,
    );
  }

  paragraphs.push(
    "Please reply to this email if you need to update your dietary requirements or accessibility needs.",
  );
  if (args.newcomerPortalUrl) {
    paragraphs.push(
      `You can also review your details and any future visits at any time here: ${args.newcomerPortalUrl}`,
    );
  }

  const html = renderSimpleMessageEmail({
    eyebrow: "You're confirmed",
    title: `See you at ${args.eventTitle}`,
    preview: `Confirmed: ${args.eventTitle} on ${formatDate(args.eventDate)}.`,
    greeting: `Dear ${args.toName},`,
    paragraphs,
    note: "This invitation is private; please do not share it publicly. If you can no longer attend, please let the church know as soon as possible.",
  });

  const result = await sendWithLog({
    churchId: args.churchId ?? null,
    toEmail: args.toEmail,
    toName: args.toName,
    emailType: "guest_welcome",
    entityType: "event",
    entityId: args.eventId ?? null,
    dedupeKey: args.eventId ? `${args.eventId}_${args.toEmail.toLowerCase()}` : null,
    subject: `You're confirmed: ${args.eventTitle}`,
    html,
    text: `${paragraphs.join("\n\n")}\n`,
    metadata: {
      church_name: args.churchName,
      event_title: args.eventTitle,
      total_paid: args.totalPaid ?? null,
    },
  });

  return { sent: result.ok };
}

type GuestInviteArgs = {
  toEmail: string;
  toName: string;
  churchName: string;
  eventTitle: string;
  eventDate: string;
  eventTime: string | null;
  location: string | null;
  dressCode: string | null;
  inviterName?: string | null;
  inviteUrl: string;
  newcomerPortalUrl?: string | null;
  isFirstTime?: boolean;
  churchId?: string | null;
  eventId?: string | null;
};

export async function sendGuestInviteEmail(args: GuestInviteArgs) {
  if (!args.toEmail) return { sent: false };

  const paragraphs: string[] = [];
  if (args.inviterName) {
    paragraphs.push(
      `${args.inviterName} would like to invite you to ${args.eventTitle} at ${args.churchName}.`,
    );
  } else {
    paragraphs.push(
      `${args.churchName} would like to invite you to ${args.eventTitle}.`,
    );
  }

  const facts: string[] = [`Date: ${formatDate(args.eventDate)}`];
  if (args.eventTime) facts.push(`Time: ${args.eventTime}`);
  if (args.location) facts.push(`Location: ${args.location}`);
  if (args.dressCode) facts.push(`Dress: ${args.dressCode}`);
  paragraphs.push(facts.join(" · "));

  paragraphs.push(
    `To confirm your place and pay any dining or service fees, follow your private invitation link:\n${args.inviteUrl}`,
  );

  if (args.newcomerPortalUrl) {
    paragraphs.push(
      `Once you have attended you can revisit your details at any time here: ${args.newcomerPortalUrl}`,
    );
  }

  paragraphs.push(
    "Please do not share this link publicly; it is unique to you. If you can no longer attend, simply ignore this email and the church will know.",
  );

  const html = renderSimpleMessageEmail({
    eyebrow: "You're invited",
    title: `${args.eventTitle}`,
    preview: `${args.churchName} invites you to ${args.eventTitle}.`,
    greeting: `Dear ${args.toName},`,
    paragraphs,
    note: "Payments are taken via secure card processing. As is custom in memberry, places are confirmed at the point of payment and are non-refundable.",
  });

  const result = await sendWithLog({
    churchId: args.churchId ?? null,
    toEmail: args.toEmail,
    toName: args.toName,
    emailType: "guest_invite",
    entityType: "event",
    entityId: args.eventId ?? null,
    dedupeKey: null,
    subject: `Invitation: ${args.eventTitle}`,
    html,
    text: `${paragraphs.join("\n\n")}\n`,
    metadata: { church_name: args.churchName, event_title: args.eventTitle },
  });

  return { sent: result.ok };
}

type GuestSelfRegisterArgs = {
  toEmail: string;
  toName: string;
  churchName: string;
  newcomerPortalUrl: string;
  upcomingCount: number;
  churchId?: string | null;
};

export async function sendGuestSelfRegisterEmail(args: GuestSelfRegisterArgs) {
  if (!args.toEmail) return { sent: false };

  const paragraphs: string[] = [
    `Thank you for adding yourself to the ${args.churchName} newcomer directory.`,
  ];
  if (args.upcomingCount > 0) {
    paragraphs.push(
      args.upcomingCount === 1
        ? "There is one upcoming event you can book yourself into right now."
        : `There are ${args.upcomingCount} upcoming events you can book yourself into right now.`,
    );
  } else {
    paragraphs.push(
      "There are no events open to newcomers at the moment. We will let you know when something new is announced.",
    );
  }
  paragraphs.push(
    `Your private newcomer link is below. Use it any time to book future visits, update your dietary requirements, or review your visit history. Please do not share it publicly.\n${args.newcomerPortalUrl}`,
  );

  const html = renderSimpleMessageEmail({
    eyebrow: "You're in",
    title: `Welcome to ${args.churchName}`,
    preview: `Your newcomer profile at ${args.churchName} is ready.`,
    greeting: `Dear ${args.toName},`,
    paragraphs,
    note: "This link is unique to you and never expires unless the church revokes it. Bookmark it for next time.",
  });

  const result = await sendWithLog({
    churchId: args.churchId ?? null,
    toEmail: args.toEmail,
    toName: args.toName,
    emailType: "guest_self_register",
    entityType: "guest",
    entityId: args.toEmail.toLowerCase(),
    dedupeKey: null,
    subject: `Welcome to ${args.churchName}`,
    html,
    text: `${paragraphs.join("\n\n")}\n`,
    metadata: { church_name: args.churchName },
  });

  return { sent: result.ok };
}

type GuestPostEventArgs = {
  toEmail: string;
  toName: string;
  churchName: string;
  eventTitle: string;
  charityRaised?: number | null;
  newcomerPortalUrl?: string | null;
  churchId?: string | null;
  eventId?: string | null;
};

export async function sendGuestPostEventEmail(args: GuestPostEventArgs) {
  if (!args.toEmail) return { sent: false };

  const paragraphs: string[] = [
    `Thank you for joining us at ${args.eventTitle}. It was a pleasure to welcome you.`,
  ];
  if (typeof args.charityRaised === "number" && args.charityRaised > 0) {
    paragraphs.push(
      `Together we raised £${args.charityRaised.toFixed(2)} for our chosen charity. Thank you for your generosity.`,
    );
  }
  paragraphs.push(
    `If you would like to know about future ${args.churchName} events, simply reply and we will be in touch.`,
  );
  if (args.newcomerPortalUrl) {
    paragraphs.push(
      `You can review your visit history and update your dietary requirements at any time here: ${args.newcomerPortalUrl}`,
    );
  }

  const html = renderSimpleMessageEmail({
    eyebrow: "Thank you",
    title: "Thank you for joining us",
    preview: `Thank you for attending ${args.eventTitle}.`,
    greeting: `Dear ${args.toName},`,
    paragraphs,
  });

  const result = await sendWithLog({
    churchId: args.churchId ?? null,
    toEmail: args.toEmail,
    toName: args.toName,
    emailType: "guest_post_event",
    entityType: "event",
    entityId: args.eventId ?? null,
    dedupeKey: args.eventId
      ? `post_event_${args.eventId}_${args.toEmail.toLowerCase()}`
      : null,
    subject: `Thank you for joining us at ${args.eventTitle}`,
    html,
    text: `${paragraphs.join("\n\n")}\n`,
    metadata: {
      church_name: args.churchName,
      event_title: args.eventTitle,
      charity_raised: args.charityRaised ?? null,
    },
  });

  return { sent: result.ok };
}
