import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import * as db from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import {
  defaultAgendaItems,
  renderDefaultSummonsOpening,
} from "@/lib/summons/defaults";

/**
 * Cron job: auto-create draft summons for any sequence-linked event that
 * sits inside the configured lead window and has no summons yet.
 *
 * SAFETY INVARIANT: this route NEVER sends emails. It only writes a
 * draft summons row and flips the event's summons_status from "none" to
 * "draft". Sending requires an explicit admin approval through the
 * /api/summons/[eventId]/approve route.
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
    const sequences = await db.listActiveMeetingSequencesForAllLodges();
    if (sequences.length === 0) {
      return NextResponse.json({ message: "No active sequences.", drafted: 0 });
    }

    const now = Date.now();
    const drafted: Array<{ event_id: string; lodge_id: string; title: string }> = [];

    for (const sequence of sequences) {
      const windowMs = sequence.summons_lead_weeks * 7 * 86400000;
      const windowEndIso = new Date(now + windowMs).toISOString();
      const candidates = await db.getEventsAwaitingSummonsDraft(
        sequence.lodge_id,
        windowEndIso
      );
      const events = candidates.filter(
        (event) => event.sequence_id === sequence.id
      );
      if (events.length === 0) continue;

      const lodge = await db.getLodgeById(sequence.lodge_id);

      for (const event of events) {
        const existing = await db.getEventSummons(event.id, sequence.lodge_id);
        if (existing) {
          await db.setEventSummonsStatus(event.id, sequence.lodge_id, "draft", {
            summons_auto_drafted_at: new Date().toISOString(),
          });
          continue;
        }

        await db.upsertEventSummons(sequence.lodge_id, event.id, {
          issue_date: new Date().toISOString().slice(0, 10),
          opening_text: renderDefaultSummonsOpening(event, lodge),
          agenda_items: defaultAgendaItems(),
          menu_items: [],
          dining_time: event.event_time,
          notices: [
            lodge?.meeting_schedule,
            lodge?.data_protection_notice,
            lodge?.visiting_notice,
          ].filter((notice): notice is string => Boolean(notice)),
          include_member_directory: true,
        });

        await db.setEventSummonsStatus(event.id, sequence.lodge_id, "draft", {
          summons_auto_drafted_at: new Date().toISOString(),
        });

        drafted.push({
          event_id: event.id,
          lodge_id: sequence.lodge_id,
          title: event.title,
        });
      }
    }

    for (const entry of drafted) {
      await writeAuditLog({
        lodgeId: entry.lodge_id,
        action: "auto_drafted",
        entityType: "summons",
        entityId: entry.event_id,
        summary: `Auto-drafted summons for ${entry.title}`,
        metadata: { source: "cron:summons-drafts" },
      });
    }

    return NextResponse.json({
      message: `Auto-drafted ${drafted.length} summons.`,
      drafted: drafted.length,
      events: drafted,
    });
  } catch (error) {
    console.error("Summons drafts cron error:", error);
    return NextResponse.json(
      { error: "Cron job failed." },
      { status: 500 }
    );
  }
}
