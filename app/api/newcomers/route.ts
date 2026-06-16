import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import { rejectIfMockDisabled } from "@/lib/db/reject-mock";
import * as db from "@/lib/db";
import * as mockDb from "@/lib/mock-db";
import { getMosqueSlugFromRequest } from "@/lib/tenant";
import { sendWebsiteNotification } from "@/lib/email/website-notifications";
import { getMosqueAdminNotificationRecipients } from "@/lib/email/website-recipients";
import { renderSimpleMessageEmail } from "@/lib/email/templates";
import { sendWithLog } from "@/lib/email/send-with-log";
import type { MosqueSiteSectionStyle } from "@/lib/db/types";
import {
  parseRecipientList,
  rejectHoneypot,
  rejectRateLimited,
} from "@/lib/api/form-protection";

const newcomerSchema = {
  first_name: (v: unknown) => typeof v === "string" && v.trim().length > 0,
  last_name: (v: unknown) => typeof v === "string" && v.trim().length > 0,
  email: (v: unknown) => typeof v === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
  phone: (v: unknown) => v == null || typeof v === "string",
  location: (v: unknown) => v == null || typeof v === "string",
  how_heard: (v: unknown) => v == null || typeof v === "string",
  message: (v: unknown) => v == null || typeof v === "string",
};

function textValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function validateConfiguredNewcomerFields(
  style: MosqueSiteSectionStyle | null,
  values: {
    phone: string | null;
    location: string | null;
    how_heard: string | null;
    message: string | null;
    consent: boolean;
  }
) {
  const fields = style?.form_fields ?? null;
  const visible = (field: string) =>
    !fields || fields.length === 0 || fields.includes(field);
  const required = (field: string) => Boolean(style?.form_required_fields?.includes(field));

  if (
    (required("phone") && !values.phone) ||
    (required("location") && !values.location) ||
    (required("how_heard") && !values.how_heard) ||
    (required("message") && !values.message) ||
    (visible("consent") && !values.consent)
  ) {
    return NextResponse.json(
      { error: "Please complete the required form fields." },
      { status: 400 }
    );
  }
  return null;
}

async function sendNewcomerAutoReply({
  to,
  name,
  mosqueName,
  replyTo,
  style,
  mosqueId,
}: {
  to: string;
  name: string;
  mosqueName: string;
  replyTo?: string | null;
  style: MosqueSiteSectionStyle | null;
  mosqueId: string | null;
}) {
  if (!process.env.RESEND_API_KEY) return;
  const body =
    style?.form_autoresponder_body ||
    `Thank you for your enquiry. Your details have reached ${mosqueName} and the mosque will be in touch.`;

  await sendWithLog({
    mosqueId,
    toEmail: to,
    toName: name,
    emailType: "newcomer_autoresponder",
    entityType: "newcomer",
    entityId: null,
    dedupeKey: null,
    replyTo: replyTo || null,
    subject:
      style?.form_autoresponder_subject ||
      `We received your enquiry for ${mosqueName}`,
    html: renderSimpleMessageEmail({
      eyebrow: "Enquiry received",
      title: "Thanks for your interest",
      preview: "Your membership enquiry has reached the mosque.",
      greeting: `Hello ${name},`,
      paragraphs: [body],
    }),
    text: `Hello ${name},\n\n${body}`,
    metadata: { mosque_name: mosqueName },
  });
}

