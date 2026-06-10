import * as db from "@/lib/db";
import type { PastoralCareAlert } from "@/lib/db/types";

const MISSED_MEETING_THRESHOLD = 3; // consecutive missed services
const OVERDUE_DAYS_THRESHOLD = 60; // days since giving went overdue

export type GeneratedAlert = Pick<
  PastoralCareAlert,
  "member_id" | "alert_type" | "severity" | "message" | "metadata" | "status"
>;

export async function generatePastoralCareAlerts(churchId: string): Promise<{
  newcomers: GeneratedAlert[];
  upserted: PastoralCareAlert[];
}> {
  const [members, events, rsvps, giving] = await Promise.all([
    db.getMembers(churchId, { status: "active" }),
    db.getEvents(churchId, { published: true }),
    listAllRsvps(churchId),
    db.getMemberGiving(churchId, { status: "outstanding" }),
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

  const newcomers: GeneratedAlert[] = [];

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
      newcomers.push({
        member_id: member.id,
        alert_type: "missed_services",
        severity: missed >= 5 ? "high" : "standard",
        message: `${member.full_name} has missed ${missed} of the last ${lastEvents.length} services.`,
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
  for (const due of giving) {
    const member = memberByEmail.get(due.member_email.toLowerCase());
    if (!member) continue;
    const dueDate = new Date(due.period_end);
    const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
    if (daysOverdue >= OVERDUE_DAYS_THRESHOLD) {
      newcomers.push({
        member_id: member.id,
        alert_type: "overdue_giving",
        severity: daysOverdue >= 180 ? "high" : "standard",
        message: `${member.full_name} giving are ${daysOverdue} days overdue (£${Number(due.amount).toFixed(2)}).`,
        metadata: {
          days_overdue: daysOverdue,
          giving_id: due.id,
          amount: due.amount,
        },
        status: "open",
      });
    }
  }

  const upserted: PastoralCareAlert[] = [];
  for (const newcomer of newcomers) {
    const alert = await db.upsertPastoralCareAlert(churchId, {
      ...newcomer,
      case_id: null,
      acknowledged_by_admin_user_id: null,
      acknowledged_at: null,
    });
    upserted.push(alert);
  }

  return { newcomers, upserted };
}

async function listAllRsvps(churchId: string) {
  // Reuse a per-event query; we want all RSVPs for the church.
  const events = await db.getEvents(churchId);
  const all = await Promise.all(
    events.map((e) => db.getRsvpsByEventId(e.id, churchId))
  );
  return all.flat();
}
