// POST /api/giving/pay
//
// Member-side giving payment. Two callers today:
//   * app/(member)/member/giving/page.tsx       (member portal)
//   * app/giving/[givingId]/giving-pay-client.tsx   (public email link)
//
// Payment surface: 100% Mooov (Mooov Connect -> hosted Stripe Checkout on
// the mosque's connected PSP). No direct Stripe SDK, no fallback. The mosque's
// merchant must be active in mooov.mosques; otherwise we return 503.
//
// One-off vs subscription:
//   * mode = "one_off" (default): single hosted Checkout charge against
//     /v1/payment_intents.
//   * mode = "subscription": saved-charge interim. Mints an enrolment
//     intent against /v1/payment_intents with setup_future_usage="off_session"
//     plus customer_ref, captures month 1, saves the cardholder PM. The
//     daily cron in lib/jobs/queue.ts then drives subsequent cycles via
//     /v1/charges/saved (lib/mooov-charges.ts::runSavedGivingCharge).
//     Mooov spec: 2026-05-28 reply, tasks L1.1 + L1.3.
import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import * as db from "@/lib/db";
import { getDefaultMosqueSlug } from "@/lib/tenant";
import { createServiceClient } from "@/lib/supabase/server";
import { callMooovConnect, MooovApiError } from "@/lib/mooov";
import { givingSubscriptionEnabled } from "@/lib/giving/feature-flags";
import {
  computeEnrolmentPlan,
  type EnrolmentPlan,
} from "@/lib/giving/enrolment-plan";
import type { GivingCadence } from "@/lib/giving/strategies";
import type { GivingSplitStrategy, MemberGiving } from "@/lib/db/types";

/**
 * Serialize an unknown thrown value into a JSON-safe shape for logs.
 * Supabase rejects with PostgrestError-shaped objects (plain objects with
 * code/message/details/hint, no Error prototype) which serialize to
 * "[object Object]" through String() and have no stack. Pulling out the
 * known fields means the production log actually tells us what failed.
 */
