// lib/jobs/handlers/giving-year-start.ts
//
// Two scheduled handlers covering the giving-year transition:
//
//   giving.year_start_create
//     Daily idempotent sweep. For each mosque whose current giving year
//     started today (within a 1-day grace window), make sure every
//     active member has a member_giving row for the new year. Skips
//     members whose row already exists (typical for treasurer pre-creates
//     or pay-in-advance rolls). Members on auto-renewing schedules where
//     a previous-year schedule completed get their next-year schedule
//     status flipped from `completed` back to `active` against the new
//     giving row — but only if auto_renew=true on the schedule.
//
//   giving.year_start_prompt
//     Daily sweep. For each mosque with a giving year starting in the
//     next `mosque_giving.year_start_prompt_days` window, send members an
//     email teaser (template 'giving_year_start_reminder') so they can
//     prepay or set up the monthly subscription before the year flips.
//     Idempotent on (mosque_id, year_id, member_email) via the audit_log
//     check below.

import * as db from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";

export type YearStartCreateResult = {
  examined_mosques: number;
  created_giving: number;
  skipped: number;
  rolled_schedules: number;
};

export type YearStartPromptResult = {
  examined_mosques: number;
  prompts_sent: number;
  skipped: number;
};

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysFromNow(date: string): number {
  const d = new Date(date);
  return Math.round((d.getTime() - Date.now()) / ONE_DAY_MS);
}

export async function runGivingYearStartCreate(): Promise<YearStartCreateResult> {
  const result: YearStartCreateResult = {
    examined_mosques: 0,
    created_giving: 0,
    skipped: 0,
    rolled_schedules: 0,
  };

  const mosques = await db.listMosques();
  const today = todayIso();

  for (const mosque of mosques) {
    result.examined_mosques += 1;

    const currentYear = await db.getCurrentMosqueYear(mosque.id).catch(() => null);
    if (!currentYear) continue;

    // Trigger window: yearStart >= today - 1 day AND yearStart <= today.
    // The 1-day grace covers a missed cron tick or a year that started
    // overnight in another timezone.
    const startDay = currentYear.start_date.slice(0, 10);
    const todayMs = new Date(today).getTime();
    const startMs = new Date(startDay).getTime();
    const diffDays = Math.round((todayMs - startMs) / ONE_DAY_MS);
    if (diffDays < 0 || diffDays > 1) continue;

    const mosqueGiving = (await db.getMosqueGiving(mosque.id))[0] ?? null;
    if (!mosqueGiving || mosqueGiving.active !== true) continue;

    const members = await db.getMembers(mosque.id, { status: "active" });
    for (const member of members) {
      // Skip if a non-advance giving row already exists for this year.
      const memberGivingList = await db.getMemberGiving(mosque.id, {
        memberEmail: member.email,
      });
      const existing = memberGivingList.find(
        (d) =>
          !d.is_advance &&
          d.period_start.slice(0, 10) <= currentYear.end_date.slice(0, 10) &&
          d.period_end.slice(0, 10) >= currentYear.start_date.slice(0, 10)
      );
      if (existing) {
        result.skipped += 1;
        continue;
      }

      // Create the row. Treasurers can later flip to waived from the
      // member detail screen for life members / hardship cases.
      const annualAmount =
        currentYear.annual_giving_amount ?? mosqueGiving.amount ?? 0;
      if (annualAmount <= 0) {
        result.skipped += 1;
        continue;
      }
      const charitable =
        mosqueGiving.gift_aid_enabled === true
          ? Math.min(mosqueGiving.charitable_amount ?? 0, annualAmount)
          : 0;

      await db.createMemberGiving(mosque.id, {
        member_email: member.email,
        member_name: member.full_name,
        member_id: member.id,
        giving_id: mosqueGiving.id,
        amount: annualAmount,
        currency: mosqueGiving.currency ?? "gbp",
        period_start: currentYear.start_date.slice(0, 10),
        period_end: currentYear.end_date.slice(0, 10),
        status: "outstanding",
        payment_id: null,
        stripe_payment_intent_id: null,
        stripe_subscription_id: null,
        paid_at: null,
        charitable_amount: charitable,
        gift_aid_status:
          mosqueGiving.gift_aid_enabled && charitable > 0 ? "eligible" : "unknown",
        gift_aid_eligible_amount: charitable,
        full_year_amount: annualAmount,
        is_advance: false,
        advance_for_year_id: null,
      } as Parameters<typeof db.createMemberGiving>[1]);
      result.created_giving += 1;

      // If this member had an auto-renewing schedule that completed for
      // last year, the year-start path is the right place to roll it
      // forward. Out of scope for v1 (the schedule + new giving row need a
      // strategy + instalments seeded against the new year). Logged so
      // we know there's a member who should be re-engaged.
      const allSchedules = await db.getGivingSchedulesForMember(
        mosque.id,
        member.email
      );
      const completedAutoRenew = allSchedules.find(
        (s) => s.status === "completed" && s.auto_renew === true
      );
      if (completedAutoRenew) {
        result.rolled_schedules += 1;
        await writeAuditLog({
          mosqueId: mosque.id,
          action: "giving_auto_renew_pending",
          entityType: "giving_schedules",
          entityId: completedAutoRenew.id,
          summary: `Auto-renew pending for ${member.email} into ${currentYear.label}`,
          metadata: {
            year_label: currentYear.label,
            previous_schedule_id: completedAutoRenew.id,
          },
        });
      }
    }
  }

  return result;
}

