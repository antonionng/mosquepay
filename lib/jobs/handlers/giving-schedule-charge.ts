// lib/jobs/handlers/giving-schedule-charge.ts
//
// Daily cron handler that drives the saved-charge subscription cycles
// (Mooov 2026-05-28 reply, task L1.3). Each tick:
//
//   1. Fetch giving_schedules with status in (active, past_due) whose
//      next_charge_at is on or before today.
//   2. For each, find the next outstanding instalment row.
//   3. Insert a mooov.payment_attempts row keyed on a deterministic
//      payment_id (pay_giving_<schedule_id>_<NNN>) so the cycle webhook
//      can route through the existing intent switch.
//   4. Call POST /v1/charges/saved with the saved PM. Branch on the
//      response status:
//         succeeded         → cycle webhook will project; we just stamp
//                             provider_ref
//         requires_action   → store next_action.* on the schedule, email
//                             the member a resume link, leave the
//                             instalment outstanding so the cron re-tries
//                             on the next tick (Mooov idempotency makes
//                             that safe)
//         failed            → bump consecutive_failures + status; the
//                             cycle webhook (payment.failed branch) will
//                             also bump if/when it arrives, so the
//                             handleGivingSubscriptionFailure code is
//                             idempotent on consecutive_failures
//
// Idempotency: payment_id is deterministic per (schedule_id, sequence)
// so a re-run of the same cycle hits Mooov's replay path and returns
// the original envelope (Mooov 2026-05-28 reply, Q-D).

import * as db from "@/lib/db";
import { createServiceClient } from "@/lib/supabase/server";
import { runSavedGivingCharge } from "@/lib/mooov-charges";
import { MooovApiError } from "@/lib/mooov";
import { givingSubscriptionEnabled } from "@/lib/giving/feature-flags";
import type { GivingSchedule, MemberGivingInstalment } from "@/lib/db/types";

export type GivingScheduleChargeResult = {
  examined: number;
  charged: number;
  requires_action: number;
  failed: number;
  skipped: number;
};

