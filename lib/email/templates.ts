import { formatDate } from "@/lib/utils";

const brand = {
  name: "LodgePay",
  ink: "#111827",
  muted: "#64748b",
  faint: "#94a3b8",
  blue: "#0B43B8",
  blueDark: "#082E7D",
  blueSoft: "#3B6FE0",
  surface: "#F5F7FB",
  surfaceSubtle: "#F8FAFC",
  border: "#E6EAF2",
};

export function lodgePayFromEmail(value?: string | null) {
  const fallbackAddress = "noreply@lodgepayments.co.uk";
  const from = value?.trim();
  if (!from) return `LodgePay <${fallbackAddress}>`;

  const bracketMatch = from.match(/<([^>]+)>/);
  const address = bracketMatch?.[1]?.trim() || from;
  return `LodgePay <${address}>`;
}

export function escapeEmailHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function button(label: string, href: string) {
  const h = escapeEmailHtml(href);
  const t = escapeEmailHtml(label);
  return `
<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0;">
  <tr>
    <td align="left" bgcolor="${brand.blue}" style="border-radius:12px;">
      <a href="${h}" style="display:inline-block;border-radius:12px;background:${brand.blue};color:#ffffff;font-size:15px;font-weight:700;line-height:1.25;padding:14px 22px;text-decoration:none;mso-line-height-rule:exactly;-webkit-text-size-adjust:100%;">
        ${t}
      </a>
    </td>
  </tr>
</table>`;
}

function secondaryLink(label: string, href: string) {
  return `
    <a href="${escapeEmailHtml(href)}" style="color:${brand.blue};font-size:14px;font-weight:700;text-decoration:none;">
      ${escapeEmailHtml(label)}
    </a>
  `;
}

