import { type NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { verifyMooovWebhook } from "@/lib/mooov";
import * as db from "@/lib/db";
import { sendGuestWelcomeEmail } from "@/lib/email/guest";
import { projectTakePaymentCaptured } from "@/lib/take-payment/project-captured";
import { sendTakePaymentReceipt } from "@/lib/email/take-payment-receipt";

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

      // Event-driven abandon for the open-ended subscription_checkouts
      // flow. Mooov fires `payment.failed` with `payment_id =
      // sub_dues_<schedule_id>` (the enrolment handle) and
      // `failure_code = checkout_abandoned` when the member never
      // completes the hosted checkout and the session expires. This is
      // the AUTHORITATIVE abandon signal — far safer than the blind
      // time-based sweep, which can't tell an abandoned checkout from a
      // real charge whose activation webhook is merely delayed. There is
      // no `payment_attempts` row for this flow (we call
      // /v1/subscription_checkouts directly), so it falls past the
      // attemptRow branch above. We resolve the schedule from the
      // metadata LP correlation id (preferred) or the payment_id suffix,
      // and only cancel it if it is still `pending` — never touch an
      // already-active / activated row.
      if (
        paymentId &&
        paymentId.startsWith("sub_dues_") &&
        failureCode === "checkout_abandoned"
      ) {
        const meta = (event.data?.metadata ?? {}) as Record<string, unknown>;
        const scheduleId =
          typeof meta.lp_schedule_id === "string" && meta.lp_schedule_id
            ? meta.lp_schedule_id
            : paymentId.slice("sub_dues_".length);
        try {
          const sched = await db
            .getDuesSchedule(scheduleId, lodgeId)
            .catch(() => null);
          if (sched && sched.status === "pending") {
            await db.updateDuesSchedule(scheduleId, lodgeId, {
              status: "cancelled",
              cancelled_at: new Date().toISOString(),
              cancelled_by_actor: "system_abandoned_checkout",
              next_charge_at: null,
            });
            console.log(
              "mooov webhook: cancelled pending schedule on checkout_abandoned",
              {
                event_id: event.id,
                schedule_id: scheduleId,
                payment_id: paymentId,
              },
            );
          }
        } catch (abandonErr) {
          console.error(
            "mooov webhook: checkout_abandoned schedule cancel failed",
            {
              event_id: event.id,
              schedule_id: scheduleId,
              message:
                abandonErr instanceof Error
                  ? abandonErr.message
                  : String(abandonErr),
            },
          );
        }
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
      // Mooov 2026-06-01 reply: open-ended subscription pass-through
      // is GA. We project these events into the LP dues_schedules /
      // member_dues_instalments / public.payments tables so the
      // member portal and treasurer dashboard reflect cycle-by-cycle
      // truth. The dual-emitted payment.captured event on the same
      // money movement is intentionally a no-op (our payment.captured
      // handler above only projects intents we set ourselves: dues,
      // donation, dues_subscription_enrol, etc.). Subscription
      // invoices are owned by Mooov server-side, so the linkage is
      // here, on the subscription lane.
      await handleSubscriptionEvent(lodgeId, event);
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

  // Donation receipt to the donor. Best-effort; idempotent on the
  // Mooov payment_id.
  if (donorEmail) {
    try {
      const lodge = await db.getLodgeById(lodgeId).catch(() => null);
      const { sendOnlinePaymentReceipt } = await import(
        "@/lib/email/payment-receipts"
      );
      await sendOnlinePaymentReceipt({
        lodgeId,
        lodge,
        toEmail: donorEmail,
        toName: donorName,
        memberId: null,
        amountMajor,
        currency: currencyMajor,
        kind: "donation",
        description: giftAid
          ? "Thank you for your donation. We've recorded a Gift Aid declaration alongside it so your gift can stretch a little further."
          : "Thank you for your donation.",
        mooovPaymentId: attempt.payment_id,
        metadata: { gift_aid: giftAid },
      });
    } catch (err) {
      console.error("mooov webhook: donation receipt email failed", {
        payment_id: attempt.payment_id,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }
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
  // record the declaration the same way the legacy Stripe webhook did and
  // capture its id so we can link the donation row below.
  const giftAid =
    (attempt.guest_descriptor ?? ({} as Record<string, unknown>)).gift_aid;
  let giftAidDeclarationId: string | null = null;
  if (giftAid === true || giftAid === "true") {
    const g = attempt.guest_descriptor as Record<string, unknown>;
    const declaration = await db.addGiftAidDeclaration(lodgeId, {
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
    giftAidDeclarationId = declaration.id;
  }

  // Record the charity portion as an event-linked donation so the
  // per-meeting Gift Aid panel + close batch pick it up. Written for every
  // charity contribution, not just GA opt-ins: the claim batcher matches
  // donation -> declaration by email at close time, so a declaration
  // uploaded later (paper form, profile import) makes this gift reclaimable
  // without re-tagging. Idempotent via the getPaymentByMooovId() guard at
  // the top of this projector -- a redelivery short-circuits before here.
  if (charityAmount > 0) {
    const giftAidStatus = giftAidDeclarationId
      ? "declared"
      : donorEmail
        ? "eligible"
        : "unknown";
    try {
      await db.addDonation(lodgeId, {
        event_id: eventId,
        payment_id: payment.id,
        donor_name: donorName,
        donor_email: donorEmail,
        amount: charityAmount,
        currency: currencyMajor.toLowerCase(),
        source: "event_charity",
        status: "completed",
        gift_aid_declaration_id: giftAidDeclarationId,
        gift_aid_status: giftAidStatus,
        gift_aid_eligible_amount: giftAidDeclarationId ? charityAmount : 0,
      });
    } catch (err) {
      console.error("mooov webhook: event charity donation insert failed", {
        payment_id: attempt.payment_id,
        message: err instanceof Error ? err.message : String(err),
      });
    }
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

  // Receipt to the payer. Best-effort; idempotent on Mooov payment_id.
  try {
    const lodge = await db.getLodgeById(lodgeId).catch(() => null);
    const member = duesRecord.member_id
      ? await db.getMemberById(duesRecord.member_id, lodgeId).catch(() => null)
      : null;
    const { sendOnlinePaymentReceipt } = await import(
      "@/lib/email/payment-receipts"
    );
    await sendOnlinePaymentReceipt({
      lodgeId,
      lodge,
      toEmail: donorEmail,
      toName: donorName,
      memberId: member?.id ?? null,
      amountMajor: totalMajor,
      currency: currencyMajor,
      kind: "dues_full",
      description: `This receipt covers your full annual dues for the ${lodge?.name ?? "lodge"}.`,
      mooovPaymentId: attempt.payment_id,
      metadata: { dues_id: duesId },
    });
  } catch (err) {
    console.error("mooov webhook: dues receipt email failed", {
      payment_id: attempt.payment_id,
      message: err instanceof Error ? err.message : String(err),
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
//
// Coerce a stored line_items value (off guest_descriptor / metadata JSON)
// back into the projector's LineItemInput[]. Defensive: anything that isn't a
// well-formed array of { category, amount>0 } returns null so the caller
// falls back to the single-category split.
function readLineItems(
  value: unknown,
): { category: string; amount: number }[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const items: { category: string; amount: number }[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const v = raw as Record<string, unknown>;
    const category = typeof v.category === "string" ? v.category : null;
    const amount = Number(v.amount);
    if (!category || !Number.isFinite(amount) || amount <= 0) continue;
    items.push({ category, amount });
  }
  return items.length > 0 ? items : null;
}

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

  // Itemised take-payment basket (raffle + charity + dining on one QR). The
  // mint route stashes the validated line items on both the guest_descriptor
  // and metadata; we read either so older in-flight QR codes (single amount)
  // simply find nothing here and fall back to the category split below.
  const lineItems = readLineItems(guest.line_items ?? metadata.line_items);
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
    lineItems,
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
    return;
  }

  // Card/QR receipt parity with the cash flow: once the in-person take-payment
  // captures, email the attributed member/guest a confirmation. Scoped to the
  // take-payment terminal (standing-QR intents have their own flows). Sends to
  // the email we recorded for the payer; anonymous QRs have none, so they're
  // skipped. Best-effort + deduped on the mooov payment_id so a webhook
  // redelivery never double-sends. Failures never affect the 200 we owe Mooov.
  if (attempt.intent === "take_payment" && payerEmail) {
    const description =
      typeof metadata.description === "string"
        ? (metadata.description as string)
        : null;
    const recordedByEmail =
      typeof metadata.created_by_email === "string"
        ? (metadata.created_by_email as string)
        : null;
    try {
      await sendTakePaymentReceipt({
        toEmail: payerEmail,
        toName: payerName ?? "Friend of the lodge",
        amountMajor,
        currency: attempt.currency ?? "GBP",
        category,
        reference,
        description,
        paymentMethod: "card_qr",
        recordedByEmail,
        giftAidEligible,
        lodgeId,
        paymentId: attempt.payment_id,
        lineItems,
      });
    } catch (err) {
      console.warn("mooov webhook: take-payment receipt failed (non-fatal)", {
        payment_id: attempt.payment_id,
        message: err instanceof Error ? err.message : String(err),
      });
    }
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

// ---------------------------------------------------------------------------
// subscription.* event handlers (Mooov 2026-06-01 GA)
// ---------------------------------------------------------------------------
//
// Lifecycle:
//   subscription.activated      first invoice paid; we flip status to
//                               active_stripe and stamp customer + PM.
//   subscription.invoice_paid   per-cycle charge succeeded; we mark the
//                               next outstanding instalment paid, project
//                               a public.payments row, attribute charitable
//                               portion / Gift Aid for the cycle.
//   subscription.invoice_failed cycle failed; bump dunning state to
//                               past_due so /admin/dues/schedules and
//                               the member portal can render a fix-card
//                               banner.
//   subscription.canceled       member or admin cancelled the Stripe
//                               Subscription; flip schedule cancelled.
//   subscription.updated        log only; we don't currently surface
//                               mid-flight subscription edits.
//
// Idempotency:
//   * Resolution prefers event.data.subscription_metadata.lp_schedule_id
//     (verbatim from the Stripe Subscription metadata we set on
//     /v1/subscription_checkouts) and falls back to subscription_id ->
//     dues_schedules.mooov_subscription_id. Cross-tenant safe because
//     the resolved schedule's lodge_id MUST match the webhook's lodge.
//   * subscription.activated is idempotent on schedule.status (already
//     active_stripe = noop). Redeliveries are common around the
//     incomplete -> active transition.
//   * subscription.invoice_paid is idempotent on the synthetic
//     mooov_payment_id we form from the invoice id (sub_inv_<invoiceId>);
//     getPaymentByMooovId() is the dedupe gate.

type MooovSubscriptionEventData = {
  subscriptionId: string | null;
  stripeSubscriptionId: string | null;
  subscriptionStatus: string | null;
  invoiceId: string | null;
  amount: number | null;
  currency: string;
  paymentMethodId: string | null;
  stripeCustomerId: string | null;
  metadata: Record<string, unknown>;
  cancelReason: string | null;
};

function readSubscriptionEvent(event: MooovConnectEvent): MooovSubscriptionEventData {
  const data = event.data ?? {};
  const metadata =
    data.subscription_metadata && typeof data.subscription_metadata === "object"
      ? (data.subscription_metadata as Record<string, unknown>)
      : {};
  return {
    subscriptionId:
      typeof data.subscription_id === "string" ? data.subscription_id : null,
    stripeSubscriptionId:
      typeof data.stripe_subscription_id === "string"
        ? data.stripe_subscription_id
        : null,
    subscriptionStatus:
      typeof data.subscription_status === "string"
        ? data.subscription_status
        : null,
    invoiceId:
      typeof data.invoice_id === "string"
        ? data.invoice_id
        : typeof data.stripe_invoice_id === "string"
          ? (data.stripe_invoice_id as string)
          : null,
    amount: typeof data.amount === "number" ? data.amount : null,
    currency:
      typeof data.currency === "string" ? data.currency.toUpperCase() : "GBP",
    paymentMethodId:
      typeof data.payment_method_id === "string" ? data.payment_method_id : null,
    stripeCustomerId:
      typeof data.stripe_customer_id === "string"
        ? data.stripe_customer_id
        : null,
    metadata,
    cancelReason:
      typeof data.cancel_reason === "string" ? (data.cancel_reason as string) : null,
  };
}

async function resolveSubscriptionSchedule(
  lodgeId: string,
  parsed: MooovSubscriptionEventData,
  eventId: string,
) {
  const lpScheduleId =
    typeof parsed.metadata.lp_schedule_id === "string"
      ? parsed.metadata.lp_schedule_id
      : null;

  let schedule =
    lpScheduleId != null
      ? await db.getDuesSchedule(lpScheduleId, lodgeId).catch(() => null)
      : null;

  if (!schedule && parsed.subscriptionId) {
    const bySubId = await db
      .getDuesScheduleByMooovSubscriptionId(parsed.subscriptionId)
      .catch(() => null);
    if (bySubId && bySubId.lodge_id === lodgeId) {
      schedule = bySubId;
    } else if (bySubId && bySubId.lodge_id !== lodgeId) {
      console.error(
        "mooov webhook subscription: schedule lodge mismatch — refusing to project",
        {
          event_id: eventId,
          subscription_id: parsed.subscriptionId,
          schedule_lodge_id: bySubId.lodge_id,
          webhook_lodge_id: lodgeId,
        },
      );
      return null;
    }
  }

  if (!schedule) {
    console.warn("mooov webhook subscription: no LP schedule found", {
      event_id: eventId,
      subscription_id: parsed.subscriptionId,
      lp_schedule_id: lpScheduleId,
    });
    return null;
  }

  return schedule;
}

async function handleSubscriptionEvent(
  lodgeId: string,
  event: MooovConnectEvent,
): Promise<void> {
  const parsed = readSubscriptionEvent(event);
  let schedule = await resolveSubscriptionSchedule(lodgeId, parsed, event.id);
  if (!schedule) return;

  // Terminal-state guard. Once a schedule has been cancelled or completed,
  // late webhooks from Mooov MUST NOT mutate it. Without this, a
  // `subscription.invoice_failed` arriving after a member self-cancel
  // resurrects the row to `past_due` (and the members-list "Online" pill
  // lights up again).
  //
  // EXCEPTION — resurrection. A schedule we cancelled via a SOFT system
  // actor (the abandoned-checkout sweep, an enrolment-retry supersede,
  // etc.) is not truly dead: it means "we gave up waiting, assuming the
  // member never paid". If Mooov later sends `subscription.activated` or
  // `subscription.invoice_paid` for that exact schedule, that is ground
  // truth that the subscription IS live on Stripe and the member WAS
  // charged. In that case we resurrect the row (clear cancelled_at /
  // cancelled_by_actor, drop back to `pending`) and let the normal
  // handler project it. This is exactly the 2026-06-02 incident: the
  // 30-min sweep cancelled a schedule whose £24 first charge had in fact
  // captured on Stripe, before Mooov's (then-broken) webhook arrived.
  //
  // We only resurrect SOFT system cancels — never a genuine `member` /
  // admin / `stripe_subscription_canceled` cancellation. `subscription.
  // canceled` still flows through untouched so its own handler runs.
  const isLiveProof =
    event.type === "subscription.activated" ||
    event.type === "subscription.invoice_paid";
  const softSystemCancel =
    typeof schedule.cancelled_by_actor === "string" &&
    schedule.cancelled_by_actor.startsWith("system_");

  if (
    (schedule.status === "cancelled" || schedule.status === "completed") &&
    event.type !== "subscription.canceled"
  ) {
    if (isLiveProof && softSystemCancel) {
      console.warn(
        "mooov webhook: resurrecting soft-cancelled schedule on live subscription event",
        {
          event_id: event.id,
          event_type: event.type,
          schedule_id: schedule.id,
          prior_status: schedule.status,
          prior_cancelled_by_actor: schedule.cancelled_by_actor,
        },
      );
      await db.updateDuesSchedule(schedule.id, lodgeId, {
        status: "pending",
        cancelled_at: null,
        cancelled_by_actor: null,
      });
      schedule = {
        ...schedule,
        status: "pending",
        cancelled_at: null,
        cancelled_by_actor: null,
      };
      // fall through to the switch and project normally
    } else {
      console.warn(
        "mooov webhook: ignoring event for terminal schedule (idempotent)",
        {
          event_id: event.id,
          event_type: event.type,
          schedule_id: schedule.id,
          schedule_status: schedule.status,
          cancelled_at: schedule.cancelled_at,
        },
      );
      return;
    }
  }

  switch (event.type) {
    case "subscription.activated":
      await handleSubscriptionActivated(lodgeId, schedule, parsed, event.id);
      return;
    case "subscription.invoice_paid":
      await handleSubscriptionInvoicePaid(lodgeId, schedule, parsed, event.id);
      return;
    case "subscription.invoice_failed":
      await handleSubscriptionInvoiceFailed(lodgeId, schedule, parsed, event.id);
      return;
    case "subscription.canceled":
      await handleSubscriptionCanceled(lodgeId, schedule, parsed, event.id);
      return;
    case "subscription.updated":
      console.log("mooov webhook: subscription.updated (log-only)", {
        event_id: event.id,
        schedule_id: schedule.id,
        subscription_status: parsed.subscriptionStatus,
      });
      return;
  }
}

async function handleSubscriptionActivated(
  lodgeId: string,
  schedule: db.DuesSchedule,
  parsed: MooovSubscriptionEventData,
  eventId: string,
): Promise<void> {
  if (schedule.status === "active_stripe") {
    console.log(
      "mooov webhook: subscription.activated already projected (idempotent)",
      { event_id: eventId, schedule_id: schedule.id },
    );
    return;
  }

  await db.updateDuesSchedule(schedule.id, lodgeId, {
    status: "active_stripe",
    mooov_payment_method_id:
      parsed.paymentMethodId ?? schedule.mooov_payment_method_id,
    stripe_customer_id:
      parsed.stripeCustomerId ?? schedule.stripe_customer_id,
    last_charged_at: new Date().toISOString(),
    consecutive_failures: 0,
    last_failure_code: null,
    last_failure_category: null,
    last_failure_at: null,
  });

  // Auto-tag the underlying member_dues row as 'online_subscription'
  // so the treasurer dashboard / member-list pill / reports breakdown
  // all reflect reality without the admin having to manually mark it.
  // Only overwrite NULL or already-online tags — never clobber an
  // explicit BACS / paid_in_full / fee_waived tag the admin set.
  let duesRecord: db.MemberDues | null = null;
  try {
    duesRecord = await db.getMemberDuesById(
      schedule.member_dues_id,
      lodgeId,
    );
    if (
      duesRecord &&
      (duesRecord.dues_payment_method == null ||
        duesRecord.dues_payment_method === "online_subscription")
    ) {
      await db.setMemberDuesPaymentMethod(duesRecord.id, lodgeId, {
        method: "online_subscription",
        setBy: "mooov_webhook_subscription_activated",
      });
    }
  } catch (err) {
    console.error("mooov webhook: failed to auto-tag dues_payment_method", {
      schedule_id: schedule.id,
      message: err instanceof Error ? err.message : String(err),
    });
  }

  // Member receipt + treasurer alert. Best-effort — never block the
  // webhook on email infra. Idempotent via the email_log dedupe
  // index keyed off the Mooov subscription_id.
  try {
    const member =
      duesRecord?.member_id != null
        ? await db.getMemberById(duesRecord.member_id, lodgeId).catch(() => null)
        : await db
            .getMemberByEmail(schedule.member_email, lodgeId)
            .catch(() => null);
    const lodge = await db.getLodgeById(lodgeId).catch(() => null);
    if (member && duesRecord) {
      const cycleAmount =
        typeof parsed.amount === "number" && parsed.amount > 0
          ? parsed.amount / 100
          : (() => {
              const meta = (schedule.metadata ?? {}) as Record<string, unknown>;
              const fromMeta =
                typeof meta.cycle_amount === "number"
                  ? (meta.cycle_amount as number)
                  : null;
              return fromMeta ?? 0;
            })();
      const { notifyDuesSubscriptionActivated } = await import(
        "@/lib/email/dues-notifications"
      );
      await notifyDuesSubscriptionActivated({
        lodgeId,
        lodge,
        member: {
          id: member.id,
          email: member.email,
          full_name: member.full_name,
        },
        schedule: {
          id: schedule.id,
          cadence: schedule.cadence,
          mooov_subscription_id: schedule.mooov_subscription_id,
          next_charge_at: schedule.next_charge_at,
        },
        duesRecord: {
          id: duesRecord.id,
          amount: duesRecord.amount,
          currency: duesRecord.currency,
        },
        cycleAmount,
      });
    }
  } catch (err) {
    console.error("mooov webhook: subscription.activated email failed", {
      schedule_id: schedule.id,
      message: err instanceof Error ? err.message : String(err),
    });
  }
}

async function handleSubscriptionInvoicePaid(
  lodgeId: string,
  schedule: db.DuesSchedule,
  parsed: MooovSubscriptionEventData,
  eventId: string,
): Promise<void> {
  // Idempotent on a synthetic mooov_payment_id derived from the invoice
  // id. Mooov dual-emits payment.captured + subscription.invoice_paid
  // for the same money movement, but the payment.captured handler at
  // the top of this file ignores intents we didn't set, so this is
  // the only projection lane for subscription cycles.
  const syntheticPaymentId = parsed.invoiceId
    ? `sub_inv_${parsed.invoiceId}`
    : `sub_evt_${eventId}`;

  const existingPayment = await db
    .getPaymentByMooovId(syntheticPaymentId)
    .catch(() => null);
  if (existingPayment) {
    console.log(
      "mooov webhook: subscription.invoice_paid already projected (idempotent)",
      { event_id: eventId, schedule_id: schedule.id, mooov_payment_id: syntheticPaymentId },
    );
    return;
  }

  const duesRecord = await db.getMemberDuesById(schedule.member_dues_id, lodgeId);
  if (!duesRecord) {
    console.error(
      "mooov webhook: subscription.invoice_paid dues record missing",
      { event_id: eventId, dues_id: schedule.member_dues_id, schedule_id: schedule.id },
    );
    return;
  }

  const totalMajor = (parsed.amount ?? 0) / 100;
  const currencyMajor = parsed.currency || "GBP";
  const completedAt = new Date().toISOString();
  const allInstalments = await db.getInstalmentsForDues(duesRecord.id, lodgeId);
  const charitablePerCycle = computeCyclicalCharitable(
    duesRecord.charitable_amount,
    Math.max(allInstalments.length, 1),
  );

  const payment = await db.addPayment(lodgeId, {
    rsvp_id: null,
    event_id: null,
    user_email: duesRecord.member_email,
    user_name: duesRecord.member_name,
    stripe_payment_intent_id: null,
    stripe_charge_id: null,
    stripe_customer_id:
      parsed.stripeCustomerId ?? schedule.stripe_customer_id ?? null,
    mooov_payment_id: syntheticPaymentId,
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

  // Mark the next outstanding instalment paid by sequence. Open-ended
  // schedules can outlive the pre-created in-year cycles; once we run
  // out of outstanding rows we just leave the public.payments row as
  // the per-cycle accounting record (dues_schedules.metadata.cycles_paid
  // is the authoritative count for the UI). No new instalment is
  // forged for renewal cycles -- those will be re-baselined when the
  // next masonic year is configured by the lodge admin.
  const nextOutstanding = allInstalments
    .filter(
      (i) =>
        i.schedule_id === schedule.id &&
        (i.status === "outstanding" || i.status === "overdue"),
    )
    .sort((a, b) => a.sequence - b.sequence)[0];

  if (nextOutstanding) {
    await db.updateInstalment(nextOutstanding.id, lodgeId, {
      status: "paid",
      paid_at: completedAt,
      payment_reference: syntheticPaymentId,
    });
  }

  const remainingAfter = allInstalments
    .filter(
      (i) =>
        i.schedule_id === schedule.id &&
        i.id !== (nextOutstanding?.id ?? "") &&
        (i.status === "outstanding" || i.status === "overdue"),
    )
    .sort((a, b) => a.sequence - b.sequence);

  // Increment cycles_paid in metadata. Open-ended schedules don't have
  // a meaningful cycles_total beyond the in-year baseline, so the UI
  // displays "ongoing" past that.
  const metadata = (schedule.metadata ?? {}) as Record<string, unknown>;
  const priorCyclesPaid =
    typeof metadata.cycles_paid === "number" ? metadata.cycles_paid : 0;

  await db.updateDuesSchedule(schedule.id, lodgeId, {
    status: "active_stripe",
    next_charge_at: remainingAfter[0]?.due_date ?? null,
    last_charged_at: completedAt,
    consecutive_failures: 0,
    last_failure_code: null,
    last_failure_category: null,
    last_failure_at: null,
    metadata: {
      ...metadata,
      cycles_paid: priorCyclesPaid + 1,
      last_invoice_id: parsed.invoiceId,
      last_invoice_amount: totalMajor,
    },
  });

  // Flip the parent member_dues to paid once we've covered the in-year
  // total. For open-ended subscriptions this is when the last
  // pre-created instalment is consumed; subsequent invoices belong to
  // the NEXT masonic year (a lodge admin will spin up the next year's
  // member_dues row separately, or we'll auto-roll it later).
  if (remainingAfter.length === 0) {
    await db.updateMemberDuesStatus(duesRecord.id, lodgeId, {
      status: "paid",
      payment_id: payment.id,
      paid_at: completedAt,
    });
  }

  // Charitable / Gift Aid attribution for the cycle, mirroring the
  // saved-charge cycle projector so the Gift Aid claim batcher sees a
  // donation row dated to the charge.
  if (charitablePerCycle > 0) {
    const declaration = await db.getActiveGiftAidDeclarationByEmail(
      lodgeId,
      duesRecord.member_email,
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

  // Per-cycle receipt to the member. Dedupe on the synthetic
  // mooov_payment_id so a Mooov redeliver of the same invoice can't
  // spam them. Best-effort — book-keeping above is the source of
  // truth.
  try {
    const member =
      duesRecord.member_id != null
        ? await db.getMemberById(duesRecord.member_id, lodgeId).catch(() => null)
        : await db
            .getMemberByEmail(duesRecord.member_email, lodgeId)
            .catch(() => null);
    const lodge = await db.getLodgeById(lodgeId).catch(() => null);
    if (member) {
      const meta = (schedule.metadata ?? {}) as Record<string, unknown>;
      const cyclesTotal =
        typeof meta.cycles_total === "number"
          ? (meta.cycles_total as number)
          : null;
      const cyclePaidNumber =
        (typeof meta.cycles_paid === "number" ? (meta.cycles_paid as number) : 0) + 1;
      const { notifyDuesCyclePaid } = await import(
        "@/lib/email/dues-notifications"
      );
      await notifyDuesCyclePaid({
        lodgeId,
        lodge,
        member: {
          id: member.id,
          email: member.email,
          full_name: member.full_name,
        },
        schedule: { id: schedule.id, cadence: schedule.cadence },
        amountMajor: totalMajor,
        currency: currencyMajor,
        invoiceDedupeKey: syntheticPaymentId,
        cyclePaidNumber,
        cyclesTotal,
        nextChargeAt: remainingAfter[0]?.due_date ?? null,
      });
    }
  } catch (err) {
    console.error("mooov webhook: subscription.invoice_paid email failed", {
      schedule_id: schedule.id,
      message: err instanceof Error ? err.message : String(err),
    });
  }
}

async function handleSubscriptionInvoiceFailed(
  lodgeId: string,
  schedule: db.DuesSchedule,
  parsed: MooovSubscriptionEventData,
  eventId: string,
): Promise<void> {
  const failureCode =
    typeof parsed.metadata.failure_code === "string"
      ? (parsed.metadata.failure_code as string)
      : "subscription_invoice_failed";
  const failureCategory =
    typeof parsed.metadata.failure_category === "string"
      ? (parsed.metadata.failure_category as string)
      : null;

  const nextFailures = schedule.consecutive_failures + 1;
  await db.updateDuesSchedule(schedule.id, lodgeId, {
    status: "past_due",
    consecutive_failures: nextFailures,
    last_failure_code: failureCode,
    last_failure_category: failureCategory,
    last_failure_at: new Date().toISOString(),
  });
  console.warn("mooov webhook: subscription.invoice_failed projected", {
    event_id: eventId,
    schedule_id: schedule.id,
    invoice_id: parsed.invoiceId,
    failure_code: failureCode,
    consecutive_failures: nextFailures,
  });

  // Member nudge on every fail; treasurer escalation at 1, 3, 5.
  try {
    const duesRecord = await db
      .getMemberDuesById(schedule.member_dues_id, lodgeId)
      .catch(() => null);
    const member =
      duesRecord?.member_id != null
        ? await db.getMemberById(duesRecord.member_id, lodgeId).catch(() => null)
        : await db
            .getMemberByEmail(schedule.member_email, lodgeId)
            .catch(() => null);
    const lodge = await db.getLodgeById(lodgeId).catch(() => null);
    if (member) {
      const invoiceDedupeKey =
        parsed.invoiceId ?? `sub_evt_${eventId}_failed`;
      const { notifyDuesCycleFailed } = await import(
        "@/lib/email/dues-notifications"
      );
      await notifyDuesCycleFailed({
        lodgeId,
        lodge,
        member: {
          id: member.id,
          email: member.email,
          full_name: member.full_name,
        },
        schedule: {
          id: schedule.id,
          cadence: schedule.cadence,
          mooov_subscription_id: schedule.mooov_subscription_id,
        },
        consecutiveFailures: nextFailures,
        failureCode,
        failureCategory,
        invoiceDedupeKey,
      });
    }
  } catch (err) {
    console.error("mooov webhook: subscription.invoice_failed email failed", {
      schedule_id: schedule.id,
      message: err instanceof Error ? err.message : String(err),
    });
  }
}

async function handleSubscriptionCanceled(
  lodgeId: string,
  schedule: db.DuesSchedule,
  parsed: MooovSubscriptionEventData,
  eventId: string,
): Promise<void> {
  if (schedule.status === "cancelled") {
    console.log(
      "mooov webhook: subscription.canceled already projected (idempotent)",
      { event_id: eventId, schedule_id: schedule.id },
    );
    return;
  }

  await db.updateDuesSchedule(schedule.id, lodgeId, {
    status: "cancelled",
    cancelled_at: new Date().toISOString(),
    cancelled_by_actor: parsed.cancelReason ?? "stripe_subscription_canceled",
    next_charge_at: null,
  });

  try {
    const member = await db
      .getMemberByEmail(schedule.member_email, lodgeId)
      .catch(() => null);
    const lodge = await db.getLodgeById(lodgeId).catch(() => null);
    if (member) {
      const { notifyDuesSubscriptionCanceled } = await import(
        "@/lib/email/dues-notifications"
      );
      await notifyDuesSubscriptionCanceled({
        lodgeId,
        lodge,
        member: {
          id: member.id,
          email: member.email,
          full_name: member.full_name,
        },
        schedule: {
          id: schedule.id,
          mooov_subscription_id: schedule.mooov_subscription_id,
        },
        cancelReason: parsed.cancelReason ?? null,
      });
    }
  } catch (err) {
    console.error("mooov webhook: subscription.canceled email failed", {
      schedule_id: schedule.id,
      message: err instanceof Error ? err.message : String(err),
    });
  }
}
