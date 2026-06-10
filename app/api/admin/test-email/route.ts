// app/api/admin/test-email/route.ts
// Test endpoint to verify Resend email configuration

import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { renderBrandedEmail } from "@/lib/email/templates";

export async function POST(req: NextRequest) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "RESEND_API_KEY not configured" },
      { status: 500 }
    );
  }

  let body: { to?: string } = {};
  try {
    body = await req.json();
  } catch {
    // Allow empty body, will use default recipient
  }

  const to = body.to || "ag@experrt.com";

  const resend = new Resend(apiKey);
  const from =
    process.env.RESEND_FROM_EMAIL ??
    process.env.EMAIL_FROM ??
    "ChurchPay <noreply@churchpayment.com>";

  const html = renderBrandedEmail({
    eyebrow: "Test Email",
    title: "ChurchPay Email Configuration Test",
    preview: "This is a test email from ChurchPay to verify email delivery.",
    children: `
      <h1 style="margin:0;color:#111827;font-size:28px;line-height:1.15;">Email Configuration Verified</h1>
      <p style="margin:18px 0 0;color:#64748b;font-size:16px;line-height:1.7;">
        Congratulations! Your ChurchPay email configuration is working correctly.
      </p>
      <p style="margin:12px 0 0;color:#64748b;font-size:16px;line-height:1.7;">
        This test email confirms that:
      </p>
      <ul style="margin:12px 0 0;padding-left:22px;color:#111827;font-size:15px;line-height:1.7;">
        <li>Resend API is properly configured</li>
        <li>The churchpayment.com domain is verified</li>
        <li>Email branding and templates are rendering correctly</li>
        <li>The ChurchPay logo is displaying properly</li>
      </ul>
      <p style="margin:18px 0 0;color:#64748b;font-size:16px;line-height:1.7;">
        Sent from: <strong style="color:#111827;">${from}</strong>
      </p>
      <div style="margin-top:22px;border-radius:18px;border:1px solid #E6EAF2;background:#F8FAFC;padding:16px 18px;">
        <p style="margin:0;color:#111827;font-size:14px;font-weight:800;">Configuration Details</p>
        <p style="margin:6px 0 0;color:#64748b;font-size:14px;line-height:1.6;">
          Domain: churchpayment.com<br/>
          Provider: Resend<br/>
          Timestamp: ${new Date().toISOString()}
        </p>
      </div>
    `,
  });

  try {
    const { data, error } = await resend.emails.send({
      from,
      to,
      subject: "ChurchPay Test Email - Configuration Verified",
      html,
    });

    if (error) {
      console.error("Test email failed:", error);
      return NextResponse.json(
        { error: error.message, details: error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      messageId: data?.id,
      to,
      from,
      message: `Test email sent successfully to ${to}`,
    });
  } catch (err) {
    console.error("Test email exception:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: "/api/admin/test-email",
    method: "POST",
    body: { to: "recipient@example.com (optional, defaults to ag@experrt.com)" },
    description: "Send a test email to verify Resend configuration",
  });
}