function describeError(err: unknown): {
  name?: string;
  code?: string | number;
  message?: string;
  details?: string;
  hint?: string;
  stack?: string;
} {
  if (err instanceof Error) {
    return { name: err.name, message: err.message, stack: err.stack };
  }
  if (err && typeof err === "object") {
    const e = err as Record<string, unknown>;
    return {
      name: typeof e.name === "string" ? e.name : undefined,
      code:
        typeof e.code === "string" || typeof e.code === "number"
          ? (e.code as string | number)
          : undefined,
      message: typeof e.message === "string" ? e.message : undefined,
      details: typeof e.details === "string" ? e.details : undefined,
      hint: typeof e.hint === "string" ? e.hint : undefined,
    };
  }
  return { message: String(err) };
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function loadMooovMerchant(
  supa: ReturnType<typeof createServiceClient>,
  mosqueId: string,
): Promise<string | null> {
  const { data, error } = await supa
    .schema("mooov")
    .from("mosques")
    .select("merchant_id, status")
    .eq("id", mosqueId)
    .maybeSingle<{ merchant_id: string; status: string }>();
  if (error) throw error;
  if (!data) return null;
  if (data.status && data.status !== "active") return null;
  return data.merchant_id ?? null;
}

export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Database not configured." },
      { status: 503 }
    );
  }

  try {
    const body = await request.json();
    const { giving_id, member_email, member_name, mode } = body;

    if (!giving_id || !member_email) {
      return NextResponse.json(
        { error: "giving_id and member_email are required." },
        { status: 400 }
      );
    }

    // Resolve tenant from the giving row itself, not from URL/host/cookie.
    //
    // Why: a member of mosque A signed in on mosque B's host (or on the bare
    // mosque-pay.com host) used to land on this route with a
    // URL-derived mosque_id that didn't match the giving row's mosque_id, so
    // the getMemberGiving(mosqueId, { memberEmail }) filter returned an empty
    // list and we surfaced "Giving record not found." even though the row
    // existed and the email matched. The giving_id UUID is unguessable, so
    // we treat (giving_id, member_email) as the authorization tuple and
    // derive mosqueId from the giving row.
    let supa: ReturnType<typeof createServiceClient>;
    try {
      supa = createServiceClient();
    } catch (err) {
      console.error("giving/pay: supabase service client unavailable", {
        message: err instanceof Error ? err.message : String(err),
      });
      return NextResponse.json(
        { error: "Payments are not configured." },
        { status: 503 }
      );
    }

    const { data: givingRecordRaw, error: givingErr } = await supa
      .from("member_giving")
      .select("*")
      .eq("id", giving_id)
      .maybeSingle();
    if (givingErr) {
      console.error("giving/pay: giving lookup failed", {
        giving_id,
        message: givingErr.message,
      });
      return NextResponse.json(
        { error: "Could not look up giving record." },
        { status: 500 }
      );
    }
    if (!givingRecordRaw) {
      return NextResponse.json(
        { error: "Giving record not found." },
        { status: 404 }
      );
    }
    const givingRecord = givingRecordRaw as MemberGiving;

    if (
      (givingRecord.member_email ?? "").trim().toLowerCase() !==
      String(member_email).trim().toLowerCase()
    ) {
      // Email didn't match the giving row -- treat as not found rather than
      // 403 to avoid leaking giving_id existence to a different member.
      return NextResponse.json(
        { error: "Giving record not found." },
        { status: 404 }
      );
    }
    if (givingRecord.status === "paid") {
      return NextResponse.json({ error: "Giving already paid." }, { status: 400 });
    }

    const mosqueId = givingRecord.mosque_id;
    const { data: mosqueRow } = await supa
      .from("mosques")
      .select("slug")
      .eq("id", mosqueId)
      .maybeSingle<{ slug: string | null }>();
    const mosqueSlug = mosqueRow?.slug ?? getDefaultMosqueSlug();

    if (mode === "subscription") {
      // Feature-gated until Mooov's saved-charge subscription contract
      // ships to prod (planned 5 Jun 2026). The contract requires fields
      // that aren't on Mooov prod yet (data.payment_method_id +
      // data.stripe_customer_id on payment.captured/succeeded for any
      // payment created with customer_ref). Flipping
      // MOSQUEPAY_GIVING_SUBSCRIPTION_ENABLED=true on the deployment scope
      // unlocks this path on or after the cutover.
      if (!givingSubscriptionEnabled()) {
        return NextResponse.json(
          {
            error:
              "Monthly instalments are coming soon. Please pay in full or contact your mosque secretary.",
            code: "subscription_not_enabled",
          },
          { status: 503 }
        );
      }
      // Saved-charge interim path. We mint a Mooov enrolment intent that
      // collects month 1 AND saves the cardholder PM (setup_future_usage),
      // pre-create the giving_schedules row + member_giving_instalments rows
      // for the chosen split strategy, and hand off to Mooov hosted
      // Checkout. The cycle webhook (mooov-webhooks/connect) populates
      // giving_schedules.mooov_payment_method_id + stripe_customer_id when
      // payment.succeeded fires for the enrolment payment_id.
      return await startGivingSubscriptionEnrolment({
        mosqueId,
        mosqueSlug,
        givingRecord,
        memberEmail: member_email,
        memberName: member_name,
        strategy: body.split_strategy as GivingSplitStrategy | undefined,
        autoRenew: typeof body.auto_renew === "boolean" ? body.auto_renew : undefined,
        cadence:
          body.cadence === "monthly" || body.cadence === "quarterly"
            ? (body.cadence as GivingCadence)
            : undefined,
      });
    }

    let merchantId: string | null;
    try {
      merchantId = await loadMooovMerchant(supa, mosqueId);
    } catch (err) {
      console.error("giving/pay: mooov merchant lookup failed", {
        mosque_id: mosqueId,
        message: err instanceof Error ? err.message : String(err),
      });
      return NextResponse.json(
        { error: "Could not look up payment processor for this mosque." },
        { status: 500 }
      );
    }
    if (!merchantId) {
      return NextResponse.json(
        {
          error:
            "This mosque has not finished setting up online payments yet. Please contact the mosque directly.",
          code: "mosque_not_connected",
        },
        { status: 503 }
      );
    }

    const totalMinor = Math.round(givingRecord.amount * 100);
    const currency = (givingRecord.currency ?? "GBP").toUpperCase();
    const paymentId = `giving_${mosqueId}_${givingRecord.id}_${Date.now().toString(36)}`;
    const idempotencyKey = `giving_${givingRecord.id}_${Date.now().toString(36)}`;
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
    const mosqueQuery =
      mosqueSlug === getDefaultMosqueSlug() ? "" : `&mosque=${encodeURIComponent(mosqueSlug)}`;
    const successUrl = `${siteUrl}/events/rsvp/success?payment_id=${encodeURIComponent(
      paymentId
    )}&type=giving${mosqueQuery}`;
    const cancelUrl = `${siteUrl}/giving/${givingRecord.id}?email=${encodeURIComponent(
      member_email
    )}${mosqueQuery ? `&mosque=${encodeURIComponent(mosqueSlug)}` : ""}`;
    const description = `Mosque Giving: ${givingRecord.period_start} to ${givingRecord.period_end}`;

    const guestDescriptor: Record<string, unknown> = {
      source: "member_giving",
      giving_id: givingRecord.id,
      mosque_slug: mosqueSlug,
      donor_email: member_email,
      donor_name: member_name ?? givingRecord.member_name ?? null,
      charitable_amount: givingRecord.charitable_amount ?? 0,
    };
    const initialMetadata: Record<string, unknown> = {
      source: "mosquepay_giving_pay",
      mosque_slug: mosqueSlug,
      mosque_id: mosqueId,
      intent: "giving",
      giving_id: givingRecord.id,
    };

    const { error: insertError } = await supa
      .schema("mooov")
      .from("payment_attempts")
      .insert({
        payment_id: paymentId,
        mosque_id: mosqueId,
        member_id: null,
        amount: totalMinor,
        currency,
        intent: "giving",
        status: "pending",
        idempotency_key: idempotencyKey,
        metadata: initialMetadata,
        guest_descriptor: guestDescriptor,
      });
    if (insertError) {
      console.error("giving/pay: preflight insert failed", {
        mosque_id: mosqueId,
        payment_id: paymentId,
        code: insertError.code,
        message: insertError.message,
      });
      return NextResponse.json(
        {
          error: "Could not start payment.",
          payment_id: paymentId,
          db_code: insertError.code ?? null,
        },
        { status: 500 }
      );
    }

    try {
      const result = await callMooovConnect<{
        payment_id: string;
        state: "authorized" | "captured" | "processing" | "failed";
        provider?: { provider: string; provider_ref?: string; hosted_url?: string };
        checkout_session_id?: string;
      }>("POST", "/v1/payment_intents", {
        merchant: merchantId,
        idempotencyKey,
        body: {
          payment_id: paymentId,
          amount: totalMinor,
          currency,
          flow: "embedded",
          success_url: successUrl,
          cancel_url: cancelUrl,
          description,
          customer_email: member_email,
          metadata: {
            intent: "giving",
            mosque_id: mosqueId,
            mosque_slug: mosqueSlug,
            giving_id: givingRecord.id,
          },
        },
      });

      const hostedUrl = result.provider?.hosted_url ?? null;
      if (!hostedUrl) {
        console.error("giving/pay: Mooov returned no hosted_url", {
          payment_id: paymentId,
          merchant_id: merchantId,
          state: result.state,
          provider: result.provider ?? null,
          full_response: result,
        });
        return NextResponse.json(
          { error: "Payment processor did not return a checkout URL." },
          { status: 502 }
        );
      }

      await supa
        .schema("mooov")
        .from("payment_attempts")
        .update({
          status: result.state,
          provider_ref: result.provider?.provider_ref ?? null,
          metadata: {
            ...initialMetadata,
            hosted_url: hostedUrl,
            flow: "embedded",
            checkout_session_id: result.checkout_session_id ?? null,
          },
        })
        .eq("payment_id", paymentId);

      return NextResponse.json({ url: hostedUrl, payment_id: paymentId });
    } catch (err) {
      if (err instanceof MooovApiError) {
        console.error("giving/pay: Mooov call failed", {
          payment_id: paymentId,
          category: err.category,
          status: err.status,
        });
        await supa
          .schema("mooov")
          .from("payment_attempts")
          .update({ status: "failed", failure_reason: err.category })
          .eq("payment_id", paymentId);
        if (err.category === "merchant_setup_required" && err.setupHint) {
          return NextResponse.json(
            {
              error:
                "This mosque has not finished setting up online payments yet. Please contact the mosque directly.",
              code: "mosque_setup_incomplete",
              setup_url: err.setupHint.setupUrl,
            },
            { status: 503 }
          );
        }
        return NextResponse.json(
          { error: "Could not create payment session.", code: err.category },
          { status: 502 }
        );
      }
      console.error("giving/pay: unexpected error", err);
      await supa
        .schema("mooov")
        .from("payment_attempts")
        .update({ status: "failed", failure_reason: "unexpected_error" })
        .eq("payment_id", paymentId);
      return NextResponse.json(
        { error: "Could not create payment session.", code: "unexpected_error" },
        { status: 500 }
      );
    }
  } catch (e) {
    console.error("Giving pay error:", e);
    return NextResponse.json(
      { error: "Could not create payment session." },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// Subscription enrolment (saved-charge interim)
// ---------------------------------------------------------------------------

type EnrolmentArgs = {
  mosqueId: string;
  mosqueSlug: string;
  givingRecord: Awaited<ReturnType<typeof db.getMemberGiving>>[number];
  memberEmail: string;
  memberName: string | null | undefined;
  strategy: GivingSplitStrategy | undefined;
  autoRenew: boolean | undefined;
  cadence: GivingCadence | undefined;
};

/**
 * Best-effort cleanup of any non-active giving state left over from a
 * previous enrolment attempt for this member_giving row. Called at the
 * top of both enrolment branches so retries (member clicked "Set Up
 * Instalments" again after a failed Mooov call, abandoned redirect,
 * member cancelled and resubscribed, etc.) start from a clean slate.
 *
 * Two responsibilities:
 *
 *   1. Mark any pending schedules cancelled (audit trail).
 *   2. Hard-delete any outstanding (unpaid) instalments tied to this
 *      member_giving_id whose schedule isn't active. Without this, the
 *      unique (member_giving_id, sequence) constraint on
 *      member_giving_instalments rejects the next attempt's pre-create
 *      with a Postgres error that bubbles up as "Could not create
 *      subscription session." Was hitting prod on retries after the
 *      member self-cancelled a schedule (cancel route doesn't delete
 *      instalments by design — treasurer needs to see what was owed).
 *
 * Schedules that captured money (mooov_payment_method_id or
 * last_charged_at set) are protected — we'd race-condition the member
 * out of a real subscription if we cancelled one mid-activation.
 */
async function abandonPendingSchedulesForGiving(
  mosqueId: string,
  memberGivingId: string,
): Promise<void> {
  const supa = createServiceClient();

  const pending = await db
    .listGivingSchedules(mosqueId, { status: "pending" })
    .catch(() => [] as Awaited<ReturnType<typeof db.listGivingSchedules>>);
  const orphans = pending
    .filter((s) => s.member_giving_id === memberGivingId)
    .filter(
      (s) => s.mooov_payment_method_id == null && s.last_charged_at == null,
    );
  for (const orphan of orphans) {
    try {
      await db.deleteInstalmentsForSchedule(orphan.id, mosqueId);
    } catch (err) {
      console.error("giving/pay: failed to delete orphan instalments", {
        schedule_id: orphan.id,
        ...describeError(err),
      });
    }
    try {
      await db.updateGivingSchedule(orphan.id, mosqueId, {
        status: "cancelled",
        cancelled_at: new Date().toISOString(),
        cancelled_by_actor: "system_enrolment_retry",
      });
    } catch (err) {
      console.error("giving/pay: failed to cancel orphan schedule", {
        schedule_id: orphan.id,
        ...describeError(err),
      });
    }
  }

  // Belt-and-braces: nuke any outstanding instalments still attached to
  // this member_giving whose parent schedule is cancelled / completed.
  // The cancel route used to leave these in place "so the treasurer
  // could see what was owed", but that broke the next enrolment's
  // pre-create. The treasurer's view comes off the giving_schedules row
  // (status + cycles_paid metadata) anyway, so the unpaid instalments
  // weren't load-bearing.
  const { data: orphanRows, error: selectErr } = await supa
    .from("member_giving_instalments")
    .select("id, schedule_id, status, paid_at")
    .eq("mosque_id", mosqueId)
    .eq("member_giving_id", memberGivingId)
    .is("paid_at", null);
  if (selectErr) {
    console.error("giving/pay: orphan instalment select failed", {
      member_giving_id: memberGivingId,
      ...describeError(selectErr),
    });
    return;
  }
  type OrphanRow = { id: string; schedule_id: string | null; status: string };
  const newcomers = (orphanRows as OrphanRow[] | null) ?? [];
  if (newcomers.length === 0) return;

  // Pull the parent schedule statuses in one shot to decide which
  // instalments are safe to drop. Instalments with a NULL schedule_id
  // (orphaned via ON DELETE SET NULL) are always safe to drop.
  const scheduleIds = Array.from(
    new Set(
      newcomers
        .map((r) => r.schedule_id)
        .filter((id): id is string => typeof id === "string"),
    ),
  );
  const scheduleStatuses = new Map<string, string>();
  if (scheduleIds.length > 0) {
    const { data: scheduleRows } = await supa
      .from("giving_schedules")
      .select("id, status")
      .in("id", scheduleIds);
    for (const row of (scheduleRows as { id: string; status: string }[] | null) ?? []) {
      scheduleStatuses.set(row.id, row.status);
    }
  }

  const SAFE_TO_NUKE = new Set(["cancelled", "completed"]);
  const dropIds = newcomers
    .filter((row) => row.status === "outstanding")
    .filter((row) => {
      if (!row.schedule_id) return true;
      const status = scheduleStatuses.get(row.schedule_id);
      return status != null && SAFE_TO_NUKE.has(status);
    })
    .map((row) => row.id);

  if (dropIds.length === 0) return;

  const { error: deleteErr } = await supa
    .from("member_giving_instalments")
    .delete()
    .in("id", dropIds);
  if (deleteErr) {
    console.error("giving/pay: orphan instalment delete failed", {
      member_giving_id: memberGivingId,
      drop_count: dropIds.length,
      ...describeError(deleteErr),
    });
    return;
  }
  console.info("giving/pay: cleared orphan instalments", {
    member_giving_id: memberGivingId,
    drop_count: dropIds.length,
  });
}

async function startGivingSubscriptionEnrolment(args: EnrolmentArgs) {
  const { mosqueId, mosqueSlug, givingRecord, memberEmail } = args;

  // Compute the full plan first. Same helper backs the
  // /api/giving/subscription-preview endpoint so the dialog the member
  // confirms cannot disagree with what we actually charge.
  // BUG FIX 2026-06-01: cadence was being parsed from the request body
  // and stashed on EnrolmentArgs, but never forwarded to
  // computeEnrolmentPlan here. The preview dialog (which DOES pass
  // cadence to /api/giving/subscription-preview) would render "£24 /
  // month" while this path silently fell back to the template default
  // (quarterly) and posted a £60 / 3-month subscription to Mooov. The
  // member's chosen cadence is the source of truth on this hop —
  // computeEnrolmentPlan still validates it against the mosque's
  // enabled cadenceOptions, so a stale / invalid value is harmless.
  const planResult = await computeEnrolmentPlan({
    mosqueId,
    givingRecord,
    memberEmail,
    strategy: args.strategy,
    autoRenew: args.autoRenew,
    cadence: args.cadence,
  });
  if (!planResult.ok) {
    return NextResponse.json(
      {
        error: planResult.error.message,
        code: planResult.error.code,
        ...(planResult.error.details ?? {}),
      },
      { status: planResult.error.status },
    );
  }
  const plan = planResult.plan;
  const {
    merchantId,
    member,
    mosqueYear: currentYear,
    strategy,
    autoRenew,
    customerRef,
    schedule: schedulePlan,
    annualAmount,
  } = plan;

  let supa: ReturnType<typeof createServiceClient>;
  try {
    supa = createServiceClient();
  } catch (err) {
    console.error("giving/pay subscription: supabase service client unavailable", {
      message: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: "Payments are not configured." },
      { status: 503 }
    );
  }

  // Branch on the Mooov surface that fits this plan. Mooov 2026-06-01:
  // open-ended Stripe Subscriptions live behind /v1/subscription_checkouts
  // (fully Mooov-branded checkout at pay.mooov.money). Variable-amount
  // strategies and auto-renew=off stay on the embedded payment-intent +
  // saved-charge surface we already drive via lib/mooov-charges.ts.
  if (plan.mooovFlow === "open_ended_subscription") {
    return startOpenEndedSubscription({ args, plan });
  }

  // Clean any orphan pending schedules from a previous failed attempt
  // before creating a fresh one. Otherwise the member portal renders a
  // phantom "Active subscription · 0 of 0 paid" while their balance is
  // still outstanding.
  await abandonPendingSchedulesForGiving(mosqueId, givingRecord.id);

  // Mint the schedule + instalment rows BEFORE talking to Mooov so the
  // webhook (which fires after the member completes hosted Checkout)
  // has somewhere to write the saved PM. Status=pending until the
  // enrolment intent succeeds.
  const schedule = await db.createGivingSchedule(mosqueId, {
    member_id: member.id,
    member_giving_id: givingRecord.id,
    member_email: memberEmail,
    customer_ref: customerRef,
    cadence: plan.cadence,
    split_strategy: strategy,
    auto_renew: autoRenew,
    status: "pending",
    next_charge_at: schedulePlan.rows[1]?.due_date ?? null,
    metadata: {
      annual_amount: annualAmount,
      cycles_total: schedulePlan.cycleCount,
      year_label: currentYear.label,
      cadence: plan.cadence,
      mooov_flow: "saved_charge_fixed_term",
    },
  });

  await db.createMemberGivingInstalments(
    mosqueId,
    schedulePlan.rows.map((row) => ({
      member_giving_id: givingRecord.id,
      sequence: row.sequence,
      due_date: row.due_date,
      amount: row.amount,
      currency: givingRecord.currency,
      status: "outstanding",
      paid_at: null,
      reminder_sent_at: null,
      payment_reference: null,
      schedule_id: schedule.id,
    }))
  );

  // Mint the Mooov enrolment intent. payment_id format follows Mooov's
  // L1.1 sample: pay_giving_<schedule_id>_001 makes the cycle pattern
  // obvious in their payments dashboard. We persist a payment_attempts
  // row ourselves so the existing webhook handler's intent switch can
  // route to the giving-subscription branch.
  const firstCycleMinor = Math.round(schedulePlan.firstCycleAmount * 100);
  const currency = (givingRecord.currency ?? "GBP").toUpperCase();
  const paymentId = `pay_giving_${schedule.id}_001`;
  const idempotencyKey = `lp:giving:enrol:${schedule.id}`;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const mosqueQuery =
    mosqueSlug === getDefaultMosqueSlug() ? "" : `&mosque=${encodeURIComponent(mosqueSlug)}`;
  const successUrl = `${siteUrl}/events/rsvp/success?payment_id=${encodeURIComponent(
    paymentId
  )}&type=giving_subscription${mosqueQuery}`;
  const cancelUrl = `${siteUrl}/giving/${givingRecord.id}?email=${encodeURIComponent(
    memberEmail
  )}${mosqueQuery ? `&mosque=${encodeURIComponent(mosqueSlug)}` : ""}`;
  const description = `Mosque Giving subscription — month 1 of ${schedulePlan.cycleCount}`;

  const guestDescriptor: Record<string, unknown> = {
    source: "member_giving_subscription_enrol",
    giving_id: givingRecord.id,
    schedule_id: schedule.id,
    customer_ref: customerRef,
    member_id: member.id,
    mosque_slug: mosqueSlug,
    donor_email: memberEmail,
    donor_name: args.memberName ?? givingRecord.member_name ?? null,
    cycles_total: schedulePlan.cycleCount,
    cycle_number: 1,
    split_strategy: strategy,
    charitable_amount: 0, // charitable portion attributed per cycle on capture
  };

  const initialMetadata: Record<string, unknown> = {
    source: "mosquepay_giving_subscription_enrol",
    mosque_slug: mosqueSlug,
    mosque_id: mosqueId,
    intent: "giving_subscription_enrol",
    giving_id: givingRecord.id,
    schedule_id: schedule.id,
    customer_ref: customerRef,
    cycles_total: schedulePlan.cycleCount,
  };

  const { error: insertError } = await supa
    .schema("mooov")
    .from("payment_attempts")
    .insert({
      payment_id: paymentId,
      mosque_id: mosqueId,
      member_id: null,
      amount: firstCycleMinor,
      currency,
      intent: "giving_subscription_enrol",
      status: "pending",
      idempotency_key: idempotencyKey,
      metadata: initialMetadata,
      guest_descriptor: guestDescriptor,
    });
  if (insertError) {
    console.error("giving/pay subscription: preflight insert failed", {
      mosque_id: mosqueId,
      payment_id: paymentId,
      schedule_id: schedule.id,
      code: insertError.code,
      message: insertError.message,
    });
    return NextResponse.json(
      {
        error: "Could not start subscription enrolment.",
        payment_id: paymentId,
        db_code: insertError.code ?? null,
      },
      { status: 500 }
    );
  }

  try {
    const result = await callMooovConnect<{
      payment_id: string;
      state: "authorized" | "captured" | "processing" | "failed";
      provider?: { provider: string; provider_ref?: string; hosted_url?: string };
      checkout_session_id?: string;
    }>("POST", "/v1/payment_intents", {
      merchant: merchantId,
      idempotencyKey,
      body: {
        payment_id: paymentId,
        amount: firstCycleMinor,
        currency,
        flow: "redirect",
        success_url: successUrl,
        cancel_url: cancelUrl,
        description,
        // Mooov expands customer_ref into a Stripe `customer` on the
        // connected account. Stripe then rejects the request if a
        // bare customer_email is also present ("You may only specify
        // one of these parameters: customer, customer_email."). The
        // member's email is already attached to the customer record
        // server-side via customer_ref, so omit customer_email here.
        customer_ref: customerRef,
        setup_future_usage: "off_session",
        metadata: {
          intent: "yearly_giving_monthly_enrol",
          lp_member_id: member.id,
          schedule_id: schedule.id,
          cycle_number: "1",
          total_cycles: String(schedulePlan.cycleCount),
          mosque_slug: mosqueSlug,
          giving_id: givingRecord.id,
          split_strategy: strategy,
          customer_email: memberEmail,
        },
      },
    });

    const hostedUrl = result.provider?.hosted_url ?? null;
    if (!hostedUrl) {
      console.error("giving/pay subscription: Mooov returned no hosted_url", {
        payment_id: paymentId,
        schedule_id: schedule.id,
        merchant_id: merchantId,
        state: result.state,
      });
      return NextResponse.json(
        { error: "Payment processor did not return a checkout URL." },
        { status: 502 }
      );
    }

    await supa
      .schema("mooov")
      .from("payment_attempts")
      .update({
        status: result.state,
        provider_ref: result.provider?.provider_ref ?? null,
        metadata: {
          ...initialMetadata,
          hosted_url: hostedUrl,
          flow: "redirect",
          checkout_session_id: result.checkout_session_id ?? null,
        },
      })
      .eq("payment_id", paymentId);

    // Stamp the enrolment payment_id onto instalment #1 so the cycle
    // webhook can find the right child row to mark paid.
    const instalments = await db.getInstalmentsForGiving(givingRecord.id, mosqueId);
    const first = instalments.find((i) => i.sequence === 1);
    if (first) {
      await db.updateInstalment(first.id, mosqueId, {
        payment_reference: paymentId,
      });
    }

    return NextResponse.json({
      url: hostedUrl,
      payment_id: paymentId,
      schedule_id: schedule.id,
      cycles_total: schedulePlan.cycleCount,
      first_cycle_amount: schedulePlan.firstCycleAmount,
      split_strategy: strategy,
    });
  } catch (err) {
    if (err instanceof MooovApiError) {
      console.error("giving/pay subscription: Mooov call failed", {
        payment_id: paymentId,
        schedule_id: schedule.id,
        category: err.category,
        status: err.status,
      });
      await supa
        .schema("mooov")
        .from("payment_attempts")
        .update({ status: "failed", failure_reason: err.category })
        .eq("payment_id", paymentId);
      if (err.category === "merchant_setup_required" && err.setupHint) {
        return NextResponse.json(
          {
            error:
              "This mosque has not finished setting up online payments yet. Please contact the mosque directly.",
            code: "mosque_setup_incomplete",
            setup_url: err.setupHint.setupUrl,
          },
          { status: 503 }
        );
      }
      return NextResponse.json(
        { error: "Could not create subscription session.", code: err.category },
        { status: 502 }
      );
    }
    console.error("giving/pay subscription: unexpected error", err);
    await supa
      .schema("mooov")
      .from("payment_attempts")
      .update({ status: "failed", failure_reason: "unexpected_error" })
      .eq("payment_id", paymentId);
    return NextResponse.json(
      {
        error: "Could not create subscription session.",
        code: "unexpected_error",
      },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// Open-ended Mooov-branded subscription (POST /v1/subscription_checkouts)
// ---------------------------------------------------------------------------
//
// Mooov 2026-06-01 reply: open-ended recurring subscriptions live behind
// /v1/subscription_checkouts and stay fully Mooov-branded — members
// never hit checkout.stripe.com. We pass a stable subscription_id (which
// Mooov stamps on the Stripe Subscription + every invoice) and a
// customer_ref (Mooov resolves/mints the Stripe Customer). Renewals
// fire as subscription.invoice_paid webhooks, dual-emitted alongside
// payment.captured. No cron of ours.
//
// Pre-creates instalment rows for the in-year cycles so /member/giving
// can render the schedule discipleship locally — when subscription
// invoices arrive we mark them paid in sequence. Cycles produced by
// year-rollover (next giving year) won't have pre-created instalments
// yet; the webhook handler tolerates that by writing a fresh row.

async function startOpenEndedSubscription({
  args,
  plan,
}: {
  args: EnrolmentArgs;
  plan: EnrolmentPlan;
}) {
  const { mosqueId, mosqueSlug, givingRecord, memberEmail } = args;
  const {
    merchantId,
    member,
    mosqueYear: currentYear,
    strategy,
    autoRenew,
    cadence,
    customerRef,
    schedule: schedulePlan,
    annualAmount,
    monthlyAmount,
    subscriptionInterval,
    subscriptionIntervalCount,
  } = plan;

  if (
    monthlyAmount == null ||
    subscriptionInterval == null ||
    subscriptionIntervalCount == null
  ) {
    console.error(
      "giving/pay open-ended: subscription cycle params unexpectedly null",
      {
        giving_id: givingRecord.id,
        strategy,
        cadence,
        monthlyAmount,
        subscriptionInterval,
        subscriptionIntervalCount,
      },
    );
    return NextResponse.json(
      {
        error: "Could not work out a per-cycle amount for this plan.",
        code: "cycle_amount_missing",
      },
      { status: 500 },
    );
  }

  const cycleAmountMinor = Math.round(monthlyAmount * 100);
  const currency = (givingRecord.currency ?? "GBP").toUpperCase();

  // Clean any orphan pending schedules from a previous failed attempt
  // (Mooov call 5xx, hosted_url missing, member abandoned redirect)
  // before creating a fresh one. Without this the member portal would
  // render a phantom "Active subscription" card on a giving row whose
  // balance is still outstanding.
  await abandonPendingSchedulesForGiving(mosqueId, givingRecord.id);

  // Mint the schedule first so its UUID can drive the deterministic
  // subscription_id we hand to Mooov. Stripe Subscriptions are
  // idempotent on this id — replays of the same enrolment intent
  // resolve to the same subscription rather than creating duplicates.
  const schedule = await db.createGivingSchedule(mosqueId, {
    member_id: member.id,
    member_giving_id: givingRecord.id,
    member_email: memberEmail,
    customer_ref: customerRef,
    cadence,
    split_strategy: strategy,
    auto_renew: autoRenew,
    status: "pending",
    next_charge_at: schedulePlan.rows[1]?.due_date ?? null,
    metadata: {
      annual_amount: annualAmount,
      cycles_total: schedulePlan.cycleCount,
      year_label: currentYear.label,
      cycle_amount: monthlyAmount,
      cadence,
      subscription_interval: subscriptionInterval,
      subscription_interval_count: subscriptionIntervalCount,
      mooov_flow: "open_ended_subscription",
    },
  });
  const mooovSubscriptionId = `sub_giving_${schedule.id}`;

  // Single rollback path for any failure between mint and Mooov ack.
  // The schedule starts as pending; if the Mooov call, the instalment
  // pre-creation, or the subscription_id stamp throws, we mark the
  // schedule cancelled + delete instalments so the member portal
  // doesn't show a phantom "Active subscription" card.
  const rollback = async (
    failureCode: string,
    actor: string,
  ): Promise<void> => {
    await db
      .deleteInstalmentsForSchedule(schedule.id, mosqueId)
      .catch(() => undefined);
    await db
      .updateGivingSchedule(schedule.id, mosqueId, {
        status: "cancelled",
        cancelled_at: new Date().toISOString(),
        cancelled_by_actor: actor,
        last_failure_code: failureCode,
        last_failure_at: new Date().toISOString(),
      })
      .catch(() => undefined);
  };

  const idempotencyKey = `lp:giving:sub:${schedule.id}`;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const mosqueQuery =
    mosqueSlug === getDefaultMosqueSlug() ? "" : `&mosque=${encodeURIComponent(mosqueSlug)}`;
  const successUrl = `${siteUrl}/events/rsvp/success?subscription_id=${encodeURIComponent(
    mooovSubscriptionId,
  )}&type=giving_subscription${mosqueQuery}`;
  const cancelUrl = `${siteUrl}/giving/${givingRecord.id}?email=${encodeURIComponent(
    memberEmail,
  )}${mosqueQuery ? `&mosque=${encodeURIComponent(mosqueSlug)}` : ""}`;
  const cadenceLabel = cadence === "quarterly" ? "quarter" : "month";
  const description = `Mosque giving — £${monthlyAmount.toFixed(2)} / ${cadenceLabel} (${currentYear.label})`;

  // Metadata gets stamped on the Stripe Subscription AND every invoice
  // by Mooov, so our webhook can route subscription.invoice_paid back
  // to the LP schedule even if the subscription_id ever diverged.
  const subscriptionMetadata: Record<string, string> = {
    intent: "giving_open_ended_subscription",
    lp_schedule_id: schedule.id,
    lp_giving_id: givingRecord.id,
    lp_member_id: member.id,
    lp_mosque_id: mosqueId,
    lp_mosque_slug: mosqueSlug,
    split_strategy: strategy,
    giving_year_label: currentYear.label,
    customer_email: memberEmail,
  };

  try {
    // Stamp the subscription_id we'll pass to Mooov onto the schedule
    // so the activation webhook can resolve back to this row.
    await db.updateGivingSchedule(schedule.id, mosqueId, {
      mooov_subscription_id: mooovSubscriptionId,
    });

    // Pre-create in-year instalment rows for the LP-side schedule view.
    // The webhook marks them paid in sequence as subscription.invoice_paid
    // events arrive. Open-ended cycles past year-end will be created
    // ad-hoc by the webhook handler.
    await db.createMemberGivingInstalments(
      mosqueId,
      schedulePlan.rows.map((row) => ({
        member_giving_id: givingRecord.id,
        sequence: row.sequence,
        due_date: row.due_date,
        amount: row.amount,
        currency: givingRecord.currency,
        status: "outstanding",
        paid_at: null,
        reminder_sent_at: null,
        payment_reference: null,
        schedule_id: schedule.id,
      })),
    );

    const result = await callMooovConnect<{
      subscription_id: string;
      status: string;
      hosted_url?: string;
      checkout_session_id?: string;
    }>("POST", "/v1/subscription_checkouts", {
      merchant: merchantId,
      idempotencyKey,
      body: {
        subscription_id: mooovSubscriptionId,
        customer_ref: customerRef,
        amount: cycleAmountMinor,
        currency,
        interval: subscriptionInterval,
        interval_count: subscriptionIntervalCount,
        success_url: successUrl,
        cancel_url: cancelUrl,
        description,
        metadata: subscriptionMetadata,
        merchant_id: merchantId,
      },
    });

    const hostedUrl = result.hosted_url ?? null;
    if (!hostedUrl) {
      console.error("giving/pay open-ended: Mooov returned no hosted_url", {
        subscription_id: mooovSubscriptionId,
        schedule_id: schedule.id,
        merchant_id: merchantId,
        status: result.status,
      });
      await rollback("no_hosted_url", "system_enrolment_no_hosted_url");
      return NextResponse.json(
        { error: "Payment processor did not return a checkout URL." },
        { status: 502 },
      );
    }

    return NextResponse.json({
      url: hostedUrl,
      subscription_id: mooovSubscriptionId,
      schedule_id: schedule.id,
      cycles_total: schedulePlan.cycleCount,
      monthly_amount: monthlyAmount,
      cycle_amount: monthlyAmount,
      cadence,
      split_strategy: strategy,
      mooov_flow: "open_ended_subscription",
      checkout_session_id: result.checkout_session_id ?? null,
    });
  } catch (err) {
    if (err instanceof MooovApiError) {
      console.error("giving/pay open-ended: Mooov call failed", {
        subscription_id: mooovSubscriptionId,
        schedule_id: schedule.id,
        category: err.category,
        status: err.status,
      });
      // Roll the schedule back so the member can retry cleanly. We
      // don't have a payment_attempts row to flag here (Mooov manages
      // those server-side for the subscription path).
      await rollback(err.category, "system_enrolment_failure");
      if (err.category === "merchant_setup_required" && err.setupHint) {
        return NextResponse.json(
          {
            error:
              "This mosque has not finished setting up online payments yet. Please contact the mosque directly.",
            code: "mosque_setup_incomplete",
            setup_url: err.setupHint.setupUrl,
          },
          { status: 503 },
        );
      }
      return NextResponse.json(
        { error: "Could not create subscription session.", code: err.category },
        { status: 502 },
      );
    }
    console.error("giving/pay open-ended: unexpected error", {
      schedule_id: schedule.id,
      ...describeError(err),
    });
    await rollback("unexpected_error", "system_enrolment_failure");
    return NextResponse.json(
      {
        error: "Could not create subscription session.",
        code: "unexpected_error",
      },
      { status: 500 },
    );
  }
}
