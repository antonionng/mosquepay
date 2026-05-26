// DEPRECATED -- LEGACY STRIPE WEBHOOK HANDLER (frozen 2026-05-21).
//
// As of the Mooov cutover (Phases 1-4), no LodgePay code path mints new
// Stripe Checkout Sessions or PaymentIntents. Every active surface
// (donations, events guest-checkout, member event RSVPs, dues) now goes
// through Mooov -> hosted Stripe Checkout on the lodge's connected PSP,
// projected via app/api/mooov-webhooks/connect/route.ts.
//
// This handler stays alive ONLY to reconcile historical, pre-cutover
// Stripe payments:
//   * checkout.session.completed / payment_intent.payment_failed for any
//     legacy Stripe session that was already in-flight (open browser tab)
//     when the cutover landed.
//   * charge.refunded for refunds issued against historical Stripe-direct
//     payments via the Stripe dashboard.
//
// Plan to delete this file (and the `stripe` npm dep + STRIPE_SECRET_KEY +
// STRIPE_WEBHOOK_SECRET env vars) once we're confident no historical
// Stripe-side reconciliation is still arriving -- conservatively, 90 days
// after the cutover completes. Search for "DEPRECATED -- LEGACY STRIPE
// WEBHOOK HANDLER" to find this comment.
import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import { rejectIfMockDisabled } from "@/lib/db/reject-mock";
import * as db from "@/lib/db";
import * as mockDb from "@/lib/mock-db";
import { resolveLodgeSlug } from "@/lib/tenant";
import Stripe from "stripe";

export async function POST(request: NextRequest) {
  const _rejectMock = rejectIfMockDisabled();
  if (_rejectMock) return _rejectMock;

  const stripeSecret = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripeSecret || !webhookSecret) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  const body = await request.text();
  const sig = request.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    const stripe = new Stripe(stripeSecret, { apiVersion: "2025-02-24.acacia" });
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (e) {
    console.error("Webhook signature verification failed:", e);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // Quiet observability: every Stripe event arriving here is now legacy
  // (no LodgePay code path creates new Stripe-direct charges). Logging
  // the type + id lets ops confirm when the historical reconciliation
  // tail goes to zero, at which point this handler can be deleted (see
  // DEPRECATED comment at top of file).
  console.log("legacy Stripe webhook received", {
    event_id: event.id,
    event_type: event.type,
    livemode: event.livemode,
  });

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case "invoice.paid":
        await handleInvoicePaid(event.data.object as Stripe.Invoice);
        break;
      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
      case "payment_intent.payment_failed":
        await handlePaymentFailed(event.data.object as Stripe.PaymentIntent);
        break;
      case "charge.refunded":
        await handleChargeRefunded(event.data.object as Stripe.Charge);
        break;
      default:
        break;
    }

    return NextResponse.json({ received: true });
  } catch (e) {
    console.error(`Webhook handler error for ${event.type}:`, e);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const paymentIntentId = session.payment_intent as string | null;
  const metadataType = session.metadata?.type;

  if (metadataType === "donation") {
    await handleDonationCompleted(session);
    return;
  }

  if (metadataType === "dues") {
    await handleDuesCompleted(session);
    return;
  }

  if (metadataType === "dues_subscription") {
    await handleDuesSubscriptionStarted(session);
    return;
  }

  await handleRsvpPaymentCompleted(session, paymentIntentId);
}

