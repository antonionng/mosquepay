// POST /api/give/kiosk
//
// Public, auth-less mint endpoint for the self-service giving kiosk
// (/give/<slug>/kiosk). A giver standing at the church tablet enters an
// amount + purpose, optionally their details and a digital Gift Aid
// declaration, and this route mints a Mooov payment_intent and returns the
// hosted_url for the kiosk to render as an on-screen QR code.
//
// Auth: none (the kiosk is a public page, like the /give standing-QR flow).
// Safety rails: active church + active Mooov merchant required, £1-£5,000
// amount window, per-IP+church rate limit, and Gift Aid requires full donor
// details so we never mint half-formed declarations.
//
// Persistence: preflight mooov.payment_attempts row with intent
// 'kiosk_giving'; the Mooov webhook projects success into public.payments
// (and donations + gift_aid_declarations when Gift Aid was consented).

import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import { createServiceClient } from "@/lib/supabase/server";
import { callMooovConnect, MooovApiError } from "@/lib/mooov";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PURPOSES = ["tithe", "offering", "charity", "general"] as const;
type KioskPurpose = (typeof PURPOSES)[number];

const PURPOSE_LABELS: Record<KioskPurpose, string> = {
  tithe: "Tithe",
  offering: "Offering",
  charity: "Charity gift",
  general: "General giving",
};

const MIN_AMOUNT = 1;
const MAX_AMOUNT = 5000;

// Simple in-memory rate limiter. Good enough for a single-region deployment:
// the goal is to stop a bored teenager hammering the mint button, not to be
// a distributed abuse system. Mooov-side merchant limits are the backstop.
const RATE_WINDOW_MS = 60_000;
const RATE_MAX_PER_WINDOW = 12;
const rateBuckets = new Map<string, { count: number; resetAt: number }>();

function rateLimited(key: string): boolean {
  const now = Date.now();
  const bucket = rateBuckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    rateBuckets.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }
  bucket.count += 1;
  if (rateBuckets.size > 5000) rateBuckets.clear();
  return bucket.count > RATE_MAX_PER_WINDOW;
}

