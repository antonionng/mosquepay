import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import * as db from "@/lib/db";
import { renderInitiationDuesEmail } from "@/lib/email/templates";
import { sendWithLog } from "@/lib/email/send-with-log";

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

  try {
    const today = new Date().toISOString().split("T")[0];
    const membersToNotify = await db.getMembersForInitiation(today);

    if (membersToNotify.length === 0) {
      return NextResponse.json({ message: "No initiations today.", sent: 0 });
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
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

      const result = await sendWithLog({
        lodgeId,
        toEmail: member.email,
        toName: member.full_name,
        memberId: member.id,
        emailType: "initiation_dues_member",
        entityType: "member",
        entityId: member.id,
        // Idempotent on member.id so a retry doesn't send a second
        // welcome — initiation_email_sent flips to true on success.
        dedupeKey: `initiation_${member.id}`,
        subject: "Welcome: Your Membership Fees Payment",
        html: renderInitiationDuesEmail({
          memberName: member.full_name,
          duesAmount,
          paymentUrl,
        }),
        metadata: { lodge_slug: lodgeSlug, dues_id: dues[0]?.id ?? null },
      });

      if (result.ok) {
        await db.updateMember(member.id, lodgeId, {
          initiation_email_sent: true,
        });
        sent++;
      } else {
        console.error(
          `Failed to send initiation email to ${member.email}: ${result.error}`,
        );
      }
    }

    return NextResponse.json({ message: `Sent ${sent} initiation emails.`, sent });
  } catch (e) {
    console.error("Initiation email cron error:", e);
    return NextResponse.json({ error: "Cron job failed." }, { status: 500 });
  }
}
