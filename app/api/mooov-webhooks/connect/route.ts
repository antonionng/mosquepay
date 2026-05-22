import { type NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { verifyMooovWebhook } from "@/lib/mooov";
import * as db from "@/lib/db";
import { sendGuestWelcomeEmail } from "@/lib/email/guest";

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

      await supa
        .schema("mooov")
        .from("payment_attempts")
        .update({
          status: "failed",
          failure_reason: failureReason,
        })
        .eq("lodge_id", lodgeId)
        .eq("payment_id", paymentId);

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
