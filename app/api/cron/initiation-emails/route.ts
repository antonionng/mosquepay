import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import * as db from "@/lib/db";
import {
  lodgePayFromEmail,
  renderInitiationDuesEmail,
} from "@/lib/email/templates";

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json(
      { error: "CRON_SECRET is required for this job." },
      { status: 503 }
    );
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
    const fromEmail = lodgePayFromEmail(process.env.EMAIL_FROM);
    let sent = 0;

    for (const member of membersToNotify) {
      const lodgeSlug = member.lodge_slug;
      const lodgeId = member.lodge_id;

      const dues = await db.getMemberDues(lodgeId, {
        memberEmail: member.email,
        status: "outstanding",
      });

      const duesAmount = dues.length > 0 ? `£${dues[0].amount.toFixed(2)}` : "your membership fees";
      const paymentUrl =
        dues.length > 0
          ? `${siteUrl}/dues/${dues[0].id}?email=${encodeURIComponent(member.email)}&lodge=${encodeURIComponent(lodgeSlug)}`
          : `${siteUrl}/member/dues?lodge=${encodeURIComponent(lodgeSlug)}`;

      try {
        await resend.emails.send({
          from: fromEmail,
          to: member.email,
          subject: "Welcome: Your Membership Fees Payment",
          html: renderInitiationDuesEmail({
            memberName: member.full_name,
            duesAmount,
            paymentUrl,
          }),
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
