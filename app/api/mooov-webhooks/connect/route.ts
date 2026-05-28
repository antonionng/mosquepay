import { type NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { verifyMooovWebhook } from "@/lib/mooov";
import * as db from "@/lib/db";
import { sendGuestWelcomeEmail } from "@/lib/email/guest";
import { projectTakePaymentCaptured } from "@/lib/take-payment/project-captured";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type MooovConnectEvent = {
  id: string;
  type: string;
  created: string;
  merchant: {
    id: string;
    entity_id?: string;
  };
  data?: {
    payment_id?: string;
    amount?: number;
    currency?: string;
    // Mooov gateway-prod-00027-mn5+ (2026-05-22) populates these three
    // fields on payment.failed. failure_reason is the human Stripe
    // message, failure_code is the stable enum to switch on
    // (e.g. "account_invalid", "checkout_abandoned"), failure_category
    // is the bucket (provider | fraud | validation | ...).
    // Absent on success events to keep the happy-path payload tight.
    failure_reason?: string;
    failure_code?: string;
    failure_category?: string;
    // Mooov 2026-05-28 reply, Q-A: stamped on payment.succeeded /
    // payment.failed for any payment created with customer_ref. Used by
    // the dues subscription enrolment projector to seed
    // dues_schedules.mooov_payment_method_id + stripe_customer_id once.
    payment_method_id?: string;
    stripe_customer_id?: string;
    customer_ref?: string;
    // Mooov 2026-05-28 post-lock: Slice 3a fields. Present on
    // subscription.* events (subscription.activated, .updated,
    // .canceled, .invoice_paid, .invoice_failed). subscription_metadata
    // carries LP correlation IDs (lp_schedule_id, lp_member_dues_id)
    // verbatim from the Stripe Subscription object's metadata. Fields
    // are omitted entirely (not null) when unpopulated.
    subscription_id?: string;
    stripe_subscription_id?: string;
    subscription_status?: string;
    period_start?: string;
    period_end?: string;
    cancel_at?: string;
    canceled_at?: string;
    subscription_metadata?: Record<string, unknown>;
    [key: string]: unknown;
  };
};

function firstNonEmptyEnv(...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  return undefined;
}

async function findLodgeIdForMerchant(
  supa: ReturnType<typeof createServiceClient>,
  merchantId: string
): Promise<string | null> {
  const { data, error } = await supa
    .schema("mooov")
    .from("lodges")
    .select("id")
    .eq("merchant_id", merchantId)
    .maybeSingle<{ id: string }>();
  if (error) throw error;
  if (data?.id) return data.id;

  const demoMerchant =
    process.env.MOOOV_DEMO_MERCHANT_ID ??
    process.env.MOOOV_DEMO_LODGE_ID ??
    process.env.MOOOV_LODGE_PILOT_MERCHANT_ID;
  if (merchantId !== demoMerchant) return null;

  const demoLodgeId = process.env.MOOOV_DEMO_LODGE_ID ?? "merch_lodgepay_demo";
  const { error: upsertError } = await supa.schema("mooov").from("lodges").upsert(
    {
      id: demoLodgeId,
      merchant_id: merchantId,
      display_name: "LodgePay demo merchant",
      currency: "GBP",
      status: "active",
      metadata: { source: "mooov_connect_staging_webhook" },
    },
    { onConflict: "id" }
  );
  if (upsertError) throw upsertError;
  return demoLodgeId;
}

export async function POST(request: NextRequest) {
  const raw = await request.text();
  const signature = request.headers.get("x-mooov-signature");
  const deliveryId = request.headers.get("x-mooov-delivery") ?? "";
  const webhookSecret = firstNonEmptyEnv(
    "MOOOV_PLATFORM_WEBHOOK_SIGNING_SECRET",
    "MOOOV_WEBHOOK_SIGNING_SECRET",
    "MOOOV_WEBHOOK_SECRET",
    "MOOOV_PLATFORM_WEBHOOK_SECRET"
  );

  if (!signature) {
    return NextResponse.json(
      { error: "Missing X-Mooov-Signature header." },
      { status: 400 }
    );
  }
  if (!webhookSecret) {
    console.error("Mooov webhook signing secret env var not configured", {
      tried_vars: [
        "MOOOV_PLATFORM_WEBHOOK_SIGNING_SECRET",
        "MOOOV_WEBHOOK_SIGNING_SECRET",
        "MOOOV_WEBHOOK_SECRET",
        "MOOOV_PLATFORM_WEBHOOK_SECRET",
      ],
    });
    return NextResponse.json(
      { error: "Webhook signing secret not configured." },
      { status: 500 }
    );
  }

  if (!verifyMooovWebhook(raw, signature, webhookSecret)) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  let event: MooovConnectEvent;
  try {
    event = JSON.parse(raw) as MooovConnectEvent;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  if (!event.id || !event.type || !event.merchant?.id) {
    return NextResponse.json(
      { error: "Missing event id, type, or merchant." },
      { status: 400 }
    );
  }

  // Single guard around every server-side step so any uncaught throw
  // (Supabase client init, PostgREST 4xx that supabase-js converts to
  // a rejection, network blip during the projection update, etc.)
  // surfaces as a JSON 500 with the event id to correlate, instead of
  // a body-less Vercel 500. Mooov's outbox can safely retry on 500.
  try {
    const supa = createServiceClient();
    const lodgeId = await findLodgeIdForMerchant(supa, event.merchant.id);
    if (!lodgeId) {
      console.warn("Mooov webhook for unknown merchant", {
        event_id: event.id,
        event_type: event.type,
        merchant_id: event.merchant.id,
      });
      return NextResponse.json({ ok: true, ignored: true });
    }

    const paymentId = event.data?.payment_id ?? null;
    const { error: insertError } = await supa
      .schema("mooov")
      .from("mooov_webhook_events")
      .insert({
        lodge_id: lodgeId,
        event_id: event.id,
        event_type: event.type,
        payment_id: paymentId,
        raw_body: raw,
        delivery_id: deliveryId,
      });

    if (insertError) {
      if (insertError.code === "23505") {
        return NextResponse.json({ ok: true, replay: true });
      }
      console.error("Mooov Connect webhook persist failed", {
        code: insertError.code,
        message: insertError.message,
        details: insertError.details,
        hint: insertError.hint,
        event_id: event.id,
        event_type: event.type,
      });
      return NextResponse.json(
        {
          error: "Persist failed.",
          ref: event.id,
          db_code: insertError.code ?? null,
        },
        { status: 500 }
      );
    }

    await projectConnectEvent(supa, lodgeId, event);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const code =
      err && typeof err === "object" && "code" in err
        ? (err as { code?: string }).code
        : undefined;
    const status =
      err && typeof err === "object" && "status" in err
        ? (err as { status?: number }).status
        : undefined;
    console.error("Mooov Connect webhook unhandled error", {
      event_id: event.id,
      event_type: event.type,
      merchant_id: event.merchant.id,
      err_name: err instanceof Error ? err.name : typeof err,
      err_message: message,
      err_code: code ?? null,
      err_status: status ?? null,
    });
    return NextResponse.json(
      {
        error: "Internal error processing webhook.",
        ref: event.id,
        err_code: code ?? null,
      },
      { status: 500 }
    );
  }
}

async function projectConnectEvent(
  supa: ReturnType<typeof createServiceClient>,
  lodgeId: string,
  event: MooovConnectEvent
) {
  const paymentId = event.data?.payment_id;
  // Mooov emits "payment.succeeded" (server-flow / direct charge) and
  // "payment.captured" (redirect-flow / hosted Stripe Checkout). Both mean
  // the cardholder paid and the money has moved; treat them as the same
  // terminal-success event.
  const isPaymentCaptured =
    event.type === "payment.succeeded" || event.type === "payment.captured";

  if (isPaymentCaptured) {
    if (!paymentId) return;
    // Write-once on captured_at: only the FIRST payment.captured / payment.succeeded
    // event for this payment_id should stamp the timestamp. Mooov can legitimately
    // redeliver (e.g., the evt_refanout_* events we saw on 2026-05-21) and without
    // this guard each redelivery would bump captured_at to "now", masking the real
    // capture time. Status flip and downstream projection are still idempotent via
    // getPaymentByMooovId() so a no-op update here is safe.
    await supa
      .schema("mooov")
      .from("payment_attempts")
      .update({
        status: "captured",
        captured_at: new Date().toISOString(),
      })
      .eq("lodge_id", lodgeId)
      .eq("payment_id", paymentId)
      .is("captured_at", null);
    // Now project to LP-side tables based on the recorded intent. We read
    // the attempt back AFTER the update so guest_descriptor + metadata
    // reflect everything /api/donations (or future /api/events checkout)
    // stashed for us at preflight time.
    const { data: attempt, error: readErr } = await supa
      .schema("mooov")
      .from("payment_attempts")
      .select(
        "payment_id, intent, amount, currency, guest_descriptor, metadata, member_id"
      )
      .eq("lodge_id", lodgeId)
      .eq("payment_id", paymentId)
      .maybeSingle<{
        payment_id: string;
        intent: string;
        amount: number;
        currency: string;
        guest_descriptor: Record<string, unknown> | null;
        metadata: Record<string, unknown> | null;
        member_id: string | null;
      }>();
    if (readErr) {
      console.error("mooov webhook: payment_attempts read-back failed", {
        event_id: event.id,
        payment_id: paymentId,
        code: readErr.code,
        message: readErr.message,
      });
      return;
    }
    if (!attempt) return;
    if (attempt.intent === "donation") {
      await projectDonationCaptured(lodgeId, attempt);
    } else if (attempt.intent === "event") {
      await projectEventCaptured(lodgeId, attempt);
    } else if (attempt.intent === "dues") {
      await projectDuesCaptured(lodgeId, attempt);
    } else if (attempt.intent === "dues_subscription_enrol") {
      await projectDuesSubscriptionEnrolCaptured(lodgeId, attempt, event);
    } else if (attempt.intent === "dues_subscription_cycle") {
      await projectDuesSubscriptionCycleCaptured(lodgeId, attempt, event);
    } else if (
      attempt.intent === "take_payment" ||
      attempt.intent === "lodge_generic_standing_qr" ||
      attempt.intent === "charity_donation_standing_qr" ||
      attempt.intent === "event_dining_standing_qr" ||
      attempt.intent === "event_raffle_standing_qr"
    ) {
      // In-person take-payment + all standing-QR flows. We project to
      // public.payments with the right dining/charity/raffle split based on
      // intent so the Treasurer's existing rollups (admin/payments,
      // admin/treasurer, admin/reports) include these without any new code.
      await projectStandingOrTakePaymentCaptured(lodgeId, attempt);
    }
    return;
  }

  switch (event.type) {
    case "payment.failed": {
      if (!paymentId) return;
      const failureReason =
        typeof event.data?.failure_reason === "string"
          ? event.data.failure_reason
          : null;
      const failureCode =
        typeof event.data?.failure_code === "string"
          ? event.data.failure_code
          : null;
      const failureCategory =
        typeof event.data?.failure_category === "string"
          ? event.data.failure_category
          : null;

      // Look up the attempt before we mark it failed so we can find the
      // speculative RSVP that was created pre-checkout. The webhook is
      // the only place where we learn the brother walked away without
      // paying, so without this step the abandoned RSVP would linger
      // forever as `payment_pending`.
      const { data: attemptRow } = await supa
        .schema("mooov")
        .from("payment_attempts")
        .select("guest_descriptor, intent")
        .eq("lodge_id", lodgeId)
        .eq("payment_id", paymentId)
        .maybeSingle<{
          guest_descriptor: Record<string, unknown> | null;
          intent: string | null;
        }>();

      await supa
        .schema("mooov")
        .from("payment_attempts")
        .update({
          status: "failed",
          failure_reason: failureReason,
        })
        .eq("lodge_id", lodgeId)
        .eq("payment_id", paymentId);

      // Reverse the speculative event RSVP, if any. We only do this for
      // `intent: "event"` attempts so we never accidentally cancel a
      // donation-attached RSVP or anything else. We mark the RSVP
      // `cancelled` (not delete it) so the audit trail survives, and
      // drop the placeholder guests so they don't show up in the
      // dining/place-card exports.
      const descriptor = attemptRow?.guest_descriptor ?? {};
      const rsvpIdFromAttempt =
        typeof descriptor.rsvp_id === "string" ? descriptor.rsvp_id : null;
      if (rsvpIdFromAttempt && (attemptRow?.intent === "event" || !attemptRow?.intent)) {
        try {
          await db.updateRsvp(rsvpIdFromAttempt, lodgeId, {
            status: "cancelled",
          });
          await db.deleteEventGuestsByRsvp(rsvpIdFromAttempt, lodgeId);
        } catch (cancelErr) {
          console.error("mooov webhook: failed to cancel abandoned RSVP", {
            event_id: event.id,
            payment_id: paymentId,
            rsvp_id: rsvpIdFromAttempt,
            failure_code: failureCode,
            message:
              cancelErr instanceof Error
                ? cancelErr.message
                : String(cancelErr),
          });
        }
      }

      // For dues subscription cycles or enrolment, bump dunning state
      // on the schedule so the cron + treasurer notifications branch
      // correctly. Donations/events/standing-QR remain unaffected.
      if (
        attemptRow &&
        (attemptRow.intent === "dues_subscription_enrol" ||
          attemptRow.intent === "dues_subscription_cycle")
      ) {
        await handleDuesSubscriptionFailure(lodgeId, {
          intent: attemptRow.intent,
          guest_descriptor: descriptor,
        }, {
          failureCode,
          failureCategory,
          failureReason,
        });
      }

      // account_invalid means the lodge's underlying PSP connection got
      // severed (typically: the lodge clicked "Disconnect" from inside
      // their Stripe dashboard, or Stripe's risk team paused the
      // connection). Mooov can't fix this server-side -- the lodge admin
      // has to walk through Mooov's portal repair flow. Flip the lodge
      // row to needs_repair so /admin/integrations renders the deep-link
      // banner. Other failure codes (checkout_abandoned, etc.) are
      // expected wear-and-tear and don't change the connection state.
      if (failureCode === "account_invalid") {
        const { data: existing } = await supa
          .schema("mooov")
          .from("lodges")
          .select("metadata")
          .eq("id", lodgeId)
          .maybeSingle<{ metadata: Record<string, unknown> | null }>();
        const mergedMetadata: Record<string, unknown> = {
          ...(existing?.metadata ?? {}),
          last_failure_at: new Date().toISOString(),
          last_failure_code: failureCode,
          last_failure_category: failureCategory ?? undefined,
          last_failure_reason: failureReason ?? undefined,
          last_failure_event_id: event.id,
        };
        const { error: updateErr } = await supa
          .schema("mooov")
          .from("lodges")
          .update({ status: "needs_repair", metadata: mergedMetadata })
          .eq("id", lodgeId);
        if (updateErr) {
          console.error("mooov webhook: account_invalid lodge update failed", {
            event_id: event.id,
            lodge_id: lodgeId,
            message: updateErr.message,
          });
        }
      }
      return;
    }
    case "payment.refunded":
      if (!paymentId) return;
      await supa
        .schema("mooov")
        .from("payment_attempts")
        .update({
          status: "refunded",
          refunded_at: new Date().toISOString(),
        })
        .eq("lodge_id", lodgeId)
        .eq("payment_id", paymentId);
      return;
    case "payment.disputed":
      if (!paymentId) return;
      await supa
        .schema("mooov")
        .from("payment_attempts")
        .update({
          status: "disputed",
        })
        .eq("lodge_id", lodgeId)
        .eq("payment_id", paymentId);
      return;
    case "grant.revoked":
      await supa
        .schema("mooov")
        .from("lodges")
        .update({
          status: "revoked",
          metadata: {
            revoked_at: new Date().toISOString(),
            revoked_event_id: event.id,
          },
        })
        .eq("id", lodgeId);
      return;
    case "subscription.activated":
    case "subscription.updated":
    case "subscription.canceled":
    case "subscription.invoice_paid":
    case "subscription.invoice_failed": {
      // Mooov 2026-05-28 reply (post-lock): subscription pass-through
      // Slices 1, 2, 3a, 4, 5 are live in prod; 3b (invoice.paid /
      // invoice.payment_failed projection) is dispatcher-routed but
      // stub. We are NOT migrating any live schedule to Stripe
      // Subscription mode until 3b lands and we ship the migration
      // script (app/api/admin/dues/migrate-to-stripe-subscriptions).
      //
      // Until then any subscription.* event we receive is either:
      //   (a) a Mooov-side test fixture (merch_lodgepaytest_3f3a5w),
      //   (b) a probe from operators, or
      //   (c) noise from the dual-emit fan-out on a schedule we did
      //       NOT migrate (shouldn't happen but is the dangerous case
      //       to flag loudly if it ever does).
      //
      // Persist (already done by the parent insert) + log + ack 200.
      // Per-cycle money projection comes from the paired payment.captured
      // event on the payment lane, which our existing handler at the top
      // of this function already covers.
      const subscriptionId =
        typeof event.data?.subscription_id === "string"
          ? event.data.subscription_id
          : null;
      const subscriptionMetadata =
        event.data?.subscription_metadata &&
        typeof event.data.subscription_metadata === "object"
          ? (event.data.subscription_metadata as Record<string, unknown>)
          : null;
      console.log("mooov webhook: subscription event ack-only (no projection)", {
        event_id: event.id,
        event_type: event.type,
        merchant_id: event.merchant.id,
        subscription_id: subscriptionId,
        lp_schedule_id:
          typeof subscriptionMetadata?.lp_schedule_id === "string"
            ? subscriptionMetadata.lp_schedule_id
            : null,
        slice_3b_required:
          event.type === "subscription.invoice_paid" ||
          event.type === "subscription.invoice_failed",
      });
      return;
    }
  }
}

// Project a captured Mooov donation into the LP-side donations / payments /
// gift_aid_declarations tables. Mirrors the shape the legacy Stripe webhook
// (app/api/payments/webhook/route.ts -> handleDonationCompleted) wrote, so
// downstream admin views / Gift Aid claim batching keep working unchanged.
//
// Idempotent: getPaymentByMooovId() is the dedupe gate. A retried Mooov
// webhook delivery (same payment_id) lands here twice; the second call
// short-circuits.
async function projectDonationCaptured(
  lodgeId: string,
  attempt: {
    payment_id: string;
    amount: number;
    currency: string;
    guest_descriptor: Record<string, unknown> | null;
    metadata: Record<string, unknown> | null;
  }
) {
  const existing = await db.getPaymentByMooovId(attempt.payment_id);
  if (existing) {
    console.log("mooov webhook: donation already projected (idempotent)", {
      payment_id: attempt.payment_id,
    });
    return;
  }

  const guest = (attempt.guest_descriptor ?? {}) as Record<string, unknown>;
  const donorEmail =
    typeof guest.donor_email === "string" ? guest.donor_email : "";
  const donorName = typeof guest.donor_name === "string" ? guest.donor_name : null;
  const giftAid = guest.gift_aid === true || guest.gift_aid === "true";
  // amount is stored as minor units (pence) on payment_attempts; LP-side
  // schemas keep amounts in major units (pounds), matching the Stripe
  // webhook's existing conversion (Stripe.amount_total / 100).
  const amountMajor = (attempt.amount ?? 0) / 100;
  const currencyMajor = (attempt.currency ?? "GBP").toUpperCase();
  const completedAt = new Date().toISOString();

  const payment = await db.addPayment(lodgeId, {
    rsvp_id: null,
    event_id: null,
    user_email: donorEmail,
    user_name: donorName,
    stripe_payment_intent_id: null,
    stripe_charge_id: null,
    stripe_customer_id: null,
    mooov_payment_id: attempt.payment_id,
    dining_amount: 0,
    charity_amount: amountMajor,
    raffle_amount: 0,
    meeting_fee_amount: 0,
    guest_ticket_amount: 0,
    total_amount: amountMajor,
    currency: currencyMajor,
    charity_name: null,
    status: "succeeded",
    refund_amount: 0,
    refund_reason: null,
    completed_at: completedAt,
  });

  let giftAidDeclarationId: string | null = null;
  if (giftAid) {
    const declaration = await db.addGiftAidDeclaration(lodgeId, {
      donor_name: donorName ?? "",
      donor_email: donorEmail,
      donor_address_line_1:
        typeof guest.gift_aid_address_line_1 === "string"
          ? guest.gift_aid_address_line_1
          : null,
      donor_address_line_2:
        typeof guest.gift_aid_address_line_2 === "string"
          ? guest.gift_aid_address_line_2
          : null,
      donor_city:
        typeof guest.gift_aid_city === "string" ? guest.gift_aid_city : null,
      donor_postcode:
        typeof guest.gift_aid_postcode === "string"
          ? guest.gift_aid_postcode
          : null,
      donor_country: "United Kingdom",
      declaration_text:
        "I am a UK taxpayer and understand that if I pay less Income Tax and/or Capital Gains Tax than the amount of Gift Aid claimed on all my donations in that tax year it is my responsibility to pay any difference.",
      declaration_confirmed: true,
      confirmation_method: "online_checkout",
      hmrc_eligible: true,
    });
    giftAidDeclarationId = declaration.id;
  }

  await db.addDonation(lodgeId, {
    event_id: null,
    payment_id: payment.id,
    donor_name: donorName,
    donor_email: donorEmail,
    amount: amountMajor,
    currency: (attempt.currency ?? "gbp").toLowerCase(),
    source: "online_donation",
    status: "completed",
    gift_aid_declaration_id: giftAidDeclarationId,
  });
}

// Project a captured Mooov event-guest payment into LP public.payments +
// flip the RSVP to payment_completed/confirmed. Mirrors the legacy Stripe
// webhook's handleRsvpPaymentCompleted (with the same dining/charity/
// meeting_fee/guest_total split on the payments row).
//
// Idempotent on payments.mooov_payment_id; a duplicate Mooov webhook
// delivery for the same payment_id short-circuits.
async function projectEventCaptured(
  lodgeId: string,
  attempt: {
    payment_id: string;
    amount: number;
    currency: string;
    guest_descriptor: Record<string, unknown> | null;
    metadata: Record<string, unknown> | null;
  }
) {
  const existing = await db.getPaymentByMooovId(attempt.payment_id);
  if (existing) {
    console.log("mooov webhook: event payment already projected (idempotent)", {
      payment_id: attempt.payment_id,
    });
    return;
  }

  const guest = (attempt.guest_descriptor ?? {}) as Record<string, unknown>;
  const rsvpId = typeof guest.rsvp_id === "string" ? guest.rsvp_id : null;
  const eventId = typeof guest.event_id === "string" ? guest.event_id : null;
  if (!eventId) {
    console.error("mooov webhook: event payment missing event_id in guest_descriptor", {
      payment_id: attempt.payment_id,
    });
    return;
  }
  const donorEmail =
    typeof guest.donor_email === "string" ? guest.donor_email : "";
  const donorName = typeof guest.donor_name === "string" ? guest.donor_name : null;
  // Line-item split (pounds) preserved from the guest_descriptor. Falling
  // back to 0 keeps the projection safe if a future caller forgot a field.
  const numField = (k: string) =>
    typeof guest[k] === "number"
      ? (guest[k] as number)
      : typeof guest[k] === "string"
      ? Number(guest[k]) || 0
      : 0;
  const diningTotal = numField("dining_total");
  const meetingFee = numField("meeting_fee");
  const charityAmount = numField("charity_amount");
  const guestTotal = numField("guest_total");
  const raffleAmount = numField("raffle_amount");
  const totalMajor = (attempt.amount ?? 0) / 100;
  const currencyMajor = (attempt.currency ?? "GBP").toUpperCase();
  const completedAt = new Date().toISOString();

  const payment = await db.addPayment(lodgeId, {
    rsvp_id: rsvpId,
    event_id: eventId,
    user_email: donorEmail,
    user_name: donorName,
    stripe_payment_intent_id: null,
    stripe_charge_id: null,
    stripe_customer_id: null,
    mooov_payment_id: attempt.payment_id,
    dining_amount: diningTotal,
    charity_amount: charityAmount,
    raffle_amount: raffleAmount,
    meeting_fee_amount: meetingFee,
    guest_ticket_amount: guestTotal,
    total_amount: totalMajor,
    currency: currencyMajor,
    charity_name: null,
    status: "succeeded",
    refund_amount: 0,
    refund_reason: null,
    completed_at: completedAt,
  });

  if (rsvpId) {
    await db.updateRsvp(rsvpId, lodgeId, {
      payment_id: payment.id,
      payment_completed: true,
      status: "confirmed",
    });
  }

  // Fire the guest welcome email after a successful capture so paid guests
  // get the same confirmation that free RSVPs receive in /api/g/[token]/checkout.
  // Best-effort: any Resend failure is logged but does not fail the webhook
  // (idempotency on payments.mooov_payment_id keeps replays safe).
  if (donorEmail) {
    try {
      const [event, lodge] = await Promise.all([
        db.getEventById(eventId, lodgeId),
        db.getLodgeById(lodgeId),
      ]);
      if (event) {
        const totalPaid =
          diningTotal + meetingFee + charityAmount + guestTotal + raffleAmount;
        await sendGuestWelcomeEmail({
          toEmail: donorEmail,
          toName: donorName ?? donorEmail,
          lodgeName: lodge?.name ?? "the lodge",
          eventTitle: event.title,
          eventDate: event.event_date,
          eventTime: event.event_time,
          location: event.location,
          dressCode: event.dress_code,
          totalPaid,
          currency: currencyMajor,
        });
      }
    } catch (welcomeErr) {
      console.error("mooov webhook: guest welcome email failed", {
        payment_id: attempt.payment_id,
        message:
          welcomeErr instanceof Error ? welcomeErr.message : String(welcomeErr),
      });
    }
  }

  // If the event RSVP form opted into Gift Aid for the charity portion,
  // record the declaration the same way the legacy Stripe webhook did. We
  // don't add a separate donations row -- the charity portion is already
  // captured on payments.charity_amount and the gift-aid claim batcher
  // joins on (lodge_id, donor_email).
  const giftAid =
    (attempt.guest_descriptor ?? ({} as Record<string, unknown>)).gift_aid;
  if (giftAid === true || giftAid === "true") {
    const g = attempt.guest_descriptor as Record<string, unknown>;
    await db.addGiftAidDeclaration(lodgeId, {
      donor_name:
        typeof g.gift_aid_donor_name === "string"
          ? g.gift_aid_donor_name
          : donorName ?? "",
      donor_email:
        typeof g.gift_aid_donor_email === "string"
          ? g.gift_aid_donor_email
          : donorEmail,
      donor_address_line_1:
        typeof g.gift_aid_address_line_1 === "string"
          ? g.gift_aid_address_line_1
          : null,
      donor_address_line_2:
        typeof g.gift_aid_address_line_2 === "string"
          ? g.gift_aid_address_line_2
          : null,
      donor_city:
        typeof g.gift_aid_city === "string" ? g.gift_aid_city : null,
      donor_postcode:
        typeof g.gift_aid_postcode === "string" ? g.gift_aid_postcode : null,
      donor_country: "United Kingdom",
      declaration_text:
        "I am a UK taxpayer and understand that if I pay less Income Tax and/or Capital Gains Tax than the amount of Gift Aid claimed on all my donations in that tax year it is my responsibility to pay any difference.",
      declaration_confirmed: true,
      confirmation_method: "online_checkout",
      hmrc_eligible: true,
    });
  }
}

// Project a captured Mooov member-dues payment. Mirrors the legacy Stripe
// webhook's handleDuesCompleted: writes a public.payments row, flips the
// member_dues row to paid (linking to the new payment), and -- if the
// dues record carried a charitable portion -- writes a donations row plus
// gift-aid declaration link if one is on file for this member email.
//
// Idempotent on payments.mooov_payment_id (same gate the other intents use).
async function projectDuesCaptured(
  lodgeId: string,
  attempt: {
    payment_id: string;
    amount: number;
    currency: string;
    guest_descriptor: Record<string, unknown> | null;
    metadata: Record<string, unknown> | null;
  }
) {
  const existing = await db.getPaymentByMooovId(attempt.payment_id);
  if (existing) {
    console.log("mooov webhook: dues payment already projected (idempotent)", {
      payment_id: attempt.payment_id,
    });
    return;
  }

  const guest = (attempt.guest_descriptor ?? {}) as Record<string, unknown>;
  const duesId = typeof guest.dues_id === "string" ? guest.dues_id : null;
  if (!duesId) {
    console.error("mooov webhook: dues payment missing dues_id in guest_descriptor", {
      payment_id: attempt.payment_id,
    });
    return;
  }

  // We re-fetch the dues record so we have authoritative member_name /
  // currency / charitable_amount, instead of trusting the snapshot the
  // route captured at preflight time (could be hours/days ago if the
  // member opened the hosted Checkout page in a browser tab and paid
  // later).
  const allDues = await db.getMemberDues(lodgeId);
  const duesRecord = allDues.find((d) => d.id === duesId);
  if (!duesRecord) {
    console.error("mooov webhook: dues record not found for captured payment", {
      payment_id: attempt.payment_id,
      dues_id: duesId,
    });
    return;
  }

  const donorEmail =
    typeof guest.donor_email === "string"
      ? guest.donor_email
      : duesRecord.member_email;
  const donorName =
    typeof guest.donor_name === "string"
      ? guest.donor_name
      : duesRecord.member_name ?? null;
  const totalMajor = (attempt.amount ?? 0) / 100;
  const currencyMajor = (attempt.currency ?? "GBP").toUpperCase();
  const charitableAmount = duesRecord.charitable_amount ?? 0;
  const completedAt = new Date().toISOString();

  const payment = await db.addPayment(lodgeId, {
    rsvp_id: null,
    event_id: null,
    user_email: donorEmail,
    user_name: donorName,
    stripe_payment_intent_id: null,
    stripe_charge_id: null,
    stripe_customer_id: null,
    mooov_payment_id: attempt.payment_id,
    dining_amount: 0,
    charity_amount: charitableAmount,
    raffle_amount: 0,
    meeting_fee_amount: 0,
    guest_ticket_amount: 0,
    total_amount: totalMajor,
    currency: currencyMajor,
    charity_name: charitableAmount > 0 ? "Dues charitable portion" : null,
    status: "succeeded",
    refund_amount: 0,
    refund_reason: null,
    completed_at: completedAt,
  });

  const declaration =
    charitableAmount > 0
      ? await db.getActiveGiftAidDeclarationByEmail(lodgeId, donorEmail)
      : null;
  const giftAidStatus = declaration
    ? "declared"
    : charitableAmount > 0
    ? "eligible"
    : "unknown";

  await db.updateMemberDuesStatus(duesId, lodgeId, {
    status: "paid",
    payment_id: payment.id,
    gift_aid_declaration_id: declaration?.id ?? null,
    gift_aid_status: giftAidStatus,
    gift_aid_eligible_amount: charitableAmount,
    paid_at: completedAt,
  });

  if (charitableAmount > 0) {
    await db.addDonation(lodgeId, {
      event_id: null,
      payment_id: payment.id,
      donor_name: donorName,
      donor_email: donorEmail,
      amount: charitableAmount,
      currency: currencyMajor,
      source: "dues_charitable_portion",
      status: "completed",
      gift_aid_declaration_id: declaration?.id ?? null,
      gift_aid_status: giftAidStatus,
      gift_aid_eligible_amount: declaration ? charitableAmount : 0,
    });
  }
}

// Project an in-person take-payment or standing-QR capture into
// public.payments. We split the amount into dining/charity/raffle columns
// based on the intent so the existing Treasurer rollups categorise the row
// correctly without any new aggregation code.
//
// Donor email is intentionally optional here: for standing-QR scans the
// cardholder typically enters their email on Mooov's hosted page (which
// doesn't yet pass through to our webhook), and for in-person take-payment
// there's no email to collect at all. We record `payments.user_email = ""`
// in those cases; the Treasurer reconciles by reference / time-of-day.
//
// Idempotent on payments.mooov_payment_id, like the other projections.
async function projectStandingOrTakePaymentCaptured(
  lodgeId: string,
  attempt: {
    payment_id: string;
    intent: string;
    amount: number;
    currency: string;
    guest_descriptor: Record<string, unknown> | null;
    metadata: Record<string, unknown> | null;
  },
) {
  const amountMajor = (attempt.amount ?? 0) / 100;
  const metadata = (attempt.metadata ?? {}) as Record<string, unknown>;
  const guest = (attempt.guest_descriptor ?? {}) as Record<string, unknown>;
  const eventIdRaw = metadata.event_id;
  const eventId = typeof eventIdRaw === "string" ? eventIdRaw : null;
  const reference =
    typeof guest.reference === "string" ? (guest.reference as string) : null;

  // Pull through any payer attribution the mint route stashed. When the
  // treasurer picked a member or guest in the take-payment form we want the
  // projected payments row to be credited to that payer (user_name +
  // user_email) so the admin/payments ledger doesn't show a blank row.
  // Reads the new payer_name/payer_email keys with a fallback to the legacy
  // member_name/member_email keys for QR codes minted on the old shape.
  const payerName =
    typeof guest.payer_name === "string"
      ? (guest.payer_name as string)
      : typeof guest.member_name === "string"
        ? (guest.member_name as string)
        : null;
  const payerEmail =
    typeof guest.payer_email === "string"
      ? (guest.payer_email as string)
      : typeof guest.member_email === "string"
        ? (guest.member_email as string)
        : null;
  const memberId =
    typeof guest.member_id === "string" ? (guest.member_id as string) : null;
  const guestId =
    typeof guest.guest_id === "string" ? (guest.guest_id as string) : null;
  const giftAidDeclarationId =
    typeof guest.gift_aid_declaration_id === "string"
      ? (guest.gift_aid_declaration_id as string)
      : null;
  const giftAidEligible = guest.gift_aid_eligible === true;

  // Translate the various standing-QR + take_payment intents into the unified
  // (category, charityName) shape the shared projector expects. Generic /
  // unknown intents pass through with no category so total_amount carries
  // the full sum and dining/charity/raffle sub-totals stay zero.
  let category: string | null =
    typeof metadata.category === "string" ? (metadata.category as string) : null;
  let charityName: string | null = null;
  switch (attempt.intent) {
    case "charity_donation_standing_qr":
      category = "charity";
      charityName =
        typeof metadata.charity_name === "string"
          ? (metadata.charity_name as string)
          : null;
      break;
    case "event_raffle_standing_qr":
      category = "raffle";
      break;
    case "event_dining_standing_qr":
      category = "dining";
      break;
    case "take_payment":
      // category already set from metadata above.
      break;
    case "lodge_generic_standing_qr":
    default:
      category = null;
      break;
  }

  const result = await projectTakePaymentCaptured({
    lodgeId,
    mooovPaymentId: attempt.payment_id,
    amountMajor,
    currency: attempt.currency ?? "GBP",
    category,
    reference,
    eventId,
    charityName,
    payerName,
    payerEmail,
    memberId,
    guestId,
    giftAidDeclarationId,
    giftAidEligible,
    paymentMethod: "card_qr",
  });

  if (result.alreadyExisted) {
    console.log(
      "mooov webhook: standing-qr / take-payment already projected (idempotent)",
      {
        payment_id: attempt.payment_id,
        intent: attempt.intent,
      },
    );
  }
}

// Project a captured Mooov dues SUBSCRIPTION ENROLMENT payment.
//
// First cycle of a yearly dues schedule. We:
//   1. Persist the saved Stripe PM + Customer onto dues_schedules so the
//      daily cron has what it needs to run subsequent cycles via
//      /v1/charges/saved (Mooov 2026-05-28 reply, Q-A — both fields
//      stamped on data when customer_ref was set on the create call).
//   2. Flip the schedule status pending -> active and stamp next_charge_at
//      to the second instalment's due_date.
//   3. Mark instalment #1 paid + project a public.payments row so the
//      Treasurer ledger picks the cycle up (existing reporting query).
//   4. If this was a single-cycle schedule (e.g. one-shot subscription
//      that just collects month 1 because remaining months <= 1) flip
//      member_dues to paid at this point.
//
// Idempotent on payments.mooov_payment_id (re-deliveries skip the
// duplicate payments insert) and on dues_schedules.status (only the
// first transition writes the saved PM + customer).
async function projectDuesSubscriptionEnrolCaptured(
  lodgeId: string,
  attempt: {
    payment_id: string;
    amount: number;
    currency: string;
    guest_descriptor: Record<string, unknown> | null;
    metadata: Record<string, unknown> | null;
  },
  event: MooovConnectEvent
) {
  const existingPayment = await db.getPaymentByMooovId(attempt.payment_id);
  if (existingPayment) {
    console.log(
      "mooov webhook: dues subscription enrolment already projected (idempotent)",
      { payment_id: attempt.payment_id }
    );
    return;
  }

  const guest = (attempt.guest_descriptor ?? {}) as Record<string, unknown>;
  const scheduleId =
    typeof guest.schedule_id === "string" ? guest.schedule_id : null;
  const duesId = typeof guest.dues_id === "string" ? guest.dues_id : null;
  if (!scheduleId || !duesId) {
    console.error(
      "mooov webhook: dues enrolment missing schedule_id/dues_id in guest_descriptor",
      { payment_id: attempt.payment_id }
    );
    return;
  }

  const schedule = await db.getDuesSchedule(scheduleId, lodgeId);
  if (!schedule) {
    console.error("mooov webhook: dues schedule not found", {
      payment_id: attempt.payment_id,
      schedule_id: scheduleId,
    });
    return;
  }

  const allDues = await db.getMemberDues(lodgeId);
  const duesRecord = allDues.find((d) => d.id === duesId);
  if (!duesRecord) {
    console.error("mooov webhook: dues record not found for enrolment capture", {
      payment_id: attempt.payment_id,
      dues_id: duesId,
    });
    return;
  }

  const paymentMethodId =
    typeof event.data?.payment_method_id === "string"
      ? event.data.payment_method_id
      : null;
  const stripeCustomerId =
    typeof event.data?.stripe_customer_id === "string"
      ? event.data.stripe_customer_id
      : null;

  if (!paymentMethodId) {
    // Per Mooov's 2026-05-28 reply: payment_method_id should ALWAYS be on
    // the webhook for an enrolment intent that set customer_ref. If it's
    // missing, log loud and refuse to flip the schedule active — without
    // a saved PM the cron has no card to charge against.
    console.error(
      "mooov webhook: dues enrolment payment.succeeded missing data.payment_method_id; schedule remains pending",
      {
        payment_id: attempt.payment_id,
        schedule_id: scheduleId,
        event_id: event.id,
      }
    );
    return;
  }

  const instalments = await db.getInstalmentsForDues(duesId, lodgeId);
  const firstInstalment = instalments.find((i) => i.sequence === 1);
  const secondInstalment = instalments.find((i) => i.sequence === 2);

  // 1. Stamp saved PM + customer + status active on the schedule.
  await db.updateDuesSchedule(scheduleId, lodgeId, {
    mooov_payment_method_id: paymentMethodId,
    stripe_customer_id: stripeCustomerId,
    status: "active",
    next_charge_at: secondInstalment?.due_date ?? null,
    last_charged_at: new Date().toISOString(),
    consecutive_failures: 0,
    last_failure_code: null,
    last_failure_category: null,
    last_failure_at: null,
    next_action_client_secret: null,
    next_action_connected_account_id: null,
    next_action_expires_at: null,
  });

  // 2. Project the public.payments row + mark instalment #1 paid.
  const totalMajor = (attempt.amount ?? 0) / 100;
  const currencyMajor = (attempt.currency ?? "GBP").toUpperCase();
  const charitablePerCycle = computeCyclicalCharitable(
    duesRecord.charitable_amount,
    instalments.length
  );
  const completedAt = new Date().toISOString();

  const payment = await db.addPayment(lodgeId, {
    rsvp_id: null,
    event_id: null,
    user_email: duesRecord.member_email,
    user_name: duesRecord.member_name,
    stripe_payment_intent_id: null,
    stripe_charge_id: null,
    stripe_customer_id: stripeCustomerId,
    mooov_payment_id: attempt.payment_id,
    dining_amount: 0,
    charity_amount: charitablePerCycle,
    raffle_amount: 0,
    meeting_fee_amount: 0,
    guest_ticket_amount: 0,
    total_amount: totalMajor,
    currency: currencyMajor,
    charity_name: charitablePerCycle > 0 ? "Dues charitable portion" : null,
    status: "succeeded",
    refund_amount: 0,
    refund_reason: null,
    completed_at: completedAt,
  });

  if (firstInstalment) {
    await db.updateInstalment(firstInstalment.id, lodgeId, {
      status: "paid",
      paid_at: completedAt,
      payment_reference: attempt.payment_id,
    });
  }

  // 3. If the schedule has only one cycle (degenerate case: e.g. someone
  //    enrolled with 1 month remaining), flip the parent member_dues to
  //    paid right now and mark the schedule completed.
  if (instalments.length <= 1) {
    await db.updateMemberDuesStatus(duesId, lodgeId, {
      status: "paid",
      payment_id: payment.id,
      paid_at: completedAt,
    });
    await db.updateDuesSchedule(scheduleId, lodgeId, {
      status: "completed",
    });
  }

  // 4. Charitable donation row for the cycle, mirroring the one-off
  //    dues path. Per-cycle attribution keeps the Gift Aid claim
  //    batcher's date alignment correct (gift made on charge date).
  if (charitablePerCycle > 0) {
    const declaration = await db.getActiveGiftAidDeclarationByEmail(
      lodgeId,
      duesRecord.member_email
    );
    await db.addDonation(lodgeId, {
      event_id: null,
      payment_id: payment.id,
      donor_name: duesRecord.member_name,
      donor_email: duesRecord.member_email,
      amount: charitablePerCycle,
      currency: currencyMajor,
      source: "dues_charitable_portion",
      status: "completed",
      gift_aid_declaration_id: declaration?.id ?? null,
      gift_aid_status: declaration ? "declared" : "eligible",
      gift_aid_eligible_amount: declaration ? charitablePerCycle : 0,
    });
  }
}

// Project a captured Mooov dues SUBSCRIPTION CYCLE payment. Driven by
// the daily cron's runSavedDuesCharge call (Mooov 2026-05-28 reply,
// task L1.3). One row per cycle.
//
// Cycle correlation: the cron stamps payment_id =
// pay_dues_<schedule_id>_<NNN> on the matching member_dues_instalments
// row at preflight time, then this projector flips that row to paid.
//
// When the last outstanding instalment is paid we flip the parent
// member_dues to paid and the schedule to completed.
async function projectDuesSubscriptionCycleCaptured(
  lodgeId: string,
  attempt: {
    payment_id: string;
    amount: number;
    currency: string;
    guest_descriptor: Record<string, unknown> | null;
    metadata: Record<string, unknown> | null;
  },
  _event: MooovConnectEvent
) {
  const existingPayment = await db.getPaymentByMooovId(attempt.payment_id);
  if (existingPayment) {
    console.log(
      "mooov webhook: dues subscription cycle already projected (idempotent)",
      { payment_id: attempt.payment_id }
    );
    return;
  }

  const guest = (attempt.guest_descriptor ?? {}) as Record<string, unknown>;
  const scheduleId =
    typeof guest.schedule_id === "string" ? guest.schedule_id : null;
  const duesId = typeof guest.dues_id === "string" ? guest.dues_id : null;
  const instalmentId =
    typeof guest.instalment_id === "string" ? guest.instalment_id : null;
  if (!scheduleId || !duesId) {
    console.error(
      "mooov webhook: dues cycle missing schedule_id/dues_id in guest_descriptor",
      { payment_id: attempt.payment_id }
    );
    return;
  }

  const schedule = await db.getDuesSchedule(scheduleId, lodgeId);
  if (!schedule) {
    console.error("mooov webhook: dues schedule not found for cycle capture", {
      payment_id: attempt.payment_id,
      schedule_id: scheduleId,
    });
    return;
  }

  const allDues = await db.getMemberDues(lodgeId);
  const duesRecord = allDues.find((d) => d.id === duesId);
  if (!duesRecord) {
    console.error("mooov webhook: dues record not found for cycle capture", {
      payment_id: attempt.payment_id,
      dues_id: duesId,
    });
    return;
  }

  const totalMajor = (attempt.amount ?? 0) / 100;
  const currencyMajor = (attempt.currency ?? "GBP").toUpperCase();
  const completedAt = new Date().toISOString();
  const allInstalments = await db.getInstalmentsForDues(duesId, lodgeId);
  const charitablePerCycle = computeCyclicalCharitable(
    duesRecord.charitable_amount,
    allInstalments.length
  );

  const payment = await db.addPayment(lodgeId, {
    rsvp_id: null,
    event_id: null,
    user_email: duesRecord.member_email,
    user_name: duesRecord.member_name,
    stripe_payment_intent_id: null,
    stripe_charge_id: null,
    stripe_customer_id: schedule.stripe_customer_id ?? null,
    mooov_payment_id: attempt.payment_id,
    dining_amount: 0,
    charity_amount: charitablePerCycle,
    raffle_amount: 0,
    meeting_fee_amount: 0,
    guest_ticket_amount: 0,
    total_amount: totalMajor,
    currency: currencyMajor,
    charity_name: charitablePerCycle > 0 ? "Dues charitable portion" : null,
    status: "succeeded",
    refund_amount: 0,
    refund_reason: null,
    completed_at: completedAt,
  });

  // Find the matching instalment row. Prefer explicit guest.instalment_id,
  // fall back to "next outstanding for this schedule" by sequence.
  let target = instalmentId
    ? allInstalments.find((i) => i.id === instalmentId)
    : null;
  if (!target) {
    target = allInstalments
      .filter(
        (i) =>
          i.schedule_id === scheduleId &&
          (i.status === "outstanding" || i.status === "overdue")
      )
      .sort((a, b) => a.sequence - b.sequence)[0];
  }
  if (target) {
    await db.updateInstalment(target.id, lodgeId, {
      status: "paid",
      paid_at: completedAt,
      payment_reference: attempt.payment_id,
    });
  }

  // Find the next outstanding instalment for the schedule to drive the
  // cron's next_charge_at. If there's none, the schedule is complete.
  const remaining = allInstalments
    .filter(
      (i) =>
        i.schedule_id === scheduleId &&
        i.id !== (target?.id ?? "") &&
        (i.status === "outstanding" || i.status === "overdue")
    )
    .sort((a, b) => a.sequence - b.sequence);

  if (remaining.length === 0) {
    await db.updateDuesSchedule(scheduleId, lodgeId, {
      status: "completed",
      next_charge_at: null,
      last_charged_at: completedAt,
      consecutive_failures: 0,
      last_failure_code: null,
      last_failure_category: null,
      last_failure_at: null,
    });
    await db.updateMemberDuesStatus(duesId, lodgeId, {
      status: "paid",
      payment_id: payment.id,
      paid_at: completedAt,
    });
  } else {
    await db.updateDuesSchedule(scheduleId, lodgeId, {
      status: "active",
      next_charge_at: remaining[0].due_date,
      last_charged_at: completedAt,
      consecutive_failures: 0,
      last_failure_code: null,
      last_failure_category: null,
      last_failure_at: null,
      next_action_client_secret: null,
      next_action_connected_account_id: null,
      next_action_expires_at: null,
    });
  }

  if (charitablePerCycle > 0) {
    const declaration = await db.getActiveGiftAidDeclarationByEmail(
      lodgeId,
      duesRecord.member_email
    );
    await db.addDonation(lodgeId, {
      event_id: null,
      payment_id: payment.id,
      donor_name: duesRecord.member_name,
      donor_email: duesRecord.member_email,
      amount: charitablePerCycle,
      currency: currencyMajor,
      source: "dues_charitable_portion",
      status: "completed",
      gift_aid_declaration_id: declaration?.id ?? null,
      gift_aid_status: declaration ? "declared" : "eligible",
      gift_aid_eligible_amount: declaration ? charitablePerCycle : 0,
    });
  }
}

// Bump consecutive_failures + status on the dues_schedules row when a
// cycle (or the enrolment intent) fails. The cron retries on its next
// tick and Mooov's idempotency replay protects against double-charge.
async function handleDuesSubscriptionFailure(
  lodgeId: string,
  attempt: {
    intent: string;
    guest_descriptor: Record<string, unknown> | null;
  },
  failure: {
    failureCode: string | null;
    failureCategory: string | null;
    failureReason: string | null;
  }
) {
  const guest = (attempt.guest_descriptor ?? {}) as Record<string, unknown>;
  const scheduleId =
    typeof guest.schedule_id === "string" ? guest.schedule_id : null;
  if (!scheduleId) return;

  const schedule = await db.getDuesSchedule(scheduleId, lodgeId);
  if (!schedule) return;

  const nextFailures = (schedule.consecutive_failures ?? 0) + 1;
  // Threshold policy from 2026-05-28 design: notify treasurer at 1,
  // escalate at 3, pause at 5. The cron treats `paused` as a hard stop;
  // a treasurer can flip back to `active` from the admin schedule card.
  const status: "past_due" | "paused" =
    nextFailures >= 5 ? "paused" : "past_due";

  await db.updateDuesSchedule(scheduleId, lodgeId, {
    status,
    consecutive_failures: nextFailures,
    last_failure_code: failure.failureCode,
    last_failure_category: failure.failureCategory,
    last_failure_at: new Date().toISOString(),
  });

  console.log("dues subscription failure", {
    schedule_id: scheduleId,
    intent: attempt.intent,
    consecutive_failures: nextFailures,
    failure_code: failure.failureCode,
    failure_category: failure.failureCategory,
    failure_reason: failure.failureReason,
    status,
  });
}

// Per-cycle attribution of the charitable portion of the annual dues.
// The full-year charitable amount is divided across the cycles so the
// donations row at each capture lines up with the cycle's tax-year date,
// keeping the Gift Aid claim batcher's date alignment correct.
function computeCyclicalCharitable(
  fullYearCharitable: number | null | undefined,
  cycles: number
): number {
  const total = Number(fullYearCharitable ?? 0);
  if (total <= 0 || cycles <= 0) return 0;
  return Math.round((total / cycles) * 100) / 100;
}
