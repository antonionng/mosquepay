// app/api/admin/test-email/send-all/route.ts
// Send multiple test emails to demonstrate all email templates

import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import {
  renderBrandedEmail,
  renderNotificationEmail,
  renderSimpleMessageEmail,
  renderStaffInviteEmail,
  renderMemberInviteEmail,
  renderGivingReminderEmail,
} from "@/lib/email/templates";

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
    // Allow empty body
  }

  const to = body.to || "ag@experrt.com";
  const resend = new Resend(apiKey);
  const from =
    process.env.RESEND_FROM_EMAIL ??
    process.env.EMAIL_FROM ??
    "MosquePay <noreply@mosque-pay.com>";

  const results: Array<{ type: string; success: boolean; messageId?: string; error?: string }> = [];

  // 1. Welcome/Simple Message Email
  try {
    const html = renderSimpleMessageEmail({
      eyebrow: "Welcome",
      title: "Welcome to MosquePay",
      preview: "Your mosque management platform is ready.",
      greeting: "Hello there,",
      paragraphs: [
        "Thank you for choosing MosquePay for your mosque management needs.",
        "With MosquePay, you can manage member records, process donations, track giving, and communicate with your congregation all in one place.",
        "We are committed to helping mosques operate more efficiently while maintaining the highest standards of data security and privacy.",
      ],
      cta: { label: "Get Started", href: "https://mosque-pay.com" },
      note: "If you have any questions, our support team is here to help. Simply reply to this email or visit our help center.",
    });

    const { data, error } = await resend.emails.send({
      from,
      to,
      subject: "Welcome to MosquePay - Test Email",
      html,
    });

    results.push({
      type: "welcome",
      success: !error,
      messageId: data?.id,
      error: error?.message,
    });
  } catch (err) {
    results.push({
      type: "welcome",
      success: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  // 2. Notification Email (e.g., new donation received)
  try {
    const html = renderNotificationEmail({
      eyebrow: "Donation Received",
      title: "New Donation Notification",
      preview: "A new donation has been received for your mosque.",
      intro: "A new donation has been processed through MosquePay.",
      rows: [
        { label: "Donor", value: "John Smith" },
        { label: "Amount", value: "£50.00" },
        { label: "Fund", value: "General Offering" },
        { label: "Date", value: new Date().toLocaleDateString("en-GB") },
        { label: "Reference", value: "DON-2026-001234" },
      ],
      message: "Thank you for your generous contribution to our mosque community.",
    });

    const { data, error } = await resend.emails.send({
      from,
      to,
      subject: "New Donation Received - Test Email",
      html,
    });

    results.push({
      type: "notification",
      success: !error,
      messageId: data?.id,
      error: error?.message,
    });
  } catch (err) {
    results.push({
      type: "notification",
      success: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  // 3. Staff Invite Email
  try {
    const html = renderStaffInviteEmail({
      name: "Sarah Johnson",
      roleLabel: "Treasurer",
      mosqueName: "St. Mary's Mosque",
      actionUrl: "https://mosque-pay.com/admin/accept-invite",
      actionLabel: "Accept Invitation",
    });

    const { data, error } = await resend.emails.send({
      from,
      to,
      subject: "Admin Invitation - Test Email",
      html,
    });

    results.push({
      type: "staff_invite",
      success: !error,
      messageId: data?.id,
      error: error?.message,
    });
  } catch (err) {
    results.push({
      type: "staff_invite",
      success: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  // 4. Member Invite Email
  try {
    const html = renderMemberInviteEmail({
      name: "Michael Brown",
      mosqueName: "St. Mary's Mosque",
      actionUrl: "https://mosque-pay.com/member/accept-invite",
      actionLabel: "Access Member Portal",
    });

    const { data, error } = await resend.emails.send({
      from,
      to,
      subject: "Member Portal Invitation - Test Email",
      html,
    });

    results.push({
      type: "member_invite",
      success: !error,
      messageId: data?.id,
      error: error?.message,
    });
  } catch (err) {
    results.push({
      type: "member_invite",
      success: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  // 5. Giving Reminder Email
  try {
    const html = renderGivingReminderEmail({
      memberName: "David Wilson",
      mosqueName: "St. Mary's Mosque",
      amountDue: "£120.00",
      dueDate: "30th June 2026",
      portalUrl: "https://mosque-pay.com/member/giving",
      reminderNumber: 1,
    });

    const { data, error } = await resend.emails.send({
      from,
      to,
      subject: "Giving Reminder - Test Email",
      html,
    });

    results.push({
      type: "giving_reminder",
      success: !error,
      messageId: data?.id,
      error: error?.message,
    });
  } catch (err) {
    results.push({
      type: "giving_reminder",
      success: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  const successCount = results.filter((r) => r.success).length;
  const failCount = results.filter((r) => !r.success).length;

  return NextResponse.json({
    success: failCount === 0,
    summary: `${successCount}/${results.length} emails sent successfully`,
    to,
    from,
    results,
  });
}
