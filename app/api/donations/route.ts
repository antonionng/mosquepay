// GET  /api/donations  -- list donations for the current lodge (admin)
// POST /api/donations  -- create a hosted donation checkout via Mooov
//
// POST flow (Mooov-only; no Stripe fallback by design):
//   1. Resolve LodgePay lodge id from the request (subdomain/slug).
//   2. Resolve the Mooov merchant id for that lodge from mooov.lodges.
//      If the lodge has not connected Mooov yet, return HTTP 503 with a
//      structured error -- this is the user-facing message the donate page
//      surfaces. We deliberately do NOT fall back to direct-Stripe: per
//      product direction, every payment surface runs through Mooov so the
//      lodge's PSP (connected via Mooov Connect) is the settlement target.
//   3. Persist a preflight mooov.payment_attempts row keyed on payment_id
//      (intent='donation'), with donor + gift-aid info on guest_descriptor
//      so the Mooov webhook handler can project it into LP donations /
//      payments / gift_aid_declarations when payment.succeeded arrives.
//   4. POST /v1/payment_intents with flow="redirect" + success/cancel URLs
//      + customer_email. Mooov returns a hosted Stripe Checkout URL on the
//      lodge's connected account. We persist hosted_url on payment_attempts
//      and return {url} for the client to window.location.assign.

import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import * as db from "@/lib/db";
import { getLodgeSlugFromRequest, getDefaultLodgeSlug } from "@/lib/tenant";
import { requireAdminApiAuth, requireAdminApiPermission } from "@/lib/auth/api";
import { createServiceClient } from "@/lib/supabase/server";
import { callMooovConnect, MooovApiError } from "@/lib/mooov";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const unauthorized = await requireAdminApiAuth();
    if (unauthorized) return unauthorized;

    if (!isSupabaseConfigured()) {
      return NextResponse.json({ donations: [] });
    }

    const lodgeSlug = getLodgeSlugFromRequest(request);
    const lodgeId = await db.resolveLodgeId(lodgeSlug);
    if (!lodgeId) {
      return NextResponse.json({ error: "Lodge not found." }, { status: 404 });
    }
    const forbidden = await requireAdminApiPermission("charity:write", lodgeId);
    if (forbidden) return forbidden;

    const donations = await db.getDonations(lodgeId);
    return NextResponse.json({ donations });
  } catch (e) {
    console.error("Donations GET error:", e);
    return NextResponse.json(
      { error: "Failed to fetch donations." },
      { status: 500 }
    );
  }
}

interface PaymentIntentResponse {
  payment_id: string;
  state: "authorized" | "captured" | "processing" | "failed";
  provider?: {
    provider: string;
    provider_ref?: string;
    hosted_url?: string;
  };
}

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
  // status='revoked' means the lodge admin disconnected Mooov via the OAuth
  // grant.revoked webhook; treat as not-connected so the donor sees the
  // same friendly 503 as a never-connected lodge.
  if (data.status && data.status !== "active") return null;
  return data.merchant_id ?? null;
}

