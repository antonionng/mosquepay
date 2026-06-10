import { NextRequest, NextResponse } from "next/server";
import {
  renderNotificationEmail,
  renderSimpleMessageEmail,
} from "@/lib/email/templates";
import { sendWithLog } from "@/lib/email/send-with-log";

const CONTACT_NOTIFICATION_EMAIL = "ag@experrt.com";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const full_name = body.full_name?.trim();
    const work_email = body.work_email?.trim();
    const church_name = body.church_name?.trim();
    const role = body.role?.trim();
    const church_count = Number(body.church_count ?? 1);
    const priorities = body.priorities?.trim();

    if (!full_name || !work_email || !church_name || !role) {
      return NextResponse.json(
        { error: "Name, work email, church name, and role are required." },
        { status: 400 }
      );
    }

    if (process.env.RESEND_API_KEY) {
      const safeChurchCount = String(Number.isFinite(church_count) ? church_count : 1);

      await Promise.all([
        sendWithLog({
          churchId: null,
          toEmail: CONTACT_NOTIFICATION_EMAIL,
          emailType: "demo_request_team",
          entityType: "demo_request",
          entityId: null,
          dedupeKey: null,
          replyTo: work_email,
          subject: `[ChurchPay demo request] ${church_name}`,
          html: renderNotificationEmail({
            eyebrow: "Demo request",
            title: "New demo request",
            preview: `New demo request from ${full_name}.`,
            intro: "A new ChurchPay demo request has been submitted.",
            rows: [
              { label: "Name", value: full_name },
              { label: "Email", value: work_email },
              { label: "Church", value: church_name },
              { label: "Role", value: role },
              { label: "Churches managed", value: safeChurchCount },
            ],
            message: priorities || "No priorities provided.",
          }),
          text: [
            `Name: ${full_name}`,
            `Email: ${work_email}`,
            `Church: ${church_name}`,
            `Role: ${role}`,
            `Churches managed: ${safeChurchCount}`,
            "",
            "Priorities:",
            priorities || "Not provided",
          ].join("\n"),
          metadata: {
            church_name,
            role,
            church_count: safeChurchCount,
          },
        }),
        sendWithLog({
          churchId: null,
          toEmail: work_email,
          toName: full_name,
          emailType: "demo_request_autoresponder",
          entityType: "demo_request",
          entityId: null,
          dedupeKey: null,
          replyTo: CONTACT_NOTIFICATION_EMAIL,
          subject: "We have received your ChurchPay demo request",
          html: renderSimpleMessageEmail({
            eyebrow: "Demo request received",
            title: "Thanks for booking time with ChurchPay",
            preview: "We have received your walkthrough request.",
            greeting: `Hello ${full_name},`,
            paragraphs: [
              "Thank you for requesting a ChurchPay walkthrough. We have your details and will reply with the next step shortly.",
              "The session will focus on your church or group, including the website, services, payments, newcomers, reporting, and the officer workflows that matter most.",
            ],
            note: `Request received for ${church_name}. Role: ${role}. Churches managed: ${safeChurchCount}.`,
          }),
          text: [
            `Hello ${full_name},`,
            "",
            "Thank you for requesting a ChurchPay walkthrough. We have your details and will reply with the next step shortly.",
            "",
            `Request received for ${church_name}.`,
          ].join("\n"),
        }),
      ]);
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Demo request API error:", e);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
