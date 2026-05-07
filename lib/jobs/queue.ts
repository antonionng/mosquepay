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
    if (!job.lodge_id) throw new Error("email.batch requires lodge_id");
    const template = await db.getMessageTemplateByKey(
      job.lodge_id,
      payload.templateKey
    );
    if (!template) throw new Error(`Template ${payload.templateKey} not found`);
    await sendBatch({
      lodgeId: job.lodge_id,
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
    if (!job.lodge_id) throw new Error("automation.run requires lodge_id");
    const { AUTOMATION_KEYS } = await import("@/lib/communications/automations");
    if (!(AUTOMATION_KEYS as readonly string[]).includes(payload.key)) {
      throw new Error(`Unknown automation key: ${payload.key}`);
    }
    await runAutomation(
      job.lodge_id,
      payload.key as (typeof AUTOMATION_KEYS)[number]
    );
  },
  "dues.reminders": async (job) => {
    if (!job.lodge_id) throw new Error("dues.reminders requires lodge_id");
    const overdue = await db.getMemberDues(job.lodge_id, { status: "overdue" });
    for (const dues of overdue) {
      await db.updateMemberDuesStatus(dues.id, job.lodge_id, {
        reminder_sent_at: new Date().toISOString(),
        reminder_count: (dues.reminder_count ?? 0) + 1,
      });
    }
  },
  "ledger.export": async (job) => {
    // No-op placeholder: real export already happens via /api/admin/ledger.
    // Useful as a checkpoint if you want to schedule an export and notify.
    void job;
  },
  "welfare.alerts": async (job) => {
    if (!job.lodge_id) throw new Error("welfare.alerts requires lodge_id");
    const { generateWelfareAlerts } = await import("@/lib/welfare/alerts");
    await generateWelfareAlerts(job.lodge_id);
  },
};

/**
 * Enqueue per-lodge recurring jobs (welfare alerts daily, dues reminders weekly)
 * if they have not been scheduled in the current period yet. Idempotent and
 * cheap enough to run on every queue drain.
 */
async function scheduleRecurringJobs(): Promise<void> {
  const lodges = await db.listLodges();
  const now = new Date();
  const dayKey = now.toISOString().slice(0, 10);
  const isMonday = now.getUTCDay() === 1;
  const weekKey = isMonday ? dayKey : null;

  for (const lodge of lodges) {
    const recent = await db.listJobs({ lodgeId: lodge.id, limit: 50 });

    const hasWelfareToday = recent.some(
      (job) =>
        job.job_type === "welfare.alerts" &&
        (job.payload as { day?: string } | null)?.day === dayKey
    );
    if (!hasWelfareToday) {
      await db.enqueueJob({
        lodge_id: lodge.id,
        job_type: "welfare.alerts",
        payload: { day: dayKey },
        scheduled_at: now.toISOString(),
        max_attempts: 3,
        created_by_admin_user_id: null,
      });
    }

    if (weekKey) {
      const hasDuesThisWeek = recent.some(
        (job) =>
          job.job_type === "dues.reminders" &&
          (job.payload as { week?: string } | null)?.week === weekKey
      );
      if (!hasDuesThisWeek) {
        await db.enqueueJob({
          lodge_id: lodge.id,
          job_type: "dues.reminders",
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
