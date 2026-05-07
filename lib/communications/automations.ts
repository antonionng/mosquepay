import * as db from "@/lib/db";
import { sendBatch, buildMemberContext } from "./send";

export const AUTOMATION_KEYS = [
  "birthday",
  "initiation_anniversary",
  "post_meeting_thank_you",
  "dues_reminder",
] as const;

export type AutomationKey = (typeof AUTOMATION_KEYS)[number];

export const AUTOMATION_LABELS: Record<AutomationKey, string> = {
  birthday: "Birthday greeting",
  initiation_anniversary: "Initiation anniversary",
  post_meeting_thank_you: "Post-meeting thank you",
  dues_reminder: "Dues reminder",
};

export const AUTOMATION_TEMPLATE_KEYS: Record<AutomationKey, string> = {
  birthday: "system.birthday.greeting",
  initiation_anniversary: "system.initiation.anniversary",
  post_meeting_thank_you: "system.post-meeting.thank-you",
  dues_reminder: "system.dues.reminder",
};

export type AutomationRunResult = {
  key: AutomationKey;
  enabled: boolean;
  attempted: number;
  sent: number;
  failed: number;
  skipped: number;
};

function isSameMonthDay(a: Date, iso: string | null): boolean {
  if (!iso) return false;
  const b = new Date(iso);
  return a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export async function runAllAutomations(lodgeId: string): Promise<AutomationRunResult[]> {
  const settings = await db.listAutomationSettings(lodgeId);
  const enabledKeys = new Set(
    settings.filter((s) => s.enabled).map((s) => s.automation_key)
  );

  const results: AutomationRunResult[] = [];
  for (const key of AUTOMATION_KEYS) {
    const enabled = enabledKeys.has(key);
    const empty = { key, enabled, attempted: 0, sent: 0, failed: 0, skipped: 0 };
    if (!enabled) {
      results.push(empty);
      continue;
    }
    try {
      const result = await runAutomation(lodgeId, key);
      results.push(result);
    } catch (error) {
      console.warn(`Automation ${key} failed`, error);
      results.push({ ...empty, failed: 1 });
    }
  }
  return results;
}

export async function runAutomation(
  lodgeId: string,
  key: AutomationKey
): Promise<AutomationRunResult> {
  const lodge = await db.getLodgeById(lodgeId);
  const template = await db.getMessageTemplateByKey(
    lodgeId,
    AUTOMATION_TEMPLATE_KEYS[key]
  );
  if (!template) {
    return { key, enabled: true, attempted: 0, sent: 0, failed: 0, skipped: 0 };
  }
  const today = new Date();

  if (key === "birthday") {
    const members = await db.getMembers(lodgeId, { status: "active" });
    const recipients = members
      .filter((m) => isSameMonthDay(today, m.date_of_birth))
      .map((member) => ({
        email: member.email,
        name: member.full_name,
        member_id: member.id,
        context: buildMemberContext(member, lodge),
      }));
    if (recipients.length === 0) {
      return { key, enabled: true, attempted: 0, sent: 0, failed: 0, skipped: 0 };
    }
    const out = await sendBatch({
      lodgeId,
      templateKey: template.template_key,
      subject: template.subject,
      htmlBody: template.html_body,
      recipients,
      audienceLabel: "automation:birthday",
    });
    await db.upsertAutomationSetting(lodgeId, key, true, {
      last_run_at: new Date().toISOString(),
    });
    return { key, enabled: true, attempted: recipients.length, ...out };
  }

  if (key === "initiation_anniversary") {
    const members = await db.getMembers(lodgeId, { status: "active" });
    const recipients = members
      .filter((m) => isSameMonthDay(today, m.date_of_initiation))
      .map((member) => {
        const initiationYear = member.date_of_initiation
          ? new Date(member.date_of_initiation).getFullYear()
          : today.getFullYear();
        const years = today.getFullYear() - initiationYear;
        return {
          email: member.email,
          name: member.full_name,
          member_id: member.id,
          context: buildMemberContext(member, lodge, { years: String(years) }),
        };
      })
      .filter((r) => Number(r.context.years) > 0);
    if (recipients.length === 0) {
      return { key, enabled: true, attempted: 0, sent: 0, failed: 0, skipped: 0 };
    }
    const out = await sendBatch({
      lodgeId,
      templateKey: template.template_key,
      subject: template.subject,
      htmlBody: template.html_body,
      recipients,
      audienceLabel: "automation:initiation_anniversary",
    });
    return { key, enabled: true, attempted: recipients.length, ...out };
  }

  if (key === "post_meeting_thank_you") {
    const events = await db.getEvents(lodgeId, { published: true });
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayKey = yesterday.toISOString().slice(0, 10);
    const recentEvents = events.filter(
      (e) => e.event_date.slice(0, 10) === yesterdayKey
    );
    if (recentEvents.length === 0) {
      return { key, enabled: true, attempted: 0, sent: 0, failed: 0, skipped: 0 };
    }
    let total = 0;
    let sent = 0;
    let failed = 0;
    let skipped = 0;
    for (const event of recentEvents) {
      const rsvps = await db.getRsvpsByEventId(event.id, lodgeId);
      const attendees = rsvps.filter((r) => r.attending_ceremony && r.user_email);
      const recipients = attendees.map((rsvp) => ({
        email: rsvp.user_email!,
        name: rsvp.user_name,
        member_id: null,
        context: {
          first_name: rsvp.user_name.split(/\s+/)[0],
          full_name: rsvp.user_name,
          email: rsvp.user_email!,
          lodge_name: lodge?.name ?? "the lodge",
          event_title: event.title,
          event_date: new Date(event.event_date).toLocaleDateString("en-GB", {
            day: "numeric",
            month: "long",
            year: "numeric",
          }),
        },
      }));
      total += recipients.length;
      if (recipients.length === 0) continue;
      const out = await sendBatch({
        lodgeId,
        templateKey: template.template_key,
        subject: template.subject,
        htmlBody: template.html_body,
        recipients,
        audienceLabel: `automation:post_meeting:${event.id}`,
      });
      sent += out.sent;
      failed += out.failed;
      skipped += out.skipped;
    }
    return { key, enabled: true, attempted: total, sent, failed, skipped };
  }

  // dues_reminder reuses the dues reminder endpoint flow; we just stub here
  return { key, enabled: true, attempted: 0, sent: 0, failed: 0, skipped: 0 };
}