function trimOrNull(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

type KioskDonor = {
  full_name: string;
  email: string | null;
  phone: string | null;
};

type KioskGiftAid = {
  address_line_1: string;
  address_line_2: string | null;
  city: string;
  postcode: string;
};

interface PaymentIntentResponse {
  payment_id: string;
  state: "authorized" | "captured" | "processing" | "failed";
  provider?: {
    provider: string;
    provider_ref?: string;
    hosted_url?: string;
  };
  checkout_session_id?: string;
}

export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Self-service giving is not configured." },
      { status: 503 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const slug = trimOrNull(body.church)?.toLowerCase() ?? null;
  if (!slug) {
    return NextResponse.json({ error: "Missing church." }, { status: 400 });
  }

  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount < MIN_AMOUNT) {
    return NextResponse.json(
      { error: `The minimum gift on the kiosk is £${MIN_AMOUNT}.` },
      { status: 400 },
    );
  }
  if (amount > MAX_AMOUNT) {
    return NextResponse.json(
      {
        error: `Amounts above £${MAX_AMOUNT.toLocaleString("en-GB")} cannot be taken on the kiosk. Please speak to the church treasurer.`,
      },
      { status: 400 },
    );
  }

  const purposeRaw = trimOrNull(body.purpose) ?? "general";
  if (!PURPOSES.includes(purposeRaw as KioskPurpose)) {
    return NextResponse.json({ error: "Unknown purpose." }, { status: 400 });
  }
  const purpose = purposeRaw as KioskPurpose;

  // Donor details. Optional (anonymous giving is allowed) but when present
  // a name is required, and Gift Aid additionally requires email + address.
  let donor: KioskDonor | null = null;
  if (body.donor && typeof body.donor === "object") {
    const d = body.donor as Record<string, unknown>;
    const fullName = trimOrNull(d.full_name);
    if (fullName) {
      donor = {
        full_name: fullName,
        email: trimOrNull(d.email)?.toLowerCase() ?? null,
        phone: trimOrNull(d.phone),
      };
    }
  }

  let giftAid: KioskGiftAid | null = null;
  if (body.gift_aid && typeof body.gift_aid === "object") {
    const g = body.gift_aid as Record<string, unknown>;
    const confirmed = g.confirmed === true;
    const addressLine1 = trimOrNull(g.address_line_1);
    const city = trimOrNull(g.city);
    const postcode = trimOrNull(g.postcode)?.toUpperCase() ?? null;
    if (!donor || !donor.email) {
      return NextResponse.json(
        { error: "Gift Aid needs your name and email address." },
        { status: 400 },
      );
    }
    if (!confirmed || !addressLine1 || !city || !postcode) {
      return NextResponse.json(
        {
          error:
            "Gift Aid needs your home address, postcode, and the taxpayer confirmation.",
        },
        { status: 400 },
      );
    }
    giftAid = {
      address_line_1: addressLine1,
      address_line_2: trimOrNull(g.address_line_2),
      city,
      postcode,
    };
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown";
  if (rateLimited(`${ip}:${slug}`)) {
    return NextResponse.json(
      { error: "Too many attempts. Please wait a moment and try again." },
      { status: 429 },
    );
  }

  const supa = createServiceClient();

  const { data: church, error: churchError } = await supa
    .from("churches")
    .select("id, slug, name")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle<{ id: string; slug: string; name: string }>();
  if (churchError) {
    console.error("kiosk mint: church lookup failed", {
      slug,
      message: churchError.message,
    });
    return NextResponse.json(
      { error: "Could not look up this church." },
      { status: 500 },
    );
  }
  if (!church) {
    return NextResponse.json({ error: "Church not found." }, { status: 404 });
  }

  const { data: merchant, error: merchantError } = await supa
    .schema("mooov")
    .from("churches")
    .select("merchant_id, status")
    .eq("id", church.id)
    .maybeSingle<{ merchant_id: string; status: string }>();
  if (merchantError) {
    console.error("kiosk mint: mooov merchant lookup failed", {
      church_id: church.id,
      message: merchantError.message,
    });
    return NextResponse.json(
      { error: "Could not look up the payment processor." },
      { status: 500 },
    );
  }
  const merchantId =
    merchant && (!merchant.status || merchant.status === "active")
      ? merchant.merchant_id
      : null;
  if (!merchantId) {
    return NextResponse.json(
      {
        error:
          "This church has not connected its payment processor yet. Please speak to the church team.",
        code: "church_not_connected",
      },
      { status: 503 },
    );
  }

  const amountMinor = Math.round(amount * 100);
  const currency = "GBP";
  const paymentId = `kio_${church.id}_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 10)}`;
  const idempotencyKey = `kio_${paymentId}`;

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  // The cardholder pays on their own phone, so these land on the payer's
  // device, not the kiosk. The kiosk learns the outcome via the status poll.
  const successUrl = `${siteUrl}/take-payment/done?payment_id=${encodeURIComponent(paymentId)}`;
  const cancelUrl = `${siteUrl}/take-payment/cancelled?payment_id=${encodeURIComponent(paymentId)}`;
  const description = `${PURPOSE_LABELS[purpose]} to ${church.name}`;

  const initialMetadata: Record<string, unknown> = {
    source: "churchpay_kiosk",
    church_slug: church.slug,
    church_id: church.id,
    intent: "kiosk_giving",
    category: purpose,
    purpose,
    description,
    created_at_iso: new Date().toISOString(),
    payer_name: donor?.full_name ?? null,
    payer_email: donor?.email ?? null,
    gift_aid: Boolean(giftAid),
  };

  const { error: insertError } = await supa
    .schema("mooov")
    .from("payment_attempts")
    .insert({
      payment_id: paymentId,
      church_id: church.id,
      member_id: null,
      amount: amountMinor,
      currency,
      intent: "kiosk_giving",
      status: "pending",
      idempotency_key: idempotencyKey,
      metadata: initialMetadata,
      guest_descriptor: {
        source: "kiosk_self_service",
        church_slug: church.slug,
        purpose,
        category: purpose,
        payer_name: donor?.full_name ?? null,
        payer_email: donor?.email ?? null,
        payer_phone: donor?.phone ?? null,
        // Digital Gift Aid declaration fields. The webhook creates the
        // gift_aid_declarations row from these once payment captures, the
        // same way the charity standing-QR /api/donations flow does.
        gift_aid: Boolean(giftAid),
        gift_aid_address_line_1: giftAid?.address_line_1 ?? null,
        gift_aid_address_line_2: giftAid?.address_line_2 ?? null,
        gift_aid_city: giftAid?.city ?? null,
        gift_aid_postcode: giftAid?.postcode ?? null,
      },
    });
  if (insertError) {
    console.error("kiosk mint: preflight insert failed", {
      church_id: church.id,
      payment_id: paymentId,
      code: insertError.code,
      message: insertError.message,
    });
    return NextResponse.json(
      { error: "Could not start the payment." },
      { status: 500 },
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
          flow: "embedded",
          success_url: successUrl,
          cancel_url: cancelUrl,
          description,
          metadata: {
            intent: "kiosk_giving",
            church_id: church.id,
            church_slug: church.slug,
            category: purpose,
          },
        },
      },
    );

    const hostedUrl = result.provider?.hosted_url ?? null;
    if (!hostedUrl) {
      console.error("kiosk mint: Mooov returned no hosted_url", {
        payment_id: paymentId,
        merchant_id: merchantId,
        state: result.state,
      });
      return NextResponse.json(
        { error: "Payment processor did not return a checkout URL." },
        { status: 502 },
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

    return NextResponse.json({
      url: hostedUrl,
      payment_id: paymentId,
      amount: amountMinor,
      currency,
    });
  } catch (err) {
    if (err instanceof MooovApiError) {
      console.error("kiosk mint: Mooov call failed", {
        payment_id: paymentId,
        category: err.category,
        status: err.status,
      });
      await supa
        .schema("mooov")
        .from("payment_attempts")
        .update({ status: "failed", failure_reason: err.category })
        .eq("payment_id", paymentId);
      return NextResponse.json(
        { error: "Could not create the payment session.", code: err.category },
        { status: 502 },
      );
    }
    console.error("kiosk mint: unexpected error", err);
    await supa
      .schema("mooov")
      .from("payment_attempts")
      .update({ status: "failed", failure_reason: "unexpected_error" })
      .eq("payment_id", paymentId);
    return NextResponse.json(
      { error: "Could not create the payment session." },
      { status: 500 },
    );
  }
}
