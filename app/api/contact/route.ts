import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import * as db from "@/lib/db";
import * as mockDb from "@/lib/mock-db";
import { getLodgeSlugFromRequest } from "@/lib/tenant";
import { lodgePayFromEmail, renderSimpleMessageEmail } from "@/lib/email/templates";
import { sendWebsiteNotification } from "@/lib/email/website-notifications";

const CONTACT_NOTIFICATION_EMAIL = "ag@experrt.com";

export async function POST(request: NextRequest) {
  try {
    const lodgeSlug = getLodgeSlugFromRequest(request);
    const isTenantMode = request.nextUrl.searchParams.has("lodge");
    const body = await request.json();
    const name = body.name?.trim();
    const email = body.email?.trim();
    const subject = body.subject?.trim() || "Website enquiry";
    const message = body.message?.trim();
    const phone = body.phone?.trim() || null;

    if (!name || !email || !message) {
      return NextResponse.json(
        { error: "Name, email, and message are required." },
        { status: 400 }
      );
    }

    const resolvedLodge = isTenantMode
      ? isSupabaseConfigured()
        ? await db.getLodgeBySlug(lodgeSlug)
        : mockDb.getLodgeBySlug(lodgeSlug)
      : null;
    const notificationContext =
      resolvedLodge ?? {
        name: "LodgePay",
        support_email: CONTACT_NOTIFICATION_EMAIL,
        secretary_name: null,
      };
    const responderName = resolvedLodge?.name ?? "LodgePay";

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
        { label: "Phone", value: phone },
      ],
      message,
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
        subject: isTenantMode
          ? `We have received your enquiry for ${responderName}`
          : "We have received your LodgePay enquiry",
        html: renderSimpleMessageEmail({
          eyebrow: "Enquiry received",
          title: isTenantMode ? "Thanks for getting in touch" : "Thanks for contacting LodgePay",
          preview: isTenantMode
            ? "Your message has reached the lodge."
            : "Your message has reached the LodgePay team.",
          greeting: `Hello ${name},`,
          paragraphs: [
            isTenantMode
              ? `Thank you for getting in touch. Your message has reached ${responderName} and we will reply as soon as we can.`
              : "Thank you for getting in touch. Your message has reached the LodgePay team and we will reply as soon as we can.",
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
