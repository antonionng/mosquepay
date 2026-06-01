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
import { getDefaultLodgeSlug } from "@/lib/tenant";
import { createServiceClient } from "@/lib/supabase/server";
import { callMooovConnect, MooovApiError } from "@/lib/mooov";
import { duesSubscriptionEnabled } from "@/lib/dues/feature-flags";
import {
  computeEnrolmentPlan,
  type EnrolmentPlan,
} from "@/lib/dues/enrolment-plan";
import type { DuesSplitStrategy, MemberDues } from "@/lib/db/types";

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
    const body = await request.json();
    const { dues_id, member_email, member_name, mode } = body;

    if (!dues_id || !member_email) {
      return NextResponse.json(
        { error: "dues_id and member_email are required." },
        { status: 400 }
      );
    }

    // Resolve tenant from the dues row itself, not from URL/host/cookie.
    //
    // Why: a member of lodge A signed in on lodge B's host (or on the bare
    // lodgepayments.co.uk host) used to land on this route with a
    // URL-derived lodge_id that didn't match the dues row's lodge_id, so
    // the getMemberDues(lodgeId, { memberEmail }) filter returned an empty
    // list and we surfaced "Dues record not found." even though the row
    // existed and the email matched. The dues_id UUID is unguessable, so
    // we treat (dues_id, member_email) as the authorization tuple and
    // derive lodgeId from the dues row.
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

    const { data: duesRecordRaw, error: duesErr } = await supa
      .from("member_dues")
      .select("*")
      .eq("id", dues_id)
      .maybeSingle();
    if (duesErr) {
      console.error("dues/pay: dues lookup failed", {
        dues_id,
        message: duesErr.message,
      });
      return NextResponse.json(
        { error: "Could not look up dues record." },
        { status: 500 }
      );
    }
    if (!duesRecordRaw) {
      return NextResponse.json(
        { error: "Dues record not found." },
        { status: 404 }
      );
    }
    const duesRecord = duesRecordRaw as MemberDues;

    if (
      (duesRecord.member_email ?? "").trim().toLowerCase() !==
      String(member_email).trim().toLowerCase()
    ) {
      // Email didn't match the dues row -- treat as not found rather than
      // 403 to avoid leaking dues_id existence to a different member.
      return NextResponse.json(
        { error: "Dues record not found." },
        { status: 404 }
      );
    }
    if (duesRecord.status === "paid") {
      return NextResponse.json({ error: "Dues already paid." }, { status: 400 });
    }

    const lodgeId = duesRecord.lodge_id;
    const { data: lodgeRow } = await supa
      .from("lodges")
      .select("slug")
      .eq("id", lodgeId)
      .maybeSingle<{ slug: string | null }>();
    const lodgeSlug = lodgeRow?.slug ?? getDefaultLodgeSlug();

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

  // Compute the full plan first. Same helper backs the
  // /api/dues/subscription-preview endpoint so the dialog the member
  // confirms cannot disagree with what we actually charge.
  const planResult = await computeEnrolmentPlan({
    lodgeId,
    duesRecord,
    memberEmail,
    strategy: args.strategy,
    autoRenew: args.autoRenew,
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
    masonicYear: currentYear,
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
    console.error("dues/pay subscription: supabase service client unavailable", {
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

  // Mint the schedule + instalment rows BEFORE talking to Mooov so the
  // webhook (which fires after the member completes hosted Checkout)
  // has somewhere to write the saved PM. Status=pending until the
  // enrolment intent succeeds.
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
      mooov_flow: "saved_charge_fixed_term",
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
        // Mooov expands customer_ref into a Stripe `customer` on the
        // connected account. Stripe then rejects the request if a
        // bare customer_email is also present ("You may only specify
        // one of these parameters: customer, customer_email."). The
        // member's email is already attached to the customer record
        // server-side via customer_ref, so omit customer_email here.
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
          customer_email: memberEmail,
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
// Pre-creates instalment rows for the in-year cycles so /member/dues
// can render the schedule progression locally — when subscription
// invoices arrive we mark them paid in sequence. Cycles produced by
// year-rollover (next masonic year) won't have pre-created instalments
// yet; the webhook handler tolerates that by writing a fresh row.

async function startOpenEndedSubscription({
  args,
  plan,
}: {
  args: EnrolmentArgs;
  plan: EnrolmentPlan;
}) {
  const { lodgeId, lodgeSlug, duesRecord, memberEmail } = args;
  const {
    merchantId,
    member,
    masonicYear: currentYear,
    strategy,
    autoRenew,
    customerRef,
    schedule: schedulePlan,
    annualAmount,
    monthlyAmount,
  } = plan;

  if (monthlyAmount == null) {
    console.error(
      "dues/pay open-ended: plan.monthlyAmount unexpectedly null",
      { dues_id: duesRecord.id, strategy },
    );
    return NextResponse.json(
      {
        error: "Could not work out a monthly amount for this plan.",
        code: "monthly_amount_missing",
      },
      { status: 500 },
    );
  }

  const monthlyMinor = Math.round(monthlyAmount * 100);
  const currency = (duesRecord.currency ?? "GBP").toUpperCase();

  // Mint the schedule first so its UUID can drive the deterministic
  // subscription_id we hand to Mooov. Stripe Subscriptions are
  // idempotent on this id — replays of the same enrolment intent
  // resolve to the same subscription rather than creating duplicates.
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
      monthly_amount: monthlyAmount,
      mooov_flow: "open_ended_subscription",
    },
  });
  const mooovSubscriptionId = `sub_dues_${schedule.id}`;
  await db.updateDuesSchedule(schedule.id, lodgeId, {
    mooov_subscription_id: mooovSubscriptionId,
  });

  // Pre-create in-year instalment rows for the LP-side schedule view.
  // The webhook marks them paid in sequence as subscription.invoice_paid
  // events arrive. Open-ended cycles past year-end will be created
  // ad-hoc by the webhook handler.
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
    })),
  );

  const idempotencyKey = `lp:dues:sub:${schedule.id}`;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const lodgeQuery =
    lodgeSlug === getDefaultLodgeSlug() ? "" : `&lodge=${encodeURIComponent(lodgeSlug)}`;
  const successUrl = `${siteUrl}/events/rsvp/success?subscription_id=${encodeURIComponent(
    mooovSubscriptionId,
  )}&type=dues_subscription${lodgeQuery}`;
  const cancelUrl = `${siteUrl}/dues/${duesRecord.id}?email=${encodeURIComponent(
    memberEmail,
  )}${lodgeQuery ? `&lodge=${encodeURIComponent(lodgeSlug)}` : ""}`;
  const description = `Lodge dues — £${monthlyAmount.toFixed(2)} / month (${currentYear.label})`;

  // Metadata gets stamped on the Stripe Subscription AND every invoice
  // by Mooov, so our webhook can route subscription.invoice_paid back
  // to the LP schedule even if the subscription_id ever diverged.
  const subscriptionMetadata: Record<string, string> = {
    intent: "dues_open_ended_subscription",
    lp_schedule_id: schedule.id,
    lp_dues_id: duesRecord.id,
    lp_member_id: member.id,
    lp_lodge_id: lodgeId,
    lp_lodge_slug: lodgeSlug,
    split_strategy: strategy,
    masonic_year_label: currentYear.label,
    customer_email: memberEmail,
  };

  try {
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
        amount: monthlyMinor,
        currency,
        interval: "month",
        interval_count: 1,
        success_url: successUrl,
        cancel_url: cancelUrl,
        description,
        metadata: subscriptionMetadata,
        merchant_id: merchantId,
      },
    });

    const hostedUrl = result.hosted_url ?? null;
    if (!hostedUrl) {
      console.error("dues/pay open-ended: Mooov returned no hosted_url", {
        subscription_id: mooovSubscriptionId,
        schedule_id: schedule.id,
        merchant_id: merchantId,
        status: result.status,
      });
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
      split_strategy: strategy,
      mooov_flow: "open_ended_subscription",
      checkout_session_id: result.checkout_session_id ?? null,
    });
  } catch (err) {
    if (err instanceof MooovApiError) {
      console.error("dues/pay open-ended: Mooov call failed", {
        subscription_id: mooovSubscriptionId,
        schedule_id: schedule.id,
        category: err.category,
        status: err.status,
      });
      // Roll the schedule back so the member can retry cleanly. We
      // don't have a payment_attempts row to flag here (Mooov manages
      // those server-side for the subscription path).
      await db
        .updateDuesSchedule(schedule.id, lodgeId, {
          status: "cancelled",
          cancelled_at: new Date().toISOString(),
          cancelled_by_actor: "system_enrolment_failure",
          last_failure_code: err.category,
          last_failure_at: new Date().toISOString(),
        })
        .catch((rbErr) => {
          console.error(
            "dues/pay open-ended: rollback updateDuesSchedule failed",
            {
              schedule_id: schedule.id,
              message: rbErr instanceof Error ? rbErr.message : String(rbErr),
            },
          );
        });
      if (err.category === "merchant_setup_required" && err.setupHint) {
        return NextResponse.json(
          {
            error:
              "This lodge has not finished setting up online payments yet. Please contact the lodge directly.",
            code: "lodge_setup_incomplete",
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
    console.error("dues/pay open-ended: unexpected error", err);
    await db
      .updateDuesSchedule(schedule.id, lodgeId, {
        status: "cancelled",
        cancelled_at: new Date().toISOString(),
        cancelled_by_actor: "system_enrolment_failure",
        last_failure_code: "unexpected_error",
        last_failure_at: new Date().toISOString(),
      })
      .catch(() => undefined);
    return NextResponse.json(
      {
        error: "Could not create subscription session.",
        code: "unexpected_error",
      },
      { status: 500 },
    );
  }
}