async function handleRsvpPaymentCompleted(
  session: Stripe.Checkout.Session,
  paymentIntentId: string | null
) {
  const lodgeSlug = resolveLodgeSlug(session.metadata?.lodge_slug);
  const rsvpId = session.metadata?.rsvp_id || null;
  const eventId = session.metadata?.event_id;
  const isStandalone = session.metadata?.standalone === "true";
  const diningTotal = Number(session.metadata?.dining_total ?? 0);
  const meetingFee = Number(session.metadata?.meeting_fee ?? 0);
  const guestTotal = Number(session.metadata?.guest_total ?? 0);
  const charityAmount = Number(session.metadata?.charity_amount ?? 0);
  const raffleAmount = Number(session.metadata?.raffle_amount ?? 0);
  const totalAmount = (session.amount_total ?? 0) / 100;

  if (!eventId || (!rsvpId && !isStandalone)) {
    console.error("Webhook missing event_id or rsvp_id in metadata");
    return;
  }

  const paymentData = {
    rsvp_id: rsvpId,
    event_id: eventId,
    user_email: session.customer_email ?? session.customer_details?.email ?? "",
    user_name: session.metadata?.user_name ?? session.customer_details?.name ?? null,
    stripe_payment_intent_id: paymentIntentId ?? null,
    dining_amount: diningTotal,
    charity_amount: charityAmount,
    raffle_amount: raffleAmount,
    meeting_fee_amount: meetingFee,
    guest_ticket_amount: guestTotal,
    total_amount: totalAmount,
    currency: session.currency?.toUpperCase() ?? "GBP",
    charity_name: null,
    status: "succeeded",
    refund_amount: 0,
    completed_at: new Date().toISOString(),
  };

  if (isSupabaseConfigured()) {
    const lodgeId = await db.resolveLodgeId(lodgeSlug);
    if (!lodgeId) {
      console.error("Webhook: lodge not found for slug", lodgeSlug);
      return;
    }

    if (paymentIntentId) {
      const existing = await db.getPaymentByStripeId(paymentIntentId);
      if (existing) {
        console.log("Webhook: payment already processed (idempotent)", paymentIntentId);
        return;
      }
    }

    const payment = await db.addPayment(lodgeId, {
      ...paymentData,
      stripe_charge_id: null,
      stripe_customer_id: null,
      refund_reason: null,
    });
    if (rsvpId) {
      await db.updateRsvp(rsvpId, lodgeId, {
        payment_id: payment.id,
        payment_completed: true,
        status: "confirmed",
      });
    }

    if (session.metadata?.gift_aid === "true") {
      // Enduring declaration: only insert if we don't already have an
      // active declaration on file for this donor email, otherwise we'd
      // create duplicate Gift Aid rows for every donation.
      const giftAidEmail = session.metadata.gift_aid_donor_email ?? "";
      const existing = giftAidEmail
        ? await db.getActiveGiftAidDeclarationByEmail(lodgeId, giftAidEmail)
        : null;
      if (!existing) {
        await db.addGiftAidDeclaration(lodgeId, {
          donor_name: session.metadata.gift_aid_donor_name ?? "",
          donor_email: giftAidEmail,
          donor_address_line_1: session.metadata.gift_aid_address_line_1 || null,
          donor_address_line_2: session.metadata.gift_aid_address_line_2 || null,
          donor_city: session.metadata.gift_aid_city || null,
          donor_postcode: session.metadata.gift_aid_postcode || null,
          donor_country: "United Kingdom",
          declaration_text:
            "I am a UK taxpayer and understand that if I pay less Income Tax and/or Capital Gains Tax than the amount of Gift Aid claimed on all my donations in that tax year it is my responsibility to pay any difference.",
          declaration_confirmed: true,
          confirmation_method: "online_checkout",
          hmrc_eligible: true,
        });
      }
    }
  } else {
    const payment = mockDb.addPayment({
      ...paymentData,
      lodge_slug: lodgeSlug,
    });
    if (rsvpId) {
      mockDb.updateRsvp(
        rsvpId,
        { payment_id: payment.id, payment_completed: true, status: "confirmed" },
        { lodge_slug: lodgeSlug }
      );
    }
  }
}