export async function runGivingScheduleCharge(
  today: string = new Date().toISOString().slice(0, 10)
): Promise<GivingScheduleChargeResult> {
  const result: GivingScheduleChargeResult = {
    examined: 0,
    charged: 0,
    requires_action: 0,
    failed: 0,
    skipped: 0,
  };

  // Feature gate: skip the entire run until Mooov has shipped Slice 3
  // to prod (planned 5 Jun 2026). Schedules sit at status='active' but
  // never tick down a cycle. Logged loudly so a missed env-flag flip
  // shows up in cron logs.
  if (!givingSubscriptionEnabled()) {
    console.log(
      "giving.schedule.charge: skipped (CHURCHPAY_GIVING_SUBSCRIPTION_ENABLED is not true)"
    );
    return result;
  }

  const due = await db.getGivingSchedulesDue(today, 200);
  result.examined = due.length;

  for (const schedule of due) {
    try {
      await chargeOne(schedule, today, result);
    } catch (err) {
      result.failed += 1;
      console.error("giving.schedule.charge: cycle failed for schedule", {
        schedule_id: schedule.id,
        church_id: schedule.church_id,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return result;
}

async function chargeOne(
  schedule: GivingSchedule,
  _today: string,
  result: GivingScheduleChargeResult
): Promise<void> {
  // Skip schedules without a saved PM. Should not happen in practice
  // because the enrolment projector will not flip status -> active until
  // payment_method_id arrives, but defence-in-depth.
  if (!schedule.mooov_payment_method_id) {
    result.skipped += 1;
    return;
  }
  if (
    schedule.status !== "active" &&
    schedule.status !== "past_due"
  ) {
    result.skipped += 1;
    return;
  }

  const instalments = await db.getInstalmentsForGiving(
    schedule.member_giving_id,
    schedule.church_id
  );
  const next = instalments
    .filter(
      (i) =>
        i.schedule_id === schedule.id &&
        (i.status === "outstanding" || i.status === "overdue")
    )
    .sort((a, b) => a.sequence - b.sequence)[0] as
    | MemberGivingInstalment
    | undefined;

  if (!next) {
    // Schedule still pointing at a charge date but no outstanding
    // instalments — likely a webhook race where the parent member_giving
    // got flipped paid. Reconcile here.
    await db.updateGivingSchedule(schedule.id, schedule.church_id, {
      status: "completed",
      next_charge_at: null,
    });
    result.skipped += 1;
    return;
  }

  // Resolve merchant + tenant slug.
  const supa = createServiceClient();
  const { data: merchantRow } = await supa
    .schema("mooov")
    .from("churches")
    .select("merchant_id, status")
    .eq("id", schedule.church_id)
    .maybeSingle<{ merchant_id: string; status: string }>();
  if (
    !merchantRow ||
    !merchantRow.merchant_id ||
    (merchantRow.status && merchantRow.status !== "active")
  ) {
    result.skipped += 1;
    return;
  }
  const churchRow = await db.getChurchById(schedule.church_id);
  const churchSlug = churchRow?.slug ?? "";

  const cycleNumber = next.sequence;
  const seq = String(cycleNumber).padStart(3, "0");
  const paymentId = `pay_giving_${schedule.id}_${seq}`;
  const idempotencyKey = `lp:giving:cycle:${schedule.id}:${seq}`;
  const amountMinor = Math.round(next.amount * 100);
  const currency = (next.currency ?? "GBP").toUpperCase();
  const description = `Church giving — cycle ${cycleNumber}`;

  // Stamp the cycle's payment_id onto the instalment row so the cycle
  // webhook can correlate without re-deriving from payment_id parsing.
  await db.updateInstalment(next.id, schedule.church_id, {
    payment_reference: paymentId,
  });

  const guestDescriptor: Record<string, unknown> = {
    source: "giving_schedule_cycle",
    schedule_id: schedule.id,
    giving_id: schedule.member_giving_id,
    instalment_id: next.id,
    customer_ref: schedule.customer_ref,
    member_id: schedule.member_id,
    donor_email: schedule.member_email,
    cycle_number: cycleNumber,
    cycles_total: instalments.length,
    church_slug: churchSlug,
  };
  const initialMetadata: Record<string, unknown> = {
    source: "churchpay_giving_schedule_cycle",
    church_id: schedule.church_id,
    church_slug: churchSlug,
    intent: "giving_subscription_cycle",
    schedule_id: schedule.id,
    giving_id: schedule.member_giving_id,
    cycle_number: cycleNumber,
  };

  // Insert (or upsert) the payment_attempts row. Re-runs of the same
  // cycle are protected by the (church_id, idempotency_key) unique
  // constraint; on conflict we let the existing row stand.
  const { error: insertErr } = await supa
    .schema("mooov")
    .from("payment_attempts")
    .upsert(
      {
        payment_id: paymentId,
        church_id: schedule.church_id,
        member_id: null,
        amount: amountMinor,
        currency,
        intent: "giving_subscription_cycle",
        status: "pending",
        idempotency_key: idempotencyKey,
        metadata: initialMetadata,
        guest_descriptor: guestDescriptor,
      },
      { onConflict: "church_id,idempotency_key" }
    );
  if (insertErr) {
    console.error("giving.schedule.charge: payment_attempts upsert failed", {
      schedule_id: schedule.id,
      payment_id: paymentId,
      code: insertErr.code,
      message: insertErr.message,
    });
    result.failed += 1;
    return;
  }

  try {
    const charge = await runSavedGivingCharge({
      payment_id: paymentId,
      merchant_id: merchantRow.merchant_id,
      customer_ref: schedule.customer_ref,
      payment_method_id: schedule.mooov_payment_method_id,
      amount_minor: amountMinor,
      currency,
      description,
      idempotency_key: idempotencyKey,
      metadata: {
        intent: "yearly_giving_monthly_cycle",
        schedule_id: schedule.id,
        giving_id: schedule.member_giving_id,
        instalment_id: next.id,
        cycle_number: String(cycleNumber),
        total_cycles: String(instalments.length),
        church_slug: churchSlug,
      },
    });

    await supa
      .schema("mooov")
      .from("payment_attempts")
      .update({
        status: charge.status,
        provider_ref: charge.provider_ref ?? null,
      })
      .eq("payment_id", paymentId);

    if (charge.status === "succeeded") {
      // Webhook will fire payment.succeeded with the same payment_id and
      // run projectGivingSubscriptionCycleCaptured. The cron's role here
      // ends; we don't update next_charge_at locally because the cycle
      // projector advances it (single source of truth).
      result.charged += 1;
      return;
    }

    if (charge.status === "requires_action" && charge.next_action) {
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      await db.updateGivingSchedule(schedule.id, schedule.church_id, {
        status: "action_required",
        next_action_client_secret: charge.next_action.client_secret,
        next_action_connected_account_id:
          charge.next_action.connected_account_id,
        next_action_expires_at: expiresAt,
        metadata: {
          ...(schedule.metadata ?? {}),
          last_publishable_key: charge.next_action.publishable_key,
          last_provider_ref: charge.provider_ref ?? null,
        },
      });
      result.requires_action += 1;
      return;
    }

    if (charge.status === "failed") {
      // The cycle webhook's payment.failed branch will also call
      // handleGivingSubscriptionFailure; it's idempotent on
      // consecutive_failures because we increment from the LATEST
      // schedule row each time, but to avoid double-counting in the
      // common case where the sync response and the webhook agree, we
      // let the webhook handler authoritatively bump and only set the
      // last_failure_* metadata here.
      const failureCode = charge.error?.code ?? null;
      const failureCategory = charge.error?.category ?? null;
      await db.updateGivingSchedule(schedule.id, schedule.church_id, {
        last_failure_code: failureCode,
        last_failure_category: failureCategory,
        last_failure_at: new Date().toISOString(),
      });
      result.failed += 1;
      return;
    }
  } catch (err) {
    if (err instanceof MooovApiError) {
      console.error("giving.schedule.charge: Mooov call failed", {
        schedule_id: schedule.id,
        payment_id: paymentId,
        category: err.category,
        status: err.status,
      });
      // Mooov 2026-05-28 reply, Q-D: 409 "request already processing"
      // means the prior call is still in-flight. Don't bump
      // consecutive_failures — wait for the webhook or retry next tick.
      const isInFlight =
        err.status === 409 && /already processing/i.test(err.body);
      if (!isInFlight) {
        await db.updateGivingSchedule(schedule.id, schedule.church_id, {
          last_failure_code: err.category,
          last_failure_at: new Date().toISOString(),
        });
        await supa
          .schema("mooov")
          .from("payment_attempts")
          .update({ status: "failed", failure_reason: err.category })
          .eq("payment_id", paymentId);
      }
      result.failed += 1;
      return;
    }
    throw err;
  }
}
