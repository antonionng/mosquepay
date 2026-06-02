import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import * as db from "@/lib/db";
import { getLodgeSlugFromRequest } from "@/lib/tenant";
import {
  requireAdminApiAuth,
  requireAdminApiPermission,
} from "@/lib/auth/api";
import { writeAuditLog } from "@/lib/audit";
import { renderDuesReminderEmail } from "@/lib/email/templates";
import { sendWithLog } from "@/lib/email/send-with-log";

export async function POST(request: NextRequest) {
  try {
    const unauthorized = await requireAdminApiAuth();
    if (unauthorized) return unauthorized;
    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        { error: "Database not configured." },
        { status: 503 }
      );
    }

    const lodgeSlug = getLodgeSlugFromRequest(request);
    const lodgeId = await db.resolveLodgeId(lodgeSlug);
    if (!lodgeId) {
      return NextResponse.json({ error: "Lodge not found." }, { status: 404 });
    }
    const forbidden = await requireAdminApiPermission(
      "payments:write",
      lodgeId
    );
    if (forbidden) return forbidden;

    const body = await request.json().catch(() => ({}));
    const onlyDuesIds: string[] | undefined = Array.isArray(body.dues_ids)
      ? body.dues_ids
      : undefined;

    const dues = (
      await db.getMemberDues(lodgeId, { status: "outstanding" })
    ).filter((d) => !onlyDuesIds || onlyDuesIds.includes(d.id));

    if (dues.length === 0) {
      return NextResponse.json({ sent: 0, failures: [] });
    }

    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json(
        { error: "RESEND_API_KEY is not configured." },
        { status: 503 }
      );
    }

    const lodge = await db.getLodgeById(lodgeId);
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://lodgepayments.co.uk";
    const portalUrl = `${siteUrl}/member/dues`;

    const failures: Array<{ email: string; message: string }> = [];
    let sent = 0;

    for (const record of dues) {
      const reminderNumber = (record.reminder_count ?? 0) + 1;
      const html = renderDuesReminderEmail({
        memberName: record.member_name ?? record.member_email,
        lodgeName: lodge?.name ?? "Your Lodge",
        amountDue: `£${Number(record.amount).toFixed(2)}`,
        dueDate: new Date(record.period_end).toLocaleDateString("en-GB", {
          day: "numeric",
          month: "long",
          year: "numeric",
        }),
        portalUrl,
        reminderNumber,
      });

      const subject =
        reminderNumber >= 3
          ? "Final reminder: lodge dues outstanding"
          : reminderNumber === 2
            ? "Second reminder: lodge dues due"
            : "Reminder: lodge dues due";

      const result = await sendWithLog({
        lodgeId,
        toEmail: record.member_email,
        toName: record.member_name,
        memberId: record.member_id ?? null,
        emailType: "dues_reminder_member",
        entityType: "member_dues",
        entityId: record.id,
        // Reminders may legitimately re-fire (admin clicks "send
        // reminders" again) — no dedupe key.
        dedupeKey: null,
        subject,
        html,
        metadata: {
          reminder_number: reminderNumber,
          dues_amount: record.amount,
        },
      });

      if (result.ok) {
        await db.updateMemberDuesStatus(record.id, lodgeId, {
          reminder_sent_at: new Date().toISOString(),
          reminder_count: reminderNumber,
        });
        sent += 1;
      } else {
        failures.push({
          email: record.member_email,
          message: result.error,
        });
      }
    }

    await writeAuditLog({
      lodgeId,
      action: "dues_reminders_sent",
      entityType: "dues",
      entityId: lodgeId,
      summary: `Sent ${sent} dues reminder${sent === 1 ? "" : "s"}`,
      metadata: { sent, failures: failures.length },
    });

    return NextResponse.json({ sent, failures });
  } catch (e) {
    console.error("Dues reminder error:", e);
    return NextResponse.json(
      { error: "Failed to send reminders." },
      { status: 500 }
    );
  }
}
