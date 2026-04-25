import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const name = body.name?.trim();
    const email = body.email?.trim();
    const subject = body.subject?.trim();
    const message = body.message?.trim();

    if (!name || !email || !subject || !message) {
      return NextResponse.json(
        { error: "Name, email, subject, and message are required." },
        { status: 400 }
      );
    }

    // Optional: send email via Resend to secretary
    const resendKey = process.env.RESEND_API_KEY;
    if (resendKey) {
      const { Resend } = await import("resend");
      const resend = new Resend(resendKey);
      const to = process.env.CONTACT_EMAIL ?? "secretary@covenantlodge.org.uk";
      await resend.emails.send({
        from: process.env.EMAIL_FROM ?? "Covenant Lodge <noreply@covenantlodge.org.uk>",
        to,
        replyTo: email,
        subject: `[Website] ${subject}`,
        text: `From: ${name} <${email}>\n\n${message}`,
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