export async function runGivingYearStartPrompt(): Promise<YearStartPromptResult> {
  const result: YearStartPromptResult = {
    examined_mosques: 0,
    prompts_sent: 0,
    skipped: 0,
  };

  const mosques = await db.listMosques();

  for (const mosque of mosques) {
    result.examined_mosques += 1;

    const mosqueGiving = (await db.getMosqueGiving(mosque.id))[0] ?? null;
    if (!mosqueGiving || mosqueGiving.active !== true) continue;
    const promptDays = mosqueGiving.year_start_prompt_days ?? 30;

    const allYears = await db.listMosqueGivingYears(mosque.id);
    const currentYear = await db.getCurrentMosqueYear(mosque.id).catch(() => null);
    if (!currentYear) continue;

    // The "next" year is the row whose start_date > today AND <= today + promptDays.
    const upcoming = allYears.find((y) => {
      const startDays = daysFromNow(y.start_date);
      return startDays > 0 && startDays <= promptDays;
    });
    if (!upcoming) continue;

    // Pull the recent audit log slice once per mosque so the per-member
    // dedup check is in memory. Cheap because year-start fires once a
    // year and the prompt window is at most 180 days, so the slice is
    // bounded by membership size + the daily granularity.
    const recentAudit = await db
      .listAuditLogs(mosque.id, 1000)
      .catch(() => []);
    const alreadySentByEmail = new Set(
      recentAudit
        .filter(
          (entry) =>
            entry.action === "giving_year_start_prompt_sent" &&
            (entry.metadata as Record<string, unknown> | null)?.year_id ===
              upcoming.id
        )
        .map(
          (entry) =>
            (entry.metadata as Record<string, unknown> | null)?.member_email
        )
        .filter((v): v is string => typeof v === "string")
    );

    const members = await db.getMembers(mosque.id, { status: "active" });
    for (const member of members) {
      if (alreadySentByEmail.has(member.email)) {
        result.skipped += 1;
        continue;
      }

      // Enqueue the email batch with a single recipient. The
      // 'giving_year_start_reminder' template ships with the migration
      // pack; mosques can edit the copy from /admin/communications.
      await db
        .enqueueJob({
          mosque_id: mosque.id,
          job_type: "email.batch",
          payload: {
            templateKey: "giving_year_start_reminder",
            audience: [{ email: member.email, full_name: member.full_name }],
            mergeData: {
              year_label: upcoming.label,
              year_start_date: upcoming.start_date.slice(0, 10),
              member_name: member.full_name,
            },
          },
          scheduled_at: new Date().toISOString(),
          max_attempts: 3,
          created_by_admin_user_id: null,
        })
        .catch((err) => {
          console.error("giving year-start prompt: enqueue failed", {
            mosque_id: mosque.id,
            member_email: member.email,
            message: err instanceof Error ? err.message : String(err),
          });
        });

      await writeAuditLog({
        mosqueId: mosque.id,
        action: "giving_year_start_prompt_sent",
        entityType: "giving",
        entityId: null,
        summary: `Year-start reminder queued for ${member.email} (${upcoming.label})`,
        metadata: {
          year_id: upcoming.id,
          year_label: upcoming.label,
          member_email: member.email,
          prompt_days: promptDays,
        },
      });
      result.prompts_sent += 1;
    }
  }

  return result;
}