export async function POST(request: NextRequest) {
  const _rejectMock = rejectIfMockDisabled();
  if (_rejectMock) return _rejectMock;

  try {
    const mosqueSlug = getMosqueSlugFromRequest(request);
    const body = (await request.json()) as Record<string, unknown>;
    const honeypot = rejectHoneypot(body);
    if (honeypot) return honeypot;
    const first_name = textValue(body.first_name);
    const last_name = textValue(body.last_name);
    const email = textValue(body.email);
    const phone = textValue(body.phone) || null;
    const location = textValue(body.location) || null;
    const how_heard = textValue(body.how_heard) || null;
    const message = textValue(body.message) || null;
    const sectionId = typeof body.section_id === "string" ? body.section_id : null;
    const rateLimited = rejectRateLimited(request, "newcomer", email);
    if (rateLimited) return rateLimited;

    if (
      !newcomerSchema.first_name(first_name) ||
      !newcomerSchema.last_name(last_name) ||
      !newcomerSchema.email(email)
    ) {
      return NextResponse.json(
        { error: "First name, last name, and a valid email are required." },
        { status: 400 }
      );
    }

    if (isSupabaseConfigured()) {
      const mosque = await db.getMosqueBySlug(mosqueSlug);
      if (!mosque) {
        return NextResponse.json({ error: "Mosque not found." }, { status: 404 });
      }
      const site = sectionId ? await db.getMosqueSite(mosque.id) : null;
      const formStyle =
        site?.sections.find((section) => section.id === sectionId)?.style ??
        site?.custom_pages
          ?.flatMap((page) => page.sections)
          .find((section) => section.id === sectionId)?.style ??
        null;
      const validation = validateConfiguredNewcomerFields(formStyle, {
        phone,
        location,
        how_heard,
        message,
        consent: body.consent === true,
      });
      if (validation) return validation;
      const newcomer = await db.addNewcomer(mosque.id, {
        first_name: first_name!,
        last_name: last_name!,
        email: email!,
        phone,
        location,
        source: how_heard ?? "Website",
        how_heard_about_us: how_heard,
        initial_message: message,
        stage: "expression_of_interest",
        assigned_to: null,
        proposer_member_id: null,
        proposer_name: null,
        seconder_member_id: null,
        seconder_name: null,
        next_step: null,
        next_step_due_date: null,
        proposal_date: null,
        membership_decision_date: null,
        interview_completed_at: null,
        consent_given_at: null,
        notes: null,
        converted_member_id: null,
        converted_at: null,
      });
      const recipients = await getMosqueAdminNotificationRecipients(
        mosque,
        parseRecipientList(formStyle?.form_notification_recipients)
      );
      await sendWebsiteNotification({
        mosque,
        replyTo: email,
        subject: `[Newcomer intake] ${first_name} ${last_name}`,
        eyebrow: "Newcomer intake",
        title: "New membership newcomer",
        preview: `New newcomer from ${first_name} ${last_name}.`,
        intro: "A prospective member has submitted the mosque website newcomer intake form.",
        rows: [
          { label: "Name", value: `${first_name} ${last_name}` },
          { label: "Email", value: email },
          { label: "Phone", value: phone },
          { label: "Location", value: location },
          { label: "How heard", value: how_heard },
          { label: "CRM newcomer ID", value: newcomer.id },
        ],
        message,
        recipients,
      });
      await sendNewcomerAutoReply({
        to: email!,
        name: first_name!,
        mosqueName: mosque.name,
        replyTo: mosque.support_email,
        style: formStyle,
        mosqueId: mosque.id,
      });
      return NextResponse.json({ id: newcomer.id, success: true });
    }

    const mosque = mockDb.getMosqueBySlug(mosqueSlug);
    if (!mosque) {
      return NextResponse.json({ error: "Mosque not found." }, { status: 404 });
    }
    const site = sectionId ? mockDb.getMosqueSite(mosqueSlug) : null;
    const formStyle =
      site?.sections.find((section) => section.id === sectionId)?.style ??
      site?.custom_pages
        ?.flatMap((page) => page.sections)
        .find((section) => section.id === sectionId)?.style ??
      null;
    const validation = validateConfiguredNewcomerFields(formStyle, {
      phone,
      location,
      how_heard,
      message,
      consent: body.consent === true,
    });
    if (validation) return validation;
    const newcomer = mockDb.addNewcomer({
      mosque_slug: mosqueSlug,
      first_name: first_name!,
      last_name: last_name!,
      email: email!,
      phone,
      location,
      source: how_heard ?? "Website",
      how_heard_about_us: how_heard,
      initial_message: message,
      stage: "expression_of_interest",
      assigned_to: null,
    });
    const recipients = await getMosqueAdminNotificationRecipients(
      mosque,
      parseRecipientList(formStyle?.form_notification_recipients)
    );

    await sendWebsiteNotification({
      mosque,
      replyTo: email,
      subject: `[Newcomer intake] ${first_name} ${last_name}`,
      eyebrow: "Newcomer intake",
      title: "New membership newcomer",
      preview: `New newcomer from ${first_name} ${last_name}.`,
      intro: "A prospective member has submitted the mosque website newcomer intake form.",
      rows: [
        { label: "Name", value: `${first_name} ${last_name}` },
        { label: "Email", value: email },
        { label: "Phone", value: phone },
        { label: "Location", value: location },
        { label: "How heard", value: how_heard },
        { label: "CRM newcomer ID", value: newcomer.id },
      ],
      message,
      recipients,
    });

    await sendNewcomerAutoReply({
      to: email!,
      name: first_name!,
      mosqueName: mosque.name,
      replyTo: mosque.support_email,
      style: formStyle,
      mosqueId: null,
    });

    return NextResponse.json({ id: newcomer.id, success: true });
  } catch (e) {
    console.error("Newcomers API error:", e);
    return NextResponse.json(
      { error: "Something went wrong." },
      { status: 500 }
    );
  }
}
