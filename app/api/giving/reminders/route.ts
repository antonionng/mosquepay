import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import * as db from "@/lib/db";
import { getChurchSlugFromRequest } from "@/lib/tenant";
import {
  requireAdminApiAuth,
  requireAdminApiPermission,
} from "@/lib/auth/api";
import { writeAuditLog } from "@/lib/audit";
import { renderGivingReminderEmail } from "@/lib/email/templates";
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

    const churchSlug = getChurchSlugFromRequest(request);
    const churchId = await db.resolveChurchId(churchSlug);
    if (!churchId) {
      return NextResponse.json({ error: "Church not found." }, { status: 404 });
    }
    const forbidden = await requireAdminApiPermission(
      "payments:write",
      churchId
    );
    if (forbidden) return forbidden;

    const body = await request.json().catch(() => ({}));
    const onlyGivingIds: string[] | undefined = Array.isArray(body.giving_ids)
      ? body.giving_ids
      : undefined;

    const giving = (
      await db.getMemberGiving(churchId, { status: "outstanding" })
    ).filter((d) => !onlyGivingIds || onlyGivingIds.includes(d.id));

    if (giving.length === 0) {
      return NextResponse.json({ sent: 0, failures: [] });
    }

    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json(
        { error: "RESEND_API_KEY is not configured." },
        { status: 503 }
      );
    }

    const church = await db.getChurchById(churchId);
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://churchpay.co.uk";
    const portalUrl = `${siteUrl}/member/giving`;

    const failures: Array<{ email: string; message: string }> = [];
    let sent = 0;

    for (const record of giving) {
      const reminderNumber = (record.reminder_count ?? 0) + 1;
      const html = renderGivingReminderEmail({
        memberName: record.member_name ?? record.member_email,
        churchName: church?.name ?? "Your Church",
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
          ? "Final reminder: church giving outstanding"
          : reminderNumber === 2
            ? "Second reminder: church giving due"
            : "Reminder: church giving due";

      const result = await sendWithLog({
        churchId,
        toEmail: record.member_email,
        toName: record.member_name,
        memberId: record.member_id ?? null,
        emailType: "giving_reminder_member",
        entityType: "member_giving",
        entityId: record.id,
        // Reminders may legitimately re-fire (admin clicks "send
        // reminders" again) — no dedupe key.
        dedupeKey: null,
        subject,
        html,
        metadata: {
          reminder_number: reminderNumber,
          giving_amount: record.amount,
        },
      });

      if (result.ok) {
        await db.updateMemberGivingStatus(record.id, churchId, {
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
      churchId,
      action: "giving_reminders_sent",
      entityType: "giving",
      entityId: churchId,
      summary: `Sent ${sent} giving reminder${sent === 1 ? "" : "s"}`,
      metadata: { sent, failures: failures.length },
    });

    return NextResponse.json({ sent, failures });
  } catch (e) {
    console.error("Giving reminder error:", e);
    return NextResponse.json(
      { error: "Failed to send reminders." },
      { status: 500 }
    );
  }
}