export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Donations are not configured." },
      { status: 503 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const amount = Number(body.amount);
  const donorEmail = typeof body.donor_email === "string" ? body.donor_email.trim() : "";
  const donorName = typeof body.donor_name === "string" ? body.donor_name.trim() : "";
  const giftAid = body.gift_aid === true || body.gift_aid === "true";
  const giftAidConfirmed =
    body.gift_aid_confirmed === true || body.gift_aid_confirmed === "true";
  const giftAidAddressLine1 =
    typeof body.gift_aid_address_line_1 === "string"
      ? body.gift_aid_address_line_1.trim()
      : "";
  const giftAidAddressLine2 =
    typeof body.gift_aid_address_line_2 === "string"
      ? body.gift_aid_address_line_2.trim()
      : "";
  const giftAidCity =
    typeof body.gift_aid_city === "string" ? body.gift_aid_city.trim() : "";
  const giftAidPostcode =
    typeof body.gift_aid_postcode === "string" ? body.gift_aid_postcode.trim() : "";

  if (!donorEmail || !Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json(
      { error: "Valid email and donation amount are required." },
      { status: 400 }
    );
  }
  if (giftAid && (!giftAidConfirmed || !giftAidAddressLine1 || !giftAidCity || !giftAidPostcode)) {
    return NextResponse.json(
      { error: "Gift Aid requires confirmed eligibility and a full address." },
      { status: 400 }
    );
  }

  const lodgeSlug = getLodgeSlugFromRequest(request);
  const lodgeId = await db.resolveLodgeId(lodgeSlug);
  if (!lodgeId) {
    return NextResponse.json({ error: "Lodge not found." }, { status: 404 });
  }

  let supa: ReturnType<typeof createServiceClient>;
  try {
    supa = createServiceClient();
  } catch (err) {
    console.error("Donations POST: supabase service client unavailable", {
      message: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: "Donations are not configured." },
      { status: 503 }
    );
  }

  let merchantId: string | null;
  try {
    merchantId = await loadMooovMerchant(supa, lodgeId);
  } catch (err) {
    console.error("Donations POST: mooov merchant lookup failed", {
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
          "This lodge has not finished setting up online donations yet. Please contact the lodge directly.",
        code: "lodge_not_connected",
      },
      { status: 503 }
    );
  }

  // amount comes in pounds (e.g. 25.00). Mooov takes minor units (pence).
  const amountMinor = Math.round(amount * 100);
  const currency = "GBP";
  const paymentId = `don_${lodgeId}_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 10)}`;
  const idempotencyKey = `don_${paymentId}`;

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const lodgeQuery =
    lodgeSlug === getDefaultLodgeSlug()
      ? ""
      : `&lodge=${encodeURIComponent(lodgeSlug)}`;
  const successUrl = `${siteUrl}/events/rsvp/success?payment_id=${encodeURIComponent(
    paymentId
  )}&type=donation${lodgeQuery}`;
  const cancelUrl = `${siteUrl}/donate${
    lodgeSlug === getDefaultLodgeSlug() ? "" : `?lodge=${encodeURIComponent(lodgeSlug)}`
  }`;
  const description = donorName
    ? `Donation from ${donorName}`
    : "Donation";

  // Stash everything the Mooov webhook handler will need to project this
  // donation into the LP-side donations / payments / gift_aid_declarations
  // tables. We persist BEFORE talking to Mooov so a Mooov 5xx never leaves
  // a charged-but-unrecorded donation in production.
  const guestDescriptor: Record<string, unknown> = {
    source: "online_donation",
    donor_email: donorEmail,
    donor_name: donorName || null,
    lodge_slug: lodgeSlug,
    gift_aid: giftAid,
    ...(giftAid
      ? {
          gift_aid_address_line_1: giftAidAddressLine1,
          gift_aid_address_line_2: giftAidAddressLine2 || null,
          gift_aid_city: giftAidCity,
          gift_aid_postcode: giftAidPostcode,
        }
      : {}),
  };
  const initialMetadata: Record<string, unknown> = {
    source: "lodgepay_donate_form",
    lodge_slug: lodgeSlug,
    lodge_id: lodgeId,
    intent: "donation",
  };
  const { error: insertError } = await supa
    .schema("mooov")
    .from("payment_attempts")
    .insert({
      payment_id: paymentId,
      lodge_id: lodgeId,
      member_id: null,
      amount: amountMinor,
      currency,
      intent: "donation",
      status: "pending",
      idempotency_key: idempotencyKey,
      metadata: initialMetadata,
      guest_descriptor: guestDescriptor,
    });
  if (insertError) {
    console.error("Donations POST: preflight insert failed", {
      lodge_id: lodgeId,
      payment_id: paymentId,
      code: insertError.code,
      message: insertError.message,
      details: insertError.details,
      hint: insertError.hint,
    });
    return NextResponse.json(
      {
        error: "Could not start donation.",
        payment_id: paymentId,
        db_code: insertError.code ?? null,
      },
      { status: 500 }
    );
  }

  try {
    const result = await callMooovConnect<PaymentIntentResponse>(
      "POST",
      "/v1/payment_intents",
      {
        merchant: merchantId,
        idempotencyKey,
        body: {
          payment_id: paymentId,
          amount: amountMinor,
          currency,
          flow: "redirect",
          success_url: successUrl,
          cancel_url: cancelUrl,
          description,
          customer_email: donorEmail,
          metadata: {
            intent: "donation",
            lodge_id: lodgeId,
            lodge_slug: lodgeSlug,
          },
        },
      }
    );

    const hostedUrl = result.provider?.hosted_url ?? null;
    if (!hostedUrl) {
      console.error("Donations POST: Mooov returned no hosted_url", {
        payment_id: paymentId,
        state: result.state,
        provider: result.provider?.provider ?? null,
      });
      return NextResponse.json(
        { error: "Payment processor did not return a checkout URL." },
        { status: 502 }
      );
    }

    const persistedMetadata: Record<string, unknown> = {
      ...initialMetadata,
      hosted_url: hostedUrl,
    };
    const { error: updateError } = await supa
      .schema("mooov")
      .from("payment_attempts")
      .update({
        status: result.state,
        provider_ref: result.provider?.provider_ref ?? null,
        metadata: persistedMetadata,
      })
      .eq("payment_id", paymentId);
    if (updateError) {
      // Mooov already minted a Stripe Checkout session at this point. We log
      // loudly and still return the URL so the donor isn't blocked; the
      // payment.succeeded webhook gives us a second chance to reconcile.
      console.error("Donations POST: post-mint update failed (will rely on webhook)", {
        payment_id: paymentId,
        code: updateError.code,
        message: updateError.message,
      });
    }

    return NextResponse.json({ url: hostedUrl, payment_id: paymentId });
  } catch (err) {
    if (err instanceof MooovApiError) {
      console.error("Donations POST: Mooov call failed", {
        payment_id: paymentId,
        category: err.category,
        status: err.status,
      });
      // Persist the failure so a retry doesn't silently re-call Mooov with
      // the same idempotency key and a non-error response is needed for
      // observability.
      await supa
        .schema("mooov")
        .from("payment_attempts")
        .update({
          status: "failed",
          failure_reason: err.category,
        })
        .eq("payment_id", paymentId);
      if (err.category === "merchant_setup_required" && err.setupHint) {
        return NextResponse.json(
          {
            error:
              "This lodge has not finished setting up online donations yet. Please contact the lodge directly.",
            code: "lodge_setup_incomplete",
            setup_url: err.setupHint.setupUrl,
          },
          { status: 503 }
        );
      }
      return NextResponse.json(
        { error: "Could not create donation session.", code: err.category },
        { status: 502 }
      );
    }
    console.error("Donations POST unexpected error:", err);
    await supa
      .schema("mooov")
      .from("payment_attempts")
      .update({ status: "failed", failure_reason: "unexpected_error" })
      .eq("payment_id", paymentId);
    return NextResponse.json(
      { error: "Could not create donation session." },
      { status: 500 }
    );
  }
}
