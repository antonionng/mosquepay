import * as db from "@/lib/db";
import { sendBatch, buildMemberContext } from "./send";

export const AUTOMATION_KEYS = [
  "birthday",
  "membership_anniversary",
  "post_service_thank_you",
  "giving_reminder",
] as const;

export type AutomationKey = (typeof AUTOMATION_KEYS)[number];

export const AUTOMATION_LABELS: Record<AutomationKey, string> = {
  birthday: "Birthday greeting",
  membership_anniversary: "Initiation anniversary",
  post_service_thank_you: "Post-service thank you",
  giving_reminder: "Giving reminder",
};

export const AUTOMATION_TEMPLATE_KEYS: Record<AutomationKey, string> = {
  birthday: "system.birthday.greeting",
  membership_anniversary: "system.membership.anniversary",
  post_service_thank_you: "system.post-service.thank-you",
  giving_reminder: "system.giving.reminder",
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

export async function runAllAutomations(churchId: string): Promise<AutomationRunResult[]> {
  const settings = await db.listAutomationSettings(churchId);
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
      const result = await runAutomation(churchId, key);
      results.push(result);
    } catch (error) {
      console.warn(`Automation ${key} failed`, error);
      results.push({ ...empty, failed: 1 });
    }
  }
  return results;
}

export async function runAutomation(
  churchId: string,
  key: AutomationKey
): Promise<AutomationRunResult> {
  const church = await db.getChurchById(churchId);
  const template = await db.getMessageTemplateByKey(
    churchId,
    AUTOMATION_TEMPLATE_KEYS[key]
  );
  if (!template) {
    return { key, enabled: true, attempted: 0, sent: 0, failed: 0, skipped: 0 };
  }
  const today = new Date();

  if (key === "birthday") {
    const members = await db.getMembers(churchId, { status: "active" });
    const recipients = members
      .filter((m) => isSameMonthDay(today, m.date_of_birth))
      .map((member) => ({
        email: member.email,
        name: member.full_name,
        member_id: member.id,
        context: buildMemberContext(member, church),
      }));
    if (recipients.length === 0) {
      return { key, enabled: true, attempted: 0, sent: 0, failed: 0, skipped: 0 };
    }
    const out = await sendBatch({
      churchId,
      templateKey: template.template_key,
      subject: template.subject,
      htmlBody: template.html_body,
      recipients,
      audienceLabel: "automation:birthday",
    });
    await db.upsertAutomationSetting(churchId, key, true, {
      last_run_at: new Date().toISOString(),
    });
    return { key, enabled: true, attempted: recipients.length, ...out };
  }

  if (key === "membership_anniversary") {
    const members = await db.getMembers(churchId, { status: "active" });
    const recipients = members
      .filter((m) => isSameMonthDay(today, m.date_of_membership))
      .map((member) => {
        const membershipYear = member.date_of_membership
          ? new Date(member.date_of_membership).getFullYear()
          : today.getFullYear();
        const years = today.getFullYear() - membershipYear;
        return {
          email: member.email,
          name: member.full_name,
          member_id: member.id,
          context: buildMemberContext(member, church, { years: String(years) }),
        };
      })
      .filter((r) => Number(r.context.years) > 0);
    if (recipients.length === 0) {
      return { key, enabled: true, attempted: 0, sent: 0, failed: 0, skipped: 0 };
    }
    const out = await sendBatch({
      churchId,
      templateKey: template.template_key,
      subject: template.subject,
      htmlBody: template.html_body,
      recipients,
      audienceLabel: "automation:membership_anniversary",
    });
    return { key, enabled: true, attempted: recipients.length, ...out };
  }

  if (key === "post_service_thank_you") {
    const events = await db.getEvents(churchId, { published: true });
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
      const rsvps = await db.getRsvpsByEventId(event.id, churchId);
      const attendees = rsvps.filter((r) => r.attending_ceremony && r.user_email);
      const recipients = attendees.map((rsvp) => ({
        email: rsvp.user_email!,
        name: rsvp.user_name,
        member_id: null,
        context: {
          first_name: rsvp.user_name.split(/\s+/)[0],
          full_name: rsvp.user_name,
          email: rsvp.user_email!,
          church_name: church?.name ?? "the church",
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
        churchId,
        templateKey: template.template_key,
        subject: template.subject,
        htmlBody: template.html_body,
        recipients,
        audienceLabel: `automation:post_service:${event.id}`,
      });
      sent += out.sent;
      failed += out.failed;
      skipped += out.skipped;
    }
    return { key, enabled: true, attempted: total, sent, failed, skipped };
  }

  // giving_reminder reuses the giving reminder endpoint flow; we just stub here
  return { key, enabled: true, attempted: 0, sent: 0, failed: 0, skipped: 0 };
}
