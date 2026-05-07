import * as db from "@/lib/db";
import type { WelfareAlert } from "@/lib/db/types";

const MISSED_MEETING_THRESHOLD = 3; // consecutive missed meetings
const OVERDUE_DAYS_THRESHOLD = 60; // days since dues went overdue

export type GeneratedAlert = Pick<
  WelfareAlert,
  "member_id" | "alert_type" | "severity" | "message" | "metadata" | "status"
>;

export async function generateWelfareAlerts(lodgeId: string): Promise<{
  candidates: GeneratedAlert[];
  upserted: WelfareAlert[];
}> {
  const [members, events, rsvps, dues] = await Promise.all([
    db.getMembers(lodgeId, { status: "active" }),
    db.getEvents(lodgeId, { published: true }),
    listAllRsvps(lodgeId),
    db.getMemberDues(lodgeId, { status: "outstanding" }),
  ]);

  const today = new Date();
  const lastSixMonths = new Date();
  lastSixMonths.setMonth(lastSixMonths.getMonth() - 6);

  const recentPastEvents = events
    .filter((e) => {
      const eventDate = new Date(e.event_date);
      return eventDate >= lastSixMonths && eventDate <= today;
    })
    .sort(
      (a, b) =>
        new Date(b.event_date).getTime() - new Date(a.event_date).getTime()
    );

  const rsvpsByEmail = new Map<string, Map<string, string>>();
  for (const r of rsvps) {
    const email = (r.user_email ?? "").toLowerCase();
    if (!rsvpsByEmail.has(email)) rsvpsByEmail.set(email, new Map());
    rsvpsByEmail.get(email)!.set(r.event_id, r.status);
  }

  const candidates: GeneratedAlert[] = [];

  for (const member of members) {
    const email = member.email.toLowerCase();
    const memberRsvps = rsvpsByEmail.get(email) ?? new Map();
    const lastEvents = recentPastEvents.slice(0, 6);
    const attended = lastEvents.filter((e) => {
      const status = memberRsvps.get(e.id);
      return status === "confirmed";
    });
    const missed = lastEvents.length - attended.length;
    if (lastEvents.length >= MISSED_MEETING_THRESHOLD && missed >= MISSED_MEETING_THRESHOLD) {
      candidates.push({
        member_id: member.id,
        alert_type: "missed_meetings",
        severity: missed >= 5 ? "high" : "standard",
        message: `${member.full_name} has missed ${missed} of the last ${lastEvents.length} meetings.`,
        metadata: {
          missed,
          window: lastEvents.length,
        },
        status: "open",
      });
    }
  }

  const memberByEmail = new Map(
    members.map((m) => [m.email.toLowerCase(), m])
  );
  for (const due of dues) {
    const member = memberByEmail.get(due.member_email.toLowerCase());
    if (!member) continue;
    const dueDate = new Date(due.period_end);
    const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
    if (daysOverdue >= OVERDUE_DAYS_THRESHOLD) {
      candidates.push({
        member_id: member.id,
        alert_type: "overdue_dues",
        severity: daysOverdue >= 180 ? "high" : "standard",
        message: `${member.full_name} dues are ${daysOverdue} days overdue (£${Number(due.amount).toFixed(2)}).`,
        metadata: {
          days_overdue: daysOverdue,
          dues_id: due.id,
          amount: due.amount,
        },
        status: "open",
      });
    }
  }

  const upserted: WelfareAlert[] = [];
  for (const candidate of candidates) {
    const alert = await db.upsertWelfareAlert(lodgeId, {
      ...candidate,
      case_id: null,
      acknowledged_by_admin_user_id: null,
      acknowledged_at: null,
    });
    upserted.push(alert);
  }

  return { candidates, upserted };
}

async function listAllRsvps(lodgeId: string) {
  // Reuse a per-event query; we want all RSVPs for the lodge.
  const events = await db.getEvents(lodgeId);
  const all = await Promise.all(
    events.map((e) => db.getRsvpsByEventId(e.id, lodgeId))
  );
  return all.flat();
}
