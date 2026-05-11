import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import * as db from "@/lib/db";
import * as mockDb from "@/lib/mock-db";
import { getLodgeSlugFromRequest } from "@/lib/tenant";
import { lodgePayFromEmail, renderSimpleMessageEmail } from "@/lib/email/templates";
import { sendWebsiteNotification } from "@/lib/email/website-notifications";
import { getLodgeAdminNotificationRecipients } from "@/lib/email/website-recipients";
import type { LodgeSiteSectionStyle } from "@/lib/db/types";
import {
  parseRecipientList,
  rejectHoneypot,
  rejectRateLimited,
} from "@/lib/api/form-protection";

const CONTACT_NOTIFICATION_EMAIL = "ag@experrt.com";

function textValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: NextRequest) {
  try {
    const lodgeSlug = getLodgeSlugFromRequest(request);
    const isTenantMode = request.nextUrl.searchParams.has("lodge");
    const body = (await request.json()) as Record<string, unknown>;
    const honeypot = rejectHoneypot(body);
    if (honeypot) return honeypot;
    const name = textValue(body.name);
    const email = textValue(body.email);
    const subject = textValue(body.subject) || "Website enquiry";
    const message = textValue(body.message);
    const phone = textValue(body.phone) || null;
    const sectionId = typeof body.section_id === "string" ? body.section_id : null;

    const rateLimited = rejectRateLimited(request, "contact", email);
    if (rateLimited) return rateLimited;

    const resolvedLodge = isTenantMode
      ? isSupabaseConfigured()
        ? await db.getLodgeBySlug(lodgeSlug)
        : mockDb.getLodgeBySlug(lodgeSlug)
      : null;
    let formStyle: LodgeSiteSectionStyle | null = null;
    if (isTenantMode && resolvedLodge && sectionId) {
      const site = isSupabaseConfigured()
        ? await db.getLodgeSite(resolvedLodge.id)
        : mockDb.getLodgeSite(lodgeSlug);
      formStyle =
        site?.sections.find((section) => section.id === sectionId)?.style ??
        site?.custom_pages
          ?.flatMap((page) => page.sections)
          .find((section) => section.id === sectionId)?.style ??
        null;
    }
    const configuredFields = formStyle?.form_fields ?? null;
    const visible = (field: string) =>
      !configuredFields || configuredFields.length === 0 || configuredFields.includes(field);
    const required = (field: string) => Boolean(formStyle?.form_required_fields?.includes(field));

    if (!name || !email || (visible("message") && !message)) {
      return NextResponse.json(
        { error: "Name, email, and message are required." },
        { status: 400 }
      );
    }

    if (
      (required("phone") && !phone) ||
      (required("subject") && !subject) ||
      (visible("consent") && body.consent !== true)
    ) {
      return NextResponse.json(
        { error: "Please complete the required form fields." },
        { status: 400 }
      );
    }

    const notificationContext =
      resolvedLodge ?? {
        id: null,
        name: "LodgePay",
        support_email: CONTACT_NOTIFICATION_EMAIL,
        secretary_name: null,
      };
    const responderName = resolvedLodge?.name ?? "LodgePay";
    const recipients = await getLodgeAdminNotificationRecipients(
      resolvedLodge,
      parseRecipientList(formStyle?.form_notification_recipients)
    );

    await sendWebsiteNotification({
      lodge: notificationContext,
      replyTo: email,
      subject: `[LodgePay contact] ${subject}`,
      eyebrow: isTenantMode ? "Lodge website enquiry" : "LodgePay enquiry",
      title: subject,
      preview: `New enquiry from ${name}.`,
      intro: isTenantMode
        ? "A new lodge website enquiry has been submitted."
        : "A new LodgePay website enquiry has been submitted.",
      rows: [
        { label: "Name", value: name },
        { label: "Email", value: email },
        { label: "Phone", value: visible("phone") ? phone : null },
        { label: "Consent", value: visible("consent") ? "Accepted" : null },
      ],
      message: visible("message") ? message : null,
      recipients,
    });

    const resendKey = process.env.RESEND_API_KEY;
    if (resendKey) {
      const { Resend } = await import("resend");
      const resend = new Resend(resendKey);
      const from = lodgePayFromEmail(process.env.EMAIL_FROM);

      await resend.emails.send({
        from,
        to: email,
        replyTo: CONTACT_NOTIFICATION_EMAIL,
        subject: formStyle?.form_autoresponder_subject || (isTenantMode
          ? `We have received your enquiry for ${responderName}`
          : "We have received your LodgePay enquiry"),
        html: renderSimpleMessageEmail({
          eyebrow: "Enquiry received",
          title: isTenantMode ? "Thanks for getting in touch" : "Thanks for contacting LodgePay",
          preview: isTenantMode
            ? "Your message has reached the lodge."
            : "Your message has reached the LodgePay team.",
          greeting: `Hello ${name},`,
          paragraphs: [
            formStyle?.form_autoresponder_body ||
              (isTenantMode
              ? `Thank you for getting in touch. Your message has reached ${responderName} and we will reply as soon as we can.`
              : "Thank you for getting in touch. Your message has reached the LodgePay team and we will reply as soon as we can."),
            isTenantMode
              ? "If your enquiry is about visiting or membership, please include any dates or context that would help the lodge respond."
              : "If your enquiry is about a product walkthrough, we will come back with a practical next step based on your lodge or group.",
          ],
          note: `Your message: ${message}`,
        }),
        text: `Hello ${name},\n\nThank you for getting in touch. Your message has reached ${responderName} and we will reply as soon as we can.\n\nYour message:\n${message}`,
      });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Contact API error:", e);
    return NextResponse.json(
      { error: "Something went wrong." },
      { status: 500 }
    );
  }
}