async function handleDonationCompleted(session: Stripe.Checkout.Session) {
  if (!isSupabaseConfigured()) return;

  const lodgeSlug = resolveLodgeSlug(session.metadata?.lodge_slug);
  const lodgeId = await db.resolveLodgeId(lodgeSlug);
  if (!lodgeId) {
    console.error("Webhook donation: lodge not found for slug", lodgeSlug);
    return;
  }

  const paymentIntentId = session.payment_intent as string | null;
  if (paymentIntentId) {
    const existing = await db.getPaymentByStripeId(paymentIntentId);
    if (existing) {
      console.log("Webhook: donation payment already processed (idempotent)", paymentIntentId);
      return;
    }
  }

  const amount = Number(session.metadata?.amount ?? 0);
  const donorEmail = session.metadata?.donor_email ?? session.customer_email ?? "";
  const donorName = session.metadata?.donor_name || null;

  const payment = await db.addPayment(lodgeId, {
    rsvp_id: null,
    event_id: null,
    user_email: donorEmail,
    user_name: donorName,
    stripe_payment_intent_id: paymentIntentId,
    stripe_charge_id: null,
    stripe_customer_id: null,
    dining_amount: 0,
    charity_amount: amount,
    raffle_amount: 0,
    meeting_fee_amount: 0,
    guest_ticket_amount: 0,
    total_amount: amount,
    currency: session.currency?.toUpperCase() ?? "GBP",
    charity_name: null,
    status: "succeeded",
    refund_amount: 0,
    refund_reason: null,
    completed_at: new Date().toISOString(),
  });

  let giftAidDeclarationId: string | null = null;
  if (session.metadata?.gift_aid === "true") {
    // Enduring declaration: prefer the donor's existing active declaration
    // (matched on email) over inserting another one. This keeps the
    // gift_aid_declarations table 1-per-donor instead of 1-per-donation.
    const giftAidEmail = session.metadata.gift_aid_donor_email ?? donorEmail;
    const existing = giftAidEmail
      ? await db.getActiveGiftAidDeclarationByEmail(lodgeId, giftAidEmail)
      : null;
    if (existing) {
      giftAidDeclarationId = existing.id;
    } else {
      const declaration = await db.addGiftAidDeclaration(lodgeId, {
        donor_name: session.metadata.gift_aid_donor_name ?? "",
        donor_email: giftAidEmail,
        donor_address_line_1: session.metadata.gift_aid_address_line_1 || null,
        donor_address_line_2: session.metadata.gift_aid_address_line_2 || null,
        donor_city: session.metadata.gift_aid_city || null,
        donor_postcode: session.metadata.gift_aid_postcode || null,
        donor_country: "United Kingdom",
        declaration_text:
          "I am a UK taxpayer and understand that if I pay less Income Tax and/or Capital Gains Tax than the amount of Gift Aid claimed on all my donations in that tax year it is my responsibility to pay any difference.",
        declaration_confirmed: true,
        confirmation_method: "online_checkout",
        hmrc_eligible: true,
      });
      giftAidDeclarationId = declaration.id;
    }
  }

  await db.addDonation(lodgeId, {
    event_id: null,
    payment_id: payment.id,
    donor_name: donorName,
    donor_email: donorEmail,
    amount,
    currency: session.currency ?? "gbp",
    source: "online_donation",
    status: "completed",
    gift_aid_declaration_id: giftAidDeclarationId,
  });
}

async function handleDuesCompleted(session: Stripe.Checkout.Session) {
  if (!isSupabaseConfigured()) return;

  const lodgeSlug = resolveLodgeSlug(session.metadata?.lodge_slug);
  const lodgeId = await db.resolveLodgeId(lodgeSlug);
  if (!lodgeId) {
    console.error("Webhook dues: lodge not found for slug", lodgeSlug);
    return;
  }

  const paymentIntentId = session.payment_intent as string | null;
  if (paymentIntentId) {
    const existing = await db.getPaymentByStripeId(paymentIntentId);
    if (existing) {
      console.log("Webhook: dues payment already processed (idempotent)", paymentIntentId);
      return;
    }
  }

  const duesId = session.metadata?.dues_id;
  if (!duesId) {
    console.error("Webhook dues: missing dues_id in metadata");
    return;
  }

  const duesRecord = (await db.getMemberDues(lodgeId)).find((dues) => dues.id === duesId);
  if (!duesRecord) {
    console.error("Webhook dues: dues record not found", duesId);
    return;
  }

  const amount = Number(session.metadata?.amount ?? duesRecord.amount);
  const payment = await db.addPayment(lodgeId, {
    rsvp_id: null,
    event_id: null,
    user_email: duesRecord.member_email,
    user_name: duesRecord.member_name,
    stripe_payment_intent_id: paymentIntentId,
    stripe_charge_id: null,
    stripe_customer_id: null,
    dining_amount: 0,
    charity_amount: duesRecord.charitable_amount ?? 0,
    raffle_amount: 0,
    meeting_fee_amount: 0,
    guest_ticket_amount: 0,
    total_amount: amount,
    currency: session.currency?.toUpperCase() ?? duesRecord.currency.toUpperCase(),
    charity_name: duesRecord.charitable_amount > 0 ? "Dues charitable portion" : null,
    status: "succeeded",
    refund_amount: 0,
    refund_reason: null,
    completed_at: new Date().toISOString(),
  });

  const declaration =
    duesRecord.charitable_amount > 0
      ? await db.getActiveGiftAidDeclarationByEmail(lodgeId, duesRecord.member_email)
      : null;
  const giftAidStatus = declaration
    ? "declared"
    : duesRecord.charitable_amount > 0
      ? "eligible"
      : "unknown";

  await db.updateMemberDuesStatus(duesId, lodgeId, {
    status: "paid",
    payment_id: payment.id,
    stripe_payment_intent_id: paymentIntentId,
    gift_aid_declaration_id: declaration?.id ?? null,
    gift_aid_status: giftAidStatus,
    gift_aid_eligible_amount: duesRecord.charitable_amount ?? 0,
    paid_at: new Date().toISOString(),
  });

  if (duesRecord.charitable_amount > 0) {
    await db.addDonation(lodgeId, {
      event_id: null,
      payment_id: payment.id,
      donor_name: duesRecord.member_name,
      donor_email: duesRecord.member_email,
      amount: duesRecord.charitable_amount,
      currency: duesRecord.currency.toUpperCase(),
      source: "dues_charitable_portion",
      status: "completed",
      gift_aid_declaration_id: declaration?.id ?? null,
      gift_aid_status: giftAidStatus,
      gift_aid_eligible_amount: declaration ? duesRecord.charitable_amount : 0,
    });
  }
}

