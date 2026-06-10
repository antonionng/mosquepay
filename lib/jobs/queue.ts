import * as db from "@/lib/db";
import type { Job } from "@/lib/db/types";
import { sendBatch } from "@/lib/communications/send";
import { runAutomation } from "@/lib/communications/automations";

type Handler = (job: Job) => Promise<void>;

const HANDLERS: Record<string, Handler> = {
  "email.batch": async (job) => {
    const payload = job.payload as {
      templateKey: string;
      audience: Array<{ email: string; full_name?: string }>;
      mergeData?: Record<string, string>;
    };
    if (!job.church_id) throw new Error("email.batch requires church_id");
    const template = await db.getMessageTemplateByKey(
      job.church_id,
      payload.templateKey
    );
    if (!template) throw new Error(`Template ${payload.templateKey} not found`);
    await sendBatch({
      churchId: job.church_id,
      templateKey: payload.templateKey,
      subject: template.subject ?? "",
      htmlBody: template.html_body ?? "",
      recipients: payload.audience.map((a) => ({
        email: a.email,
        name: a.full_name ?? "",
        context: { name: a.full_name ?? "", ...(payload.mergeData ?? {}) },
      })),
    });
  },
  "automation.run": async (job) => {
    const payload = job.payload as { key: string };
    if (!job.church_id) throw new Error("automation.run requires church_id");
    const { AUTOMATION_KEYS } = await import("@/lib/communications/automations");
    if (!(AUTOMATION_KEYS as readonly string[]).includes(payload.key)) {
      throw new Error(`Unknown automation key: ${payload.key}`);
    }
    await runAutomation(
      job.church_id,
      payload.key as (typeof AUTOMATION_KEYS)[number]
    );
  },
  "giving.reminders": async (job) => {
    if (!job.church_id) throw new Error("giving.reminders requires church_id");
    const overdue = await db.getMemberGiving(job.church_id, { status: "overdue" });
    for (const giving of overdue) {
      await db.updateMemberGivingStatus(giving.id, job.church_id, {
        reminder_sent_at: new Date().toISOString(),
        reminder_count: (giving.reminder_count ?? 0) + 1,
      });
    }
  },
  "ledger.export": async (job) => {
    // No-op placeholder: real export already happens via /api/admin/ledger.
    // Useful as a checkpoint if you want to schedule an export and notify.
    void job;
  },
  "pastoral.alerts": async (job) => {
    if (!job.church_id) throw new Error("pastoral.alerts requires church_id");
    const { generatePastoralCareAlerts } = await import("@/lib/pastoral/alerts");
    await generatePastoralCareAlerts(job.church_id);
  },
  // Daily cron: drives the saved-charge subscription cycles. Mooov-side
  // contract: 2026-05-28 reply, task L1.3. The handler scans for
  // giving_schedules due today across ALL churches in a single pass.
  // payload.day is just an idempotency stamp; church_id is intentionally
  // null on the job row.
  "giving.schedule.charge": async (_job) => {
    const { runGivingScheduleCharge } = await import(
      "@/lib/jobs/handlers/giving-schedule-charge"
    );
    const summary = await runGivingScheduleCharge();
    console.log("giving.schedule.charge summary", summary);
  },
  // Daily cron: ensures member_giving rows exist for the current church
  // year for every active member, the day after the year flips. Audit
  // entries flag schedules that need rolling forward (auto_renew=true
  // schedules that completed last year). v1: just flags; v2: actually
  // re-creates the schedule against the new giving row.
  "giving.year_start_create": async (_job) => {
    const { runGivingYearStartCreate } = await import(
      "@/lib/jobs/handlers/giving-year-start"
    );
    const summary = await runGivingYearStartCreate();
    console.log("giving.year_start_create summary", summary);
  },
  // Daily cron: emails members in the run-up to the year flip so they
  // can prepay or set up monthly before giving fall due. Newcomer time comes
  // from church_giving.year_start_prompt_days. Idempotent on
  // (year_id, member_email) via audit_log dedup.
  "giving.year_start_prompt": async (_job) => {
    const { runGivingYearStartPrompt } = await import(
      "@/lib/jobs/handlers/giving-year-start"
    );
    const summary = await runGivingYearStartPrompt();
    console.log("giving.year_start_prompt summary", summary);
  },
};

/**
 * Enqueue per-church recurring jobs (pastoral alerts daily, giving reminders weekly)
 * if they have not been scheduled in the current period yet. Idempotent and
 * cheap enough to run on every queue drain.
 */
async function scheduleRecurringJobs(): Promise<void> {
  const churches = await db.listChurches();
  const now = new Date();
  const dayKey = now.toISOString().slice(0, 10);
  const isMonday = now.getUTCDay() === 1;
  const weekKey = isMonday ? dayKey : null;

  // Global (church_id = null) daily crons. Each handler scans all churches
  // in a single pass so we only need ONE job row per day, not one per
  // church. payload.day is the dedup key.
  const recentGlobal = await db.listJobs({ churchId: null, limit: 100 });
  const globalJobsToday: Array<{ jobType: string }> = [
    { jobType: "giving.schedule.charge" },
    { jobType: "giving.year_start_create" },
    { jobType: "giving.year_start_prompt" },
  ];
  for (const { jobType } of globalJobsToday) {
    const already = recentGlobal.some(
      (job) =>
        job.job_type === jobType &&
        (job.payload as { day?: string } | null)?.day === dayKey
    );
    if (!already) {
      await db.enqueueJob({
        church_id: null,
        job_type: jobType,
        payload: { day: dayKey },
        scheduled_at: now.toISOString(),
        max_attempts: 3,
        created_by_admin_user_id: null,
      });
    }
  }

  for (const church of churches) {
    const recent = await db.listJobs({ churchId: church.id, limit: 50 });

    const hasPastoralCareToday = recent.some(
      (job) =>
        job.job_type === "pastoral.alerts" &&
        (job.payload as { day?: string } | null)?.day === dayKey
    );
    if (!hasPastoralCareToday) {
      await db.enqueueJob({
        church_id: church.id,
        job_type: "pastoral.alerts",
        payload: { day: dayKey },
        scheduled_at: now.toISOString(),
        max_attempts: 3,
        created_by_admin_user_id: null,
      });
    }

    if (weekKey) {
      const hasGivingThisWeek = recent.some(
        (job) =>
          job.job_type === "giving.reminders" &&
          (job.payload as { week?: string } | null)?.week === weekKey
      );
      if (!hasGivingThisWeek) {
        await db.enqueueJob({
          church_id: church.id,
          job_type: "giving.reminders",
          payload: { week: weekKey },
          scheduled_at: now.toISOString(),
          max_attempts: 3,
          created_by_admin_user_id: null,
        });
      }
    }
  }
}

export async function processQueue(maxJobs = 5): Promise<{
  processed: number;
  succeeded: number;
  failed: number;
}> {
  try {
    await scheduleRecurringJobs();
  } catch {
    // Scheduling failures should not block draining the queue.
  }
  const claimed = await db.claimNextJobs(maxJobs);
  let succeeded = 0;
  let failed = 0;
  for (const job of claimed) {
    const handler = HANDLERS[job.job_type];
    if (!handler) {
      await db.completeJob(job.id, {
        ok: false,
        error: `No handler for job_type ${job.job_type}`,
      });
      failed++;
      continue;
    }
    try {
      await handler(job);
      await db.completeJob(job.id, { ok: true });
      succeeded++;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      await db.completeJob(job.id, { ok: false, error: message });
      failed++;
    }
  }
  return { processed: claimed.length, succeeded, failed };
}