function renderShell({
  eyebrow,
  title,
  preview,
  children,
}: {
  eyebrow: string;
  title: string;
  preview: string;
  children: string;
}) {
  const logoUrl =
    process.env.EMAIL_LOGO_URL ??
    "https://fgtqpeswnakznsvibfvp.supabase.co/storage/v1/object/public/email-assets/lodgepay-email-logo.png";
  return `
    <!doctype html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
        <title>${escapeEmailHtml(title)}</title>
      </head>
      <body style="margin:0;background:${brand.surface};font-family:Inter,Arial,sans-serif;color:${brand.ink};">
        <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
          ${escapeEmailHtml(preview)}
        </div>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${brand.surface};padding:32px 12px;">
          <tr>
            <td align="center">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:680px;border-collapse:separate;border-spacing:0;">
                <tr>
                  <td align="center" style="padding:0 0 20px;text-align:center;">
                    <img src="${escapeEmailHtml(logoUrl)}" width="180" height="180" alt="${brand.name}" style="display:block;margin:0 auto 12px;height:180px;width:180px;border:0;outline:none;text-decoration:none;object-fit:contain;" />
                    <div style="font-size:12px;font-weight:800;letter-spacing:0.18em;text-transform:uppercase;color:${brand.blue};">${escapeEmailHtml(eyebrow)}</div>
                  </td>
                </tr>
                <tr>
                  <td style="border:1px solid ${brand.border};border-radius:24px;background:#ffffff;box-shadow:0 14px 40px rgba(8,46,125,0.08);">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;">
                      <tr>
                        <td style="overflow:hidden;border-radius:24px 24px 0 0;line-height:0;font-size:0;">
                          <div style="height:6px;background:linear-gradient(90deg,${brand.blueDark},${brand.blue},${brand.blueSoft});">&nbsp;</div>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:34px 30px 30px;">
                          ${children}
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:18px 8px 0;text-align:center;color:${brand.faint};font-size:12px;line-height:1.6;">
                    Sent securely by ${brand.name}. This message was generated from lodge records in the platform.
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;
}

export function renderBrandedEmail({
  eyebrow,
  title,
  preview,
  children,
}: {
  eyebrow: string;
  title: string;
  preview: string;
  children: string;
}) {
  return renderShell({ eyebrow, title, preview, children });
}

export function renderNotificationEmail({
  eyebrow,
  title,
  preview,
  intro,
  rows,
  message,
}: {
  eyebrow: string;
  title: string;
  preview: string;
  intro?: string;
  rows: Array<{ label: string; value: string }>;
  message?: string;
}) {
  return renderShell({
    eyebrow,
    title,
    preview,
    children: `
      <h1 style="margin:0;color:${brand.ink};font-size:28px;line-height:1.15;">${escapeEmailHtml(title)}</h1>
      ${
        intro
          ? `<p style="margin:16px 0 0;color:${brand.muted};font-size:16px;line-height:1.7;">${escapeEmailHtml(intro)}</p>`
          : ""
      }
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:24px 0 0;border-collapse:separate;border-spacing:0;border:1px solid ${brand.border};border-radius:18px;overflow:hidden;">
        ${rows
          .map(
            (row) => `
              <tr>
                <td style="width:34%;padding:13px 16px;border-bottom:1px solid ${brand.border};background:${brand.surfaceSubtle};color:${brand.muted};font-size:13px;font-weight:700;">${escapeEmailHtml(row.label)}</td>
                <td style="padding:13px 16px;border-bottom:1px solid ${brand.border};color:${brand.ink};font-size:14px;line-height:1.6;">${escapeEmailHtml(row.value)}</td>
              </tr>
            `
          )
          .join("")}
      </table>
      ${
        message
          ? `<div style="margin-top:22px;border-radius:18px;border:1px solid ${brand.border};background:#ffffff;padding:18px;color:${brand.ink};font-size:15px;line-height:1.7;white-space:pre-wrap;">${escapeEmailHtml(message)}</div>`
          : ""
      }
    `,
  });
}

export function renderSimpleMessageEmail({
  eyebrow,
  title,
  preview,
  greeting,
  paragraphs,
  cta,
  note,
}: {
  eyebrow: string;
  title: string;
  preview: string;
  greeting?: string;
  paragraphs: string[];
  cta?: { label: string; href: string };
  note?: string;
}) {
  return renderShell({
    eyebrow,
    title,
    preview,
    children: `
      <h1 style="margin:0;color:${brand.ink};font-size:28px;line-height:1.15;">${escapeEmailHtml(title)}</h1>
      ${
        greeting
          ? `<p style="margin:18px 0 0;color:${brand.muted};font-size:16px;line-height:1.7;">${escapeEmailHtml(greeting)}</p>`
          : ""
      }
      ${paragraphs
        .map(
          (paragraph) =>
            `<p style="margin:12px 0 0;color:${brand.muted};font-size:16px;line-height:1.7;">${escapeEmailHtml(paragraph)}</p>`
        )
        .join("")}
      ${cta ? `<div style="margin:26px 0 24px;">${button(cta.label, cta.href)}</div>` : ""}
      ${
        note
          ? `<div style="margin-top:22px;border-radius:18px;border:1px solid ${brand.border};background:${brand.surfaceSubtle};padding:16px 18px;color:${brand.muted};font-size:14px;line-height:1.7;">${escapeEmailHtml(note)}</div>`
          : ""
      }
    `,
  });
}

function listItems(items: string[], ordered = false) {
  if (items.length === 0) return "";
  const tag = ordered ? "ol" : "ul";
  return `
    <${tag} style="margin:12px 0 0;padding-left:22px;color:${brand.ink};font-size:15px;line-height:1.7;">
      ${items.map((item) => `<li>${escapeEmailHtml(item)}</li>`).join("")}
    </${tag}>
  `;
}

export function renderStaffInviteEmail({
  name,
  roleLabel,
  lodgeName,
  actionUrl,
  actionLabel,
}: {
  name: string;
  roleLabel: string;
  lodgeName: string;
  actionUrl: string;
  actionLabel: string;
}) {
  return renderShell({
    eyebrow: "Admin invite",
    title: "Your LodgePay admin invite",
    preview: `You have been invited to manage ${lodgeName}.`,
    children: `
      <h1 style="margin:0;color:${brand.ink};font-size:28px;line-height:1.15;">Welcome to your lodge admin workspace</h1>
      <p style="margin:18px 0 0;color:${brand.muted};font-size:16px;line-height:1.7;">Hello ${escapeEmailHtml(name)},</p>
      <p style="margin:12px 0 0;color:${brand.muted};font-size:16px;line-height:1.7;">
        You have been given <strong style="color:${brand.ink};">${escapeEmailHtml(roleLabel)}</strong> access for <strong style="color:${brand.ink};">${escapeEmailHtml(lodgeName)}</strong>.
      </p>
      <div style="margin:26px 0 24px;">${button(actionLabel, actionUrl)}</div>
      <div style="border-radius:18px;border:1px solid ${brand.border};background:${brand.surfaceSubtle};padding:16px 18px;">
        <p style="margin:0;color:${brand.ink};font-size:14px;font-weight:800;">What you can do next</p>
        <p style="margin:6px 0 0;color:${brand.muted};font-size:14px;line-height:1.6;">Set your password, sign in, and access the tools assigned to your role.</p>
      </div>
    `,
  });
}

export function renderPasswordResetEmail({
  name,
  actionUrl,
  audience,
  lodgeName,
}: {
  name: string;
  actionUrl: string;
  audience: "admin" | "member";
  lodgeName?: string | null;
}) {
  const eyebrow = audience === "admin" ? "Admin password reset" : "Member password reset";
  const heading =
    audience === "admin"
      ? "Reset your admin password"
      : "Reset your member portal password";
  const intro =
    audience === "admin"
      ? `We received a request to reset the password for your LodgePay admin account${
          lodgeName ? ` for ${lodgeName}` : ""
        }.`
      : `We received a request to reset the password for your LodgePay member portal${
          lodgeName ? ` at ${lodgeName}` : ""
        }.`;
  return renderShell({
    eyebrow,
    title: heading,
    preview: heading,
    children: `
      <h1 style="margin:0;color:${brand.ink};font-size:28px;line-height:1.15;">${escapeEmailHtml(heading)}</h1>
      <p style="margin:18px 0 0;color:${brand.muted};font-size:16px;line-height:1.7;">Hello ${escapeEmailHtml(name)},</p>
      <p style="margin:12px 0 0;color:${brand.muted};font-size:16px;line-height:1.7;">
        ${escapeEmailHtml(intro)} Click the button below to choose a new password. This link will expire shortly for your security.
      </p>
      <div style="margin:26px 0 24px;">${button("Reset password", actionUrl)}</div>
      <div style="border-radius:18px;border:1px solid ${brand.border};background:${brand.surfaceSubtle};padding:16px 18px;">
        <p style="margin:0;color:${brand.ink};font-size:14px;font-weight:800;">Didn&rsquo;t request this?</p>
        <p style="margin:6px 0 0;color:${brand.muted};font-size:14px;line-height:1.6;">You can safely ignore this email. Your password will stay the same until you choose a new one.</p>
      </div>
    `,
  });
}

export function renderMemberInviteEmail({
  name,
  lodgeName,
  actionUrl,
  actionLabel,
}: {
  name: string;
  lodgeName: string;
  actionUrl: string;
  actionLabel: string;
}) {
  return renderShell({
    eyebrow: "Member portal",
    title: "Your LodgePay member portal invite",
    preview: `You have been invited to access the ${lodgeName} member portal.`,
    children: `
      <h1 style="margin:0;color:${brand.ink};font-size:28px;line-height:1.15;">Welcome to your member portal</h1>
      <p style="margin:18px 0 0;color:${brand.muted};font-size:16px;line-height:1.7;">Hello ${escapeEmailHtml(name)},</p>
      <p style="margin:12px 0 0;color:${brand.muted};font-size:16px;line-height:1.7;">
        You have been invited to access the member portal for <strong style="color:${brand.ink};">${escapeEmailHtml(lodgeName)}</strong>.
      </p>
      <div style="margin:26px 0 24px;">${button(actionLabel, actionUrl)}</div>
      <div style="border-radius:18px;border:1px solid ${brand.border};background:${brand.surfaceSubtle};padding:16px 18px;">
        <p style="margin:0;color:${brand.ink};font-size:14px;font-weight:800;">What you can do next</p>
        <p style="margin:6px 0 0;color:${brand.muted};font-size:14px;line-height:1.6;">Set your password, sign in, view summons, RSVP to events, manage dues, and keep your profile details up to date.</p>
      </div>
    `,
  });
}

export function renderSummonsEmail({
  memberName,
  lodgeName,
  eventTitle,
  eventDate,
  venue,
  openingText,
  summonsUrl,
  rsvpUrl,
  agendaItems,
  menuItems,
  notices,
  masterElectName,
  masterElectQualification,
  visitingOfficers,
  visitingOfficerName,
  visitingOfficerEmail,
  visitingOfficerPhone,
  nextMeetingDate,
  nextMeetingNote,
}: {
  memberName: string;
  lodgeName: string;
  eventTitle: string;
  eventDate: string;
  venue: string;
  openingText: string;
  summonsUrl: string;
  rsvpUrl: string;
  agendaItems: string[];
  menuItems: string[];
  notices: string[];
  masterElectName?: string | null;
  masterElectQualification?: string | null;
  visitingOfficers?: Array<{
    name?: string | null;
    email?: string | null;
    phone?: string | null;
  }> | null;
  visitingOfficerName?: string | null;
  visitingOfficerEmail?: string | null;
  visitingOfficerPhone?: string | null;
  nextMeetingDate?: string | null;
  nextMeetingNote?: string | null;
}) {
  const masterElectBlock =
    masterElectName || masterElectQualification
      ? `<div style="margin-top:16px;border-radius:14px;border:1px solid ${brand.border};background:${brand.surfaceSubtle};padding:14px 16px;">
          ${
            masterElectName
              ? `<p style="margin:0;color:${brand.ink};font-size:14px;font-weight:700;">Master Elect: ${escapeEmailHtml(masterElectName)}</p>`
              : ""
          }
          ${
            masterElectQualification
              ? `<p style="margin:${masterElectName ? "6px" : "0"} 0 0;color:${brand.muted};font-size:14px;line-height:1.7;">${escapeEmailHtml(masterElectQualification)}</p>`
              : ""
          }
        </div>`
      : "";

  const safeVisitingOfficers =
    visitingOfficers?.filter(
      (officer) => officer.name || officer.email || officer.phone
    ) ?? [];
  const legacyVisitingOfficers =
    safeVisitingOfficers.length === 0 &&
    (visitingOfficerName || visitingOfficerEmail || visitingOfficerPhone)
      ? [
          {
            name: visitingOfficerName,
            email: visitingOfficerEmail,
            phone: visitingOfficerPhone,
          },
        ]
      : [];
  const allVisitingOfficers = [...safeVisitingOfficers, ...legacyVisitingOfficers];
  const voRows = allVisitingOfficers.map((officer, index) => {
    const heading =
      allVisitingOfficers.length === 1
        ? "Visiting Officer"
        : `Visiting Officer ${index + 1}`;

    return `<div style="margin:${index === 0 ? "0" : "12px"} 0 0;">
      ${
        officer.name
          ? `<p style="margin:0;color:${brand.ink};font-size:14px;font-weight:700;">${heading}: ${escapeEmailHtml(officer.name)}</p>`
          : `<p style="margin:0;color:${brand.ink};font-size:14px;font-weight:700;">${heading}</p>`
      }
      ${
        officer.email
          ? `<p style="margin:6px 0 0;color:${brand.muted};font-size:14px;line-height:1.6;">Email: ${escapeEmailHtml(officer.email)}</p>`
          : ""
      }
      ${
        officer.phone
          ? `<p style="margin:4px 0 0;color:${brand.muted};font-size:14px;line-height:1.6;">Tel: ${escapeEmailHtml(officer.phone)}</p>`
          : ""
      }
    </div>`;
  });
  if (nextMeetingDate) {
    voRows.push(
      `<p style="margin:10px 0 0;color:${brand.muted};font-size:14px;line-height:1.6;"><strong style="color:${brand.ink};">Next regular meeting:</strong> ${escapeEmailHtml(formatDate(nextMeetingDate))}${nextMeetingNote ? ` — ${escapeEmailHtml(nextMeetingNote)}` : ""}</p>`
    );
  }

  const closingBlock = voRows.length
    ? `<div style="margin-top:22px;border-radius:14px;border:1px solid ${brand.border};background:${brand.surfaceSubtle};padding:14px 16px;">${voRows.join("")}</div>`
    : "";

  return renderShell({
    eyebrow: "Meeting summons",
    title: eventTitle,
    preview: `You are summoned to attend ${lodgeName} on ${formatDate(eventDate)}.`,
    children: `
      <p style="margin:0 0 10px;color:${brand.blue};font-size:12px;font-weight:800;letter-spacing:0.16em;text-transform:uppercase;">${escapeEmailHtml(lodgeName)}</p>
      <h1 style="margin:0;color:${brand.ink};font-size:30px;line-height:1.12;">${escapeEmailHtml(eventTitle)}</h1>
      <p style="margin:18px 0 0;color:${brand.muted};font-size:16px;line-height:1.7;">Dear ${escapeEmailHtml(memberName)},</p>
      <p style="margin:12px 0 0;color:${brand.muted};font-size:16px;line-height:1.7;white-space:pre-line;">
        ${escapeEmailHtml(openingText)}
      </p>
      ${
        venue
          ? `<p style="margin:8px 0 0;color:${brand.muted};font-size:15px;line-height:1.7;"><strong style="color:${brand.ink};">Venue:</strong> ${escapeEmailHtml(venue)}</p>`
          : ""
      }
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:26px 0 24px;">
        <tr>
          <td style="padding:0 14px 8px 0;vertical-align:middle;">${button("View Summons", summonsUrl)}</td>
          <td style="vertical-align:middle;padding-bottom:8px;">${secondaryLink("RSVP", rsvpUrl)}</td>
        </tr>
      </table>
      <div style="border-top:1px solid ${brand.border};padding-top:22px;">
        <h2 style="margin:0;color:${brand.ink};font-size:18px;">Lodge Business</h2>
        ${listItems(agendaItems, true)}
        ${masterElectBlock}
      </div>
      ${
        menuItems.length
          ? `<div style="margin-top:22px;"><h2 style="margin:0;color:${brand.ink};font-size:18px;">Dining</h2>${listItems(menuItems)}</div>`
          : ""
      }
      ${
        notices.length
          ? `<div style="margin-top:22px;"><h2 style="margin:0;color:${brand.ink};font-size:18px;">Notices</h2>${notices
              .map(
                (notice) =>
                  `<p style="margin:10px 0 0;color:${brand.muted};font-size:15px;line-height:1.7;">${escapeEmailHtml(notice)}</p>`
              )
              .join("")}</div>`
          : ""
      }
      ${closingBlock}
    `,
  });
}

export function renderDuesReminderEmail({
  memberName,
  lodgeName,
  amountDue,
  dueDate,
  portalUrl,
  reminderNumber,
}: {
  memberName: string;
  lodgeName: string;
  amountDue: string;
  dueDate: string;
  portalUrl: string;
  reminderNumber: number;
}) {
  const eyebrow =
    reminderNumber === 1
      ? "Friendly reminder"
      : reminderNumber === 2
        ? "Second reminder"
        : "Final reminder";
  return renderShell({
    eyebrow,
    title: `${lodgeName} dues reminder`,
    preview: `Your annual lodge dues of ${amountDue} are due ${dueDate}.`,
    children: `
      <h1 style="margin:0;color:${brand.ink};font-size:28px;line-height:1.15;">Annual dues reminder</h1>
      <p style="margin:18px 0 0;color:${brand.muted};font-size:16px;line-height:1.7;">Dear ${escapeEmailHtml(memberName)},</p>
      <p style="margin:14px 0 0;color:${brand.muted};font-size:16px;line-height:1.7;">
        This is a ${escapeEmailHtml(eyebrow.toLowerCase())} that your annual dues for
        ${escapeEmailHtml(lodgeName)} of <strong style="color:${brand.ink};">${escapeEmailHtml(amountDue)}</strong>
        are due on <strong style="color:${brand.ink};">${escapeEmailHtml(dueDate)}</strong>.
      </p>
      <p style="margin:14px 0 0;color:${brand.muted};font-size:16px;line-height:1.7;">
        You can review your dues, set up instalments, or speak to the treasurer from your member portal.
      </p>
      <div style="margin:26px 0 24px;">${button("Review my dues", portalUrl)}</div>
      <p style="margin:0;color:${brand.muted};font-size:13px;line-height:1.6;">
        If you have already paid, please ignore this email. ${secondaryLink("Contact the treasurer", portalUrl)}
      </p>
    `,
  });
}

export function renderInitiationDuesEmail({
  memberName,
  duesAmount,
  paymentUrl,
}: {
  memberName: string;
  duesAmount: string;
  paymentUrl: string;
}) {
  return renderShell({
    eyebrow: "Member welcome",
    title: "Welcome to the lodge",
    preview: "Your membership fee payment link is ready.",
    children: `
      <h1 style="margin:0;color:${brand.ink};font-size:30px;line-height:1.12;">Welcome to the lodge</h1>
      <p style="margin:18px 0 0;color:${brand.muted};font-size:16px;line-height:1.7;">Congratulations ${escapeEmailHtml(memberName)}. We are delighted to welcome you as a member.</p>
      <p style="margin:12px 0 0;color:${brand.muted};font-size:16px;line-height:1.7;">
        Your annual membership fees of <strong style="color:${brand.ink};">${escapeEmailHtml(duesAmount)}</strong> are now due. You can pay in full or set up instalments securely online.
      </p>
      <div style="margin:26px 0 24px;">${button("Pay Membership Fees", paymentUrl)}</div>
      <p style="margin:0;color:${brand.muted};font-size:14px;line-height:1.7;">If you have any questions, please contact your lodge secretary.</p>
    `,
  });
}
