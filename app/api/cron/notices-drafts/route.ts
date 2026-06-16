import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import * as db from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import {
  defaultAgendaItems,
  renderDefaultNoticeOpening,
} from "@/lib/notices/defaults";

/**
 * Cron job: auto-create draft notice for any sequence-linked event that
 * sits inside the configured newcomer window and has no notice yet.
 *
 * SAFETY INVARIANT: this route NEVER sends emails. It only writes a
 * draft notice row and flips the event's notice_status from "none" to
 * "draft". Sending requires an explicit admin approval through the
 * /api/notice/[eventId]/approve route.
 */
export async function GET(request: NextRequest) {
  const cronHeader = request.headers.get("x-vercel-cron");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronHeader) {
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
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({
      message: "No database configured, skipping.",
      drafted: 0,
    });
  }

  try {
    const sequences = await db.listActiveServiceSequencesForAllMosques();
    if (sequences.length === 0) {
      return NextResponse.json({ message: "No active sequences.", drafted: 0 });
    }

    const now = Date.now();
    const drafted: Array<{ event_id: string; mosque_id: string; title: string }> = [];

    for (const sequence of sequences) {
      const windowMs = sequence.notice_newcomer_weeks * 7 * 86400000;
      const windowEndIso = new Date(now + windowMs).toISOString();
      const newcomers = await db.getEventsAwaitingNoticeDraft(
        sequence.mosque_id,
        windowEndIso
      );
      const events = newcomers.filter(
        (event) => event.sequence_id === sequence.id
      );
      if (events.length === 0) continue;

      const mosque = await db.getMosqueById(sequence.mosque_id);

      for (const event of events) {
        const existing = await db.getServiceNotice(event.id, sequence.mosque_id);
        if (existing) {
          await db.setServiceNoticeStatus(event.id, sequence.mosque_id, "draft", {
            notice_auto_drafted_at: new Date().toISOString(),
          });
          continue;
        }

        await db.upsertServiceNotice(sequence.mosque_id, event.id, {
          issue_date: new Date().toISOString().slice(0, 10),
          opening_text: renderDefaultNoticeOpening(event, mosque),
          agenda_items: defaultAgendaItems(),
          menu_items: [],
          dining_time: event.event_time,
          notices: [
            mosque?.service_schedule,
            mosque?.data_protection_notice,
            mosque?.newcomer_notice,
          ].filter((notice): notice is string => Boolean(notice)),
          include_member_directory: true,
        });

        await db.setServiceNoticeStatus(event.id, sequence.mosque_id, "draft", {
          notice_auto_drafted_at: new Date().toISOString(),
        });

        drafted.push({
          event_id: event.id,
          mosque_id: sequence.mosque_id,
          title: event.title,
        });
      }
    }

    for (const entry of drafted) {
      await writeAuditLog({
        mosqueId: entry.mosque_id,
        action: "auto_drafted",
        entityType: "notice",
        entityId: entry.event_id,
        summary: `Auto-drafted notice for ${entry.title}`,
        metadata: { source: "cron:notice-drafts" },
      });
    }

    return NextResponse.json({
      message: `Auto-drafted ${drafted.length} notice.`,
      drafted: drafted.length,
      events: drafted,
    });
  } catch (error) {
    console.error("Notice drafts cron error:", error);
    return NextResponse.json(
      { error: "Cron job failed." },
      { status: 500 }
    );
  }
}
