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
    const lodge_name = body.lodge_name?.trim();
    const role = body.role?.trim();
    const lodge_count = Number(body.lodge_count ?? 1);
    const priorities = body.priorities?.trim();

    if (!full_name || !work_email || !lodge_name || !role) {
      return NextResponse.json(
        { error: "Name, work email, lodge name, and role are required." },
        { status: 400 }
      );
    }

    if (process.env.RESEND_API_KEY) {
      const safeLodgeCount = String(Number.isFinite(lodge_count) ? lodge_count : 1);

      await Promise.all([
        sendWithLog({
          lodgeId: null,
          toEmail: CONTACT_NOTIFICATION_EMAIL,
          emailType: "demo_request_team",
          entityType: "demo_request",
          entityId: null,
          dedupeKey: null,
          replyTo: work_email,
          subject: `[LodgePay demo request] ${lodge_name}`,
          html: renderNotificationEmail({
            eyebrow: "Demo request",
            title: "New demo request",
            preview: `New demo request from ${full_name}.`,
            intro: "A new LodgePay demo request has been submitted.",
            rows: [
              { label: "Name", value: full_name },
              { label: "Email", value: work_email },
              { label: "Lodge", value: lodge_name },
              { label: "Role", value: role },
              { label: "Lodges managed", value: safeLodgeCount },
            ],
            message: priorities || "No priorities provided.",
          }),
          text: [
            `Name: ${full_name}`,
            `Email: ${work_email}`,
            `Lodge: ${lodge_name}`,
            `Role: ${role}`,
            `Lodges managed: ${safeLodgeCount}`,
            "",
            "Priorities:",
            priorities || "Not provided",
          ].join("\n"),
          metadata: {
            lodge_name,
            role,
            lodge_count: safeLodgeCount,
          },
        }),
        sendWithLog({
          lodgeId: null,
          toEmail: work_email,
          toName: full_name,
          emailType: "demo_request_autoresponder",
          entityType: "demo_request",
          entityId: null,
          dedupeKey: null,
          replyTo: CONTACT_NOTIFICATION_EMAIL,
          subject: "We have received your LodgePay demo request",
          html: renderSimpleMessageEmail({
            eyebrow: "Demo request received",
            title: "Thanks for booking time with LodgePay",
            preview: "We have received your walkthrough request.",
            greeting: `Hello ${full_name},`,
            paragraphs: [
              "Thank you for requesting a LodgePay walkthrough. We have your details and will reply with the next step shortly.",
              "The session will focus on your lodge or group, including the website, meetings, payments, candidates, reporting, and the officer workflows that matter most.",
            ],
            note: `Request received for ${lodge_name}. Role: ${role}. Lodges managed: ${safeLodgeCount}.`,
          }),
          text: [
            `Hello ${full_name},`,
            "",
            "Thank you for requesting a LodgePay walkthrough. We have your details and will reply with the next step shortly.",
            "",
            `Request received for ${lodge_name}.`,
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
