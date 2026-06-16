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
    const mosque_name = body.mosque_name?.trim();
    const role = body.role?.trim();
    const mosque_count = Number(body.mosque_count ?? 1);
    const priorities = body.priorities?.trim();

    if (!full_name || !work_email || !mosque_name || !role) {
      return NextResponse.json(
        { error: "Name, work email, mosque name, and role are required." },
        { status: 400 }
      );
    }

    if (process.env.RESEND_API_KEY) {
      const safeMosqueCount = String(Number.isFinite(mosque_count) ? mosque_count : 1);

      await Promise.all([
        sendWithLog({
          mosqueId: null,
          toEmail: CONTACT_NOTIFICATION_EMAIL,
          emailType: "demo_request_team",
          entityType: "demo_request",
          entityId: null,
          dedupeKey: null,
          replyTo: work_email,
          subject: `[MosquePay demo request] ${mosque_name}`,
          html: renderNotificationEmail({
            eyebrow: "Demo request",
            title: "New demo request",
            preview: `New demo request from ${full_name}.`,
            intro: "A new MosquePay demo request has been submitted.",
            rows: [
              { label: "Name", value: full_name },
              { label: "Email", value: work_email },
              { label: "Mosque", value: mosque_name },
              { label: "Role", value: role },
              { label: "Mosques managed", value: safeMosqueCount },
            ],
            message: priorities || "No priorities provided.",
          }),
          text: [
            `Name: ${full_name}`,
            `Email: ${work_email}`,
            `Mosque: ${mosque_name}`,
            `Role: ${role}`,
            `Mosques managed: ${safeMosqueCount}`,
            "",
            "Priorities:",
            priorities || "Not provided",
          ].join("\n"),
          metadata: {
            mosque_name,
            role,
            mosque_count: safeMosqueCount,
          },
        }),
        sendWithLog({
          mosqueId: null,
          toEmail: work_email,
          toName: full_name,
          emailType: "demo_request_autoresponder",
          entityType: "demo_request",
          entityId: null,
          dedupeKey: null,
          replyTo: CONTACT_NOTIFICATION_EMAIL,
          subject: "We have received your MosquePay demo request",
          html: renderSimpleMessageEmail({
            eyebrow: "Demo request received",
            title: "Thanks for booking time with MosquePay",
            preview: "We have received your walkthrough request.",
            greeting: `Hello ${full_name},`,
            paragraphs: [
              "Thank you for requesting a MosquePay walkthrough. We have your details and will reply with the next step shortly.",
              "The session will focus on your mosque or group, including the website, services, payments, newcomers, reporting, and the officer workflows that matter most.",
            ],
            note: `Request received for ${mosque_name}. Role: ${role}. Mosques managed: ${safeMosqueCount}.`,
          }),
          text: [
            `Hello ${full_name},`,
            "",
            "Thank you for requesting a MosquePay walkthrough. We have your details and will reply with the next step shortly.",
            "",
            `Request received for ${mosque_name}.`,
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