async function handleDuesSubscriptionStarted(session: Stripe.Checkout.Session) {
  if (!isSupabaseConfigured()) return;

  const lodgeSlug = resolveLodgeSlug(session.metadata?.lodge_slug);
  const lodgeId = await db.resolveLodgeId(lodgeSlug);
  if (!lodgeId) {
    console.error("Webhook dues subscription: lodge not found for slug", lodgeSlug);
    return;
  }

  const duesId = session.metadata?.dues_id;
  if (!duesId) {
    console.error("Webhook dues subscription: missing dues_id");
    return;
  }

  const subscriptionId = session.subscription as string | null;

  await db.updateMemberDuesStatus(duesId, lodgeId, {
    status: "paid",
    stripe_payment_intent_id: subscriptionId,
    paid_at: new Date().toISOString(),
  });
}

async function handleInvoicePaid(invoice: Stripe.Invoice) {
  if (!isSupabaseConfigured()) return;

  const subscriptionId = typeof invoice.subscription === "string"
    ? invoice.subscription
    : invoice.subscription?.id;

  if (!subscriptionId) return;

  const subscriptionDetails = (invoice as unknown as {
    subscription_details?: { metadata?: Record<string, string> };
  }).subscription_details;
  const subMeta = subscriptionDetails?.metadata;

  if (subMeta?.type !== "dues_subscription") return;

  const lodgeSlug = resolveLodgeSlug(subMeta.lodge_slug);
  const lodgeId = await db.resolveLodgeId(lodgeSlug);
  if (!lodgeId) return;

  const duesId = subMeta.dues_id;
  if (duesId) {
    await db.updateMemberDuesStatus(duesId, lodgeId, {
      status: "paid",
      paid_at: new Date().toISOString(),
    });
  }
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  if (!isSupabaseConfigured()) return;

  const subMeta = subscription.metadata;
  if (subMeta?.type !== "dues_subscription") return;

  const lodgeSlug = resolveLodgeSlug(subMeta.lodge_slug);
  const lodgeId = await db.resolveLodgeId(lodgeSlug);
  if (!lodgeId) return;

  const duesId = subMeta.dues_id;
  if (duesId) {
    await db.updateMemberDuesStatus(duesId, lodgeId, {
      status: "outstanding",
    });
  }
}

async function handlePaymentFailed(paymentIntent: Stripe.PaymentIntent) {
  console.error(
    "Payment failed:",
    paymentIntent.id,
    paymentIntent.last_payment_error?.message ?? "unknown error"
  );

  if (!isSupabaseConfigured()) return;

  const existing = await db.getPaymentByStripeId(paymentIntent.id);
  if (existing && existing.lodge_id) {
    await db.updatePayment(existing.id, existing.lodge_id, {
      status: "failed",
    });
  }
}

async function handleChargeRefunded(charge: Stripe.Charge) {
  console.log("Charge refunded:", charge.id, "amount refunded:", charge.amount_refunded);

  if (!isSupabaseConfigured()) return;

  const paymentIntentId =
    typeof charge.payment_intent === "string"
      ? charge.payment_intent
      : charge.payment_intent?.id;

  if (!paymentIntentId) return;

  const existing = await db.getPaymentByStripeId(paymentIntentId);
  if (existing && existing.lodge_id) {
    const refundAmount = charge.amount_refunded / 100;
    const isFullRefund = charge.refunded;
    await db.updatePayment(existing.id, existing.lodge_id, {
      status: isFullRefund ? "refunded" : "partially_refunded",
      refund_amount: refundAmount,
    });
  }
}
