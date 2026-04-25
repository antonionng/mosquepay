import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import * as db from "@/lib/db";

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ message: "No database configured, skipping." });
  }

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    return NextResponse.json({ message: "Resend not configured, skipping." });
  }

  try {
    const today = new Date().toISOString().split("T")[0];
    const membersToNotify = await db.getMembersForInitiation(today);

    if (membersToNotify.length === 0) {
      return NextResponse.json({ message: "No initiations today.", sent: 0 });
    }

    const { Resend } = await import("resend");
    const resend = new Resend(resendKey);
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
    const fromEmail = process.env.EMAIL_FROM ?? "noreply@lodgepay.com";
    let sent = 0;

    for (const member of membersToNotify) {
      const lodgeSlug = member.lodge_slug;
      const lodgeId = member.lodge_id;

      const dues = await db.getMemberDues(lodgeId, {
        memberEmail: member.email,
        status: "outstanding",
      });

      let paymentUrl = `${siteUrl}/member/dues`;
      if (lodgeSlug) {
        paymentUrl += `?lodge=${encodeURIComponent(lodgeSlug)}`;
      }

      const duesAmount = dues.length > 0 ? `£${dues[0].amount.toFixed(2)}` : "your membership fees";

      try {
        await resend.emails.send({
          from: fromEmail,
          to: member.email,
          subject: "Welcome — Your Membership Fees Payment",
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
              <h1 style="color: #1e293b; font-size: 24px;">Welcome, ${member.full_name}</h1>
              <p style="color: #475569; font-size: 16px; line-height: 1.6;">
                Congratulations on your initiation. We are delighted to welcome you as a member.
              </p>
              <p style="color: #475569; font-size: 16px; line-height: 1.6;">
                Your annual membership fees of <strong>${duesAmount}</strong> are now due. You can pay in full or set up instalments.
              </p>
              <div style="margin: 32px 0;">
                <a href="${paymentUrl}" style="background-color: #111827; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
                  Pay Membership Fees
                </a>
              </div>
              <p style="color: #94a3b8; font-size: 14px;">
                If you have any questions, please contact your lodge secretary.
              </p>
            </div>
          `,
        });

        await db.updateMember(member.id, lodgeId, {
          initiation_email_sent: true,
        });
        sent++;
      } catch (emailErr) {
        console.error(`Failed to send initiation email to ${member.email}:`, emailErr);
      }
    }

    return NextResponse.json({ message: `Sent ${sent} initiation emails.`, sent });
  } catch (e) {
    console.error("Initiation email cron error:", e);
    return NextResponse.json({ error: "Cron job failed." }, { status: 500 });
  }
}
