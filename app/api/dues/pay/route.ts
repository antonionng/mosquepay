// POST /api/dues/pay
//
// Member-side dues payment. Two callers today:
//   * app/(member)/member/dues/page.tsx       (member portal)
//   * app/dues/[duesId]/dues-pay-client.tsx   (public email link)
//
// Payment surface: 100% Mooov (Mooov Connect -> hosted Stripe Checkout on
// the lodge's connected PSP). No direct Stripe SDK, no fallback. The lodge's
// merchant must be active in mooov.lodges; otherwise we return 503.
//
// One-off vs subscription:
//   * mode = "one_off" (default): single hosted Checkout charge against
//     /v1/payment_intents.
//   * mode = "subscription": saved-charge interim. Mints an enrolment
//     intent against /v1/payment_intents with setup_future_usage="off_session"
//     plus customer_ref, captures month 1, saves the cardholder PM. The
//     daily cron in lib/jobs/queue.ts then drives subsequent cycles via
//     /v1/charges/saved (lib/mooov-charges.ts::runSavedDuesCharge).
//     Mooov spec: 2026-05-28 reply, tasks L1.1 + L1.3.
import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import * as db from "@/lib/db";
import { getDefaultLodgeSlug, getLodgeSlugFromRequest } from "@/lib/tenant";
import { createServiceClient } from "@/lib/supabase/server";
import { callMooovConnect, MooovApiError } from "@/lib/mooov";
import { computeYearPosition } from "@/lib/dues/year-position";
import { buildSchedule, isStrategyEnabledForLodge } from "@/lib/dues/strategies";
import { duesSubscriptionEnabled } from "@/lib/dues/feature-flags";
import type { DuesSplitStrategy } from "@/lib/db/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function loadMooovMerchant(
  supa: ReturnType<typeof createServiceClient>,
  lodgeId: string,
): Promise<string | null> {
  const { data, error } = await supa
    .schema("mooov")
    .from("lodges")
    .select("merchant_id, status")
    .eq("id", lodgeId)
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
    const lodgeSlug = getLodgeSlugFromRequest(request);
    const lodgeId = await db.resolveLodgeId(lodgeSlug);
    if (!lodgeId) {
      return NextResponse.json({ error: "Lodge not found." }, { status: 404 });
    }

    const body = await request.json();
    const { dues_id, member_email, member_name, mode } = body;

    if (!dues_id || !member_email) {
      return NextResponse.json(
        { error: "dues_id and member_email are required." },
        { status: 400 }
      );
    }

    const allDues = await db.getMemberDues(lodgeId, { memberEmail: member_email });
    const duesRecord = allDues.find((d) => d.id === dues_id);
    if (!duesRecord) {
      return NextResponse.json({ error: "Dues record not found." }, { status: 404 });
    }
    if (duesRecord.status === "paid") {
      return NextResponse.json({ error: "Dues already paid." }, { status: 400 });
    }

    if (mode === "subscription") {
      // Feature-gated until Mooov's saved-charge subscription contract
      // ships to prod (planned 5 Jun 2026). The contract requires fields
      // that aren't on Mooov prod yet (data.payment_method_id +
      // data.stripe_customer_id on payment.captured/succeeded for any
      // payment created with customer_ref). Flipping
      // LODGEPAY_DUES_SUBSCRIPTION_ENABLED=true on the deployment scope
      // unlocks this path on or after the cutover.
      if (!duesSubscriptionEnabled()) {
        return NextResponse.json(
          {
            error:
              "Monthly instalments are coming soon. Please pay in full or contact your lodge secretary.",
            code: "subscription_not_enabled",
          },
          { status: 503 }
        );
      }
      // Saved-charge interim path. We mint a Mooov enrolment intent that
      // collects month 1 AND saves the cardholder PM (setup_future_usage),
      // pre-create the dues_schedules row + member_dues_instalments rows
      // for the chosen split strategy, and hand off to Mooov hosted
      // Checkout. The cycle webhook (mooov-webhooks/connect) populates
      // dues_schedules.mooov_payment_method_id + stripe_customer_id when
      // payment.succeeded fires for the enrolment payment_id.
      return await startDuesSubscriptionEnrolment({
        lodgeId,
        lodgeSlug,
        duesRecord,
        memberEmail: member_email,
        memberName: member_name,
        strategy: body.split_strategy as DuesSplitStrategy | undefined,
        autoRenew: typeof body.auto_renew === "boolean" ? body.auto_renew : undefined,
      });
    }

    let supa: ReturnType<typeof createServiceClient>;
    try {
      supa = createServiceClient();
    } catch (err) {
      console.error("dues/pay: supabase service client unavailable", {
        message: err instanceof Error ? err.message : String(err),
      });
      return NextResponse.json(
        { error: "Payments are not configured." },
        { status: 503 }
      );
    }

    let merchantId: string | null;
    try {
      merchantId = await loadMooovMerchant(supa, lodgeId);
    } catch (err) {
      console.error("dues/pay: mooov merchant lookup failed", {
        lodge_id: lodgeId,
        message: err instanceof Error ? err.message : String(err),
      });
      return NextResponse.json(
        { error: "Could not look up payment processor for this lodge." },
        { status: 500 }
      );
    }
    if (!merchantId) {
      return NextResponse.json(
        {
          error:
            "This lodge has not finished setting up online payments yet. Please contact the lodge directly.",
          code: "lodge_not_connected",
        },
        { status: 503 }
      );
    }

    const totalMinor = Math.round(duesRecord.amount * 100);
    const currency = (duesRecord.currency ?? "GBP").toUpperCase();
    const paymentId = `dues_${lodgeId}_${duesRecord.id}_${Date.now().toString(36)}`;
    const idempotencyKey = `dues_${duesRecord.id}_${Date.now().toString(36)}`;
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
    const lodgeQuery =
      lodgeSlug === getDefaultLodgeSlug() ? "" : `&lodge=${encodeURIComponent(lodgeSlug)}`;
    const successUrl = `${siteUrl}/events/rsvp/success?payment_id=${encodeURIComponent(
      paymentId
    )}&type=dues${lodgeQuery}`;
    const cancelUrl = `${siteUrl}/dues/${duesRecord.id}?email=${encodeURIComponent(
      member_email
    )}${lodgeQuery ? `&lodge=${encodeURIComponent(lodgeSlug)}` : ""}`;
    const description = `Lodge Dues: ${duesRecord.period_start} to ${duesRecord.period_end}`;

    const guestDescriptor: Record<string, unknown> = {
      source: "member_dues",
      dues_id: duesRecord.id,
      lodge_slug: lodgeSlug,
      donor_email: member_email,
      donor_name: member_name ?? duesRecord.member_name ?? null,
      charitable_amount: duesRecord.charitable_amount ?? 0,
    };
    const initialMetadata: Record<string, unknown> = {
      source: "lodgepay_dues_pay",
      lodge_slug: lodgeSlug,
      lodge_id: lodgeId,
      intent: "dues",
      dues_id: duesRecord.id,
    };

    const { error: insertError } = await supa
      .schema("mooov")
      .from("payment_attempts")
      .insert({
        payment_id: paymentId,
        lodge_id: lodgeId,
        member_id: null,
        amount: totalMinor,
        currency,
        intent: "dues",
        status: "pending",
        idempotency_key: idempotencyKey,
        metadata: initialMetadata,
        guest_descriptor: guestDescriptor,
      });
    if (insertError) {
      console.error("dues/pay: preflight insert failed", {
        lodge_id: lodgeId,
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
            intent: "dues",
            lodge_id: lodgeId,
            lodge_slug: lodgeSlug,
            dues_id: duesRecord.id,
          },
        },
      });

      const hostedUrl = result.provider?.hosted_url ?? null;
      if (!hostedUrl) {
        console.error("dues/pay: Mooov returned no hosted_url", {
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
        console.error("dues/pay: Mooov call failed", {
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
                "This lodge has not finished setting up online payments yet. Please contact the lodge directly.",
              code: "lodge_setup_incomplete",
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
      console.error("dues/pay: unexpected error", err);
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
    console.error("Dues pay error:", e);
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
  lodgeId: string;
  lodgeSlug: string;
  duesRecord: Awaited<ReturnType<typeof db.getMemberDues>>[number];
  memberEmail: string;
  memberName: string | null | undefined;
  strategy: DuesSplitStrategy | undefined;
  autoRenew: boolean | undefined;
};

async function startDuesSubscriptionEnrolment(args: EnrolmentArgs) {
  const { lodgeId, lodgeSlug, duesRecord, memberEmail } = args;

  let supa: ReturnType<typeof createServiceClient>;
  try {
    supa = createServiceClient();
  } catch (err) {
    console.error("dues/pay subscription: supabase service client unavailable", {
      message: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: "Payments are not configured." },
      { status: 503 }
    );
  }

  // Resolve merchant. Same lookup as the one-off path.
  const { data: merchantRow, error: merchantErr } = await supa
    .schema("mooov")
    .from("lodges")
    .select("merchant_id, status")
    .eq("id", lodgeId)
    .maybeSingle<{ merchant_id: string; status: string }>();
  if (merchantErr) {
    console.error("dues/pay subscription: merchant lookup failed", {
      lodge_id: lodgeId,
      message: merchantErr.message,
    });
    return NextResponse.json(
      { error: "Could not look up payment processor for this lodge." },
      { status: 500 }
    );
  }
  if (
    !merchantRow ||
    !merchantRow.merchant_id ||
    (merchantRow.status && merchantRow.status !== "active")
  ) {
    return NextResponse.json(
      {
        error:
          "This lodge has not finished setting up online payments yet. Please contact the lodge directly.",
        code: "lodge_not_connected",
      },
      { status: 503 }
    );
  }
  const merchantId = merchantRow.merchant_id;

  // Resolve member identity for the customer_ref. customer_ref is the
  // stable LP -> Mooov key that lets the saved-charge cron find the
  // right Stripe Customer + PaymentMethod on Mooov's side. Shape locked
  // with Mooov 2026-05-28: `mbr_<uuid>`, never recycled.
  const member =
    duesRecord.member_id != null
      ? await db
          .getMemberByEmail(lodgeId, memberEmail)
          .catch(() => null)
      : await db.getMemberByEmail(lodgeId, memberEmail).catch(() => null);
  if (!member) {
    return NextResponse.json(
      {
        error:
          "Could not resolve your member profile. Please contact your lodge secretary.",
        code: "member_not_found",
      },
      { status: 404 }
    );
  }
  const customerRef = `mbr_${member.id}`;

  // Resolve the lodge dues template (per-lodge subscription policy).
  const lodgeDuesList = await db.getLodgeDues(lodgeId);
  const duesTemplate = lodgeDuesList[0] ?? null;
  if (!duesTemplate || duesTemplate.allow_instalments !== true) {
    return NextResponse.json(
      {
        error:
          "Monthly subscriptions are not enabled for this lodge.",
        code: "instalments_not_enabled",
      },
      { status: 409 }
    );
  }

  // Resolve year position to choose a sensible default split strategy
  // when the caller did not pass one. v1 defaults: even_full_year
  // (pre-year / at-start), pro_rata (mid-year new initiate),
  // reslice_remaining (mid-year existing behind). Catch-up lump and
  // balloon strategies are opt-in via explicit body.split_strategy.
  const currentYear = await db.getCurrentMasonicYear(lodgeId);
  if (!currentYear) {
    return NextResponse.json(
      {
        error:
          "Your lodge has not configured a masonic year yet. Please contact your lodge secretary.",
        code: "no_masonic_year",
      },
      { status: 409 }
    );
  }
  const memberDuesList = await db.getMemberDues(lodgeId, { memberEmail });
  const paidThisYear = memberDuesList.some(
    (d) =>
      !d.is_advance &&
      d.status === "paid" &&
      d.period_start.slice(0, 10) <= currentYear.end_date.slice(0, 10) &&
      d.period_end.slice(0, 10) >= currentYear.start_date.slice(0, 10)
  );

  const yearPosition = computeYearPosition({
    yearStartDate: currentYear.start_date,
    yearEndDate: currentYear.end_date,
    dateOfInitiation: member.date_of_initiation ?? null,
    hasPaidCurrentYear: paidThisYear,
    hasOutstandingCurrentYear: !paidThisYear,
  });

  const defaultStrategy: DuesSplitStrategy =
    yearPosition.quadrant === "pre_year" ||
    yearPosition.quadrant === "at_year_start"
      ? "even_full_year"
      : yearPosition.quadrant === "mid_year_new_initiate"
        ? "pro_rata"
        : "reslice_remaining";

  let strategy: DuesSplitStrategy = args.strategy ?? defaultStrategy;
  if (!isStrategyEnabledForLodge(strategy, duesTemplate)) {
    strategy = defaultStrategy;
  }
  if (
    strategy === "catch_up_lump_then_monthly" &&
    yearPosition.monthsElapsed > duesTemplate.catch_up_max_months
  ) {
    return NextResponse.json(
      {
        error: `You're more than ${duesTemplate.catch_up_max_months} months into the year. Please speak to your treasurer to set up a tailored payment plan.`,
        code: "catch_up_exceeds_cap",
      },
      { status: 409 }
    );
  }

  const annualAmount = duesRecord.full_year_amount ?? duesRecord.amount;
  const today = new Date().toISOString().slice(0, 10);
  const schedulePlan = buildSchedule({
    annualAmount,
    today,
    yearStartDate: currentYear.start_date,
    yearEndDate: currentYear.end_date,
    monthsElapsed: yearPosition.monthsElapsed,
    monthsRemaining: yearPosition.monthsRemaining,
    monthsTotal: yearPosition.monthsTotal,
    strategy,
  });

  if (schedulePlan.cycleCount === 0 || schedulePlan.firstCycleAmount <= 0) {
    return NextResponse.json(
      {
        error:
          "Could not work out a payment schedule for the current year. Please contact your lodge secretary.",
        code: "schedule_build_failed",
      },
      { status: 500 }
    );
  }

  // Mint the schedule + instalment rows BEFORE talking to Mooov so the
  // webhook (which fires after the member completes hosted Checkout)
  // has somewhere to write the saved PM. Status=pending until the
  // enrolment intent succeeds.
  const autoRenew =
    args.autoRenew === undefined
      ? duesTemplate.auto_renew_default
      : args.autoRenew;

  const schedule = await db.createDuesSchedule(lodgeId, {
    member_id: member.id,
    member_dues_id: duesRecord.id,
    member_email: memberEmail,
    customer_ref: customerRef,
    cadence: "monthly",
    split_strategy: strategy,
    auto_renew: autoRenew,
    status: "pending",
    next_charge_at: schedulePlan.rows[1]?.due_date ?? null,
    metadata: {
      annual_amount: annualAmount,
      cycles_total: schedulePlan.cycleCount,
      year_label: currentYear.label,
    },
  });

  await db.createMemberDuesInstalments(
    lodgeId,
    schedulePlan.rows.map((row) => ({
      member_dues_id: duesRecord.id,
      sequence: row.sequence,
      due_date: row.due_date,
      amount: row.amount,
      currency: duesRecord.currency,
      status: "outstanding",
      paid_at: null,
      reminder_sent_at: null,
      payment_reference: null,
      schedule_id: schedule.id,
    }))
  );

  // Mint the Mooov enrolment intent. payment_id format follows Mooov's
  // L1.1 sample: pay_dues_<schedule_id>_001 makes the cycle pattern
  // obvious in their payments dashboard. We persist a payment_attempts
  // row ourselves so the existing webhook handler's intent switch can
  // route to the dues-subscription branch.
  const firstCycleMinor = Math.round(schedulePlan.firstCycleAmount * 100);
  const currency = (duesRecord.currency ?? "GBP").toUpperCase();
  const paymentId = `pay_dues_${schedule.id}_001`;
  const idempotencyKey = `lp:dues:enrol:${schedule.id}`;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const lodgeQuery =
    lodgeSlug === getDefaultLodgeSlug() ? "" : `&lodge=${encodeURIComponent(lodgeSlug)}`;
  const successUrl = `${siteUrl}/events/rsvp/success?payment_id=${encodeURIComponent(
    paymentId
  )}&type=dues_subscription${lodgeQuery}`;
  const cancelUrl = `${siteUrl}/dues/${duesRecord.id}?email=${encodeURIComponent(
    memberEmail
  )}${lodgeQuery ? `&lodge=${encodeURIComponent(lodgeSlug)}` : ""}`;
  const description = `Lodge Dues subscription — month 1 of ${schedulePlan.cycleCount}`;

  const guestDescriptor: Record<string, unknown> = {
    source: "member_dues_subscription_enrol",
    dues_id: duesRecord.id,
    schedule_id: schedule.id,
    customer_ref: customerRef,
    member_id: member.id,
    lodge_slug: lodgeSlug,
    donor_email: memberEmail,
    donor_name: args.memberName ?? duesRecord.member_name ?? null,
    cycles_total: schedulePlan.cycleCount,
    cycle_number: 1,
    split_strategy: strategy,
    charitable_amount: 0, // charitable portion attributed per cycle on capture
  };

  const initialMetadata: Record<string, unknown> = {
    source: "lodgepay_dues_subscription_enrol",
    lodge_slug: lodgeSlug,
    lodge_id: lodgeId,
    intent: "dues_subscription_enrol",
    dues_id: duesRecord.id,
    schedule_id: schedule.id,
    customer_ref: customerRef,
    cycles_total: schedulePlan.cycleCount,
  };

  const { error: insertError } = await supa
    .schema("mooov")
    .from("payment_attempts")
    .insert({
      payment_id: paymentId,
      lodge_id: lodgeId,
      member_id: null,
      amount: firstCycleMinor,
      currency,
      intent: "dues_subscription_enrol",
      status: "pending",
      idempotency_key: idempotencyKey,
      metadata: initialMetadata,
      guest_descriptor: guestDescriptor,
    });
  if (insertError) {
    console.error("dues/pay subscription: preflight insert failed", {
      lodge_id: lodgeId,
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
        customer_email: memberEmail,
        customer_ref: customerRef,
        setup_future_usage: "off_session",
        metadata: {
          intent: "yearly_dues_monthly_enrol",
          lp_member_id: member.id,
          schedule_id: schedule.id,
          cycle_number: "1",
          total_cycles: String(schedulePlan.cycleCount),
          lodge_slug: lodgeSlug,
          dues_id: duesRecord.id,
          split_strategy: strategy,
        },
      },
    });

    const hostedUrl = result.provider?.hosted_url ?? null;
    if (!hostedUrl) {
      console.error("dues/pay subscription: Mooov returned no hosted_url", {
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
    const instalments = await db.getInstalmentsForDues(duesRecord.id, lodgeId);
    const first = instalments.find((i) => i.sequence === 1);
    if (first) {
      await db.updateInstalment(first.id, lodgeId, {
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
      console.error("dues/pay subscription: Mooov call failed", {
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
              "This lodge has not finished setting up online payments yet. Please contact the lodge directly.",
            code: "lodge_setup_incomplete",
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
    console.error("dues/pay subscription: unexpected error", err);
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
