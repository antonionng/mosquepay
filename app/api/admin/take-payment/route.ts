// POST /api/admin/take-payment
//
// In-person "take a payment" flow for the Treasurer / duty officer. Mints a
// Mooov payment_intent for an arbitrary amount + description, returns the
// hosted_url so the iPad client can render it as a QR for a guest to scan.
//
// Auth: admin with payments:write on the active lodge.
// Persistence: writes a preflight mooov.payment_attempts row with
// intent='take_payment' so the Mooov webhook handler projects success into
// public.payments the same way it does for any other channel.

import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import * as db from "@/lib/db";
import { getLodgeSlugFromRequest } from "@/lib/tenant";
import { requireAdminApiAuth, requireAdminApiPermission } from "@/lib/auth/api";
import { getCurrentAdminContextAny } from "@/lib/auth/permissions";
import { createServiceClient } from "@/lib/supabase/server";
import { callMooovConnect, MooovApiError } from "@/lib/mooov";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
  const unauthorized = await requireAdminApiAuth();
  if (unauthorized) return unauthorized;

  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "In-person payments are not configured." },
      { status: 503 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const amount = Number(body.amount);
  const description =
    typeof body.description === "string" ? body.description.trim() : "";
  const reference =
    typeof body.reference === "string" ? body.reference.trim() : "";
  const category =
    typeof body.category === "string" ? body.category.trim() : "general";
  const memberId =
    typeof body.member_id === "string" && body.member_id.trim()
      ? body.member_id.trim()
      : null;

  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json(
      { error: "A valid amount in pounds is required." },
      { status: 400 },
    );
  }
  if (amount > 5000) {
    // Soft ceiling — in-person hand-to-card payments rarely exceed this and
    // we want a tripwire against a fat-finger £45000 typed at reception.
    return NextResponse.json(
      { error: "Amounts above £5,000 cannot be taken on the in-person flow." },
      { status: 400 },
    );
  }

  const lodgeSlug = getLodgeSlugFromRequest(request);
  const lodgeId = await db.resolveLodgeId(lodgeSlug);
  if (!lodgeId) {
    return NextResponse.json({ error: "Lodge not found." }, { status: 404 });
  }

  const forbidden = await requireAdminApiPermission("payments:write", lodgeId);
  if (forbidden) return forbidden;

  // Capture who is generating this QR so the history view can show
  // "created by Bro. Smith" and so audit trails attribute correctly.
  // Failure to resolve identity is non-fatal; the history just shows
  // "Admin" in that case.
  let createdByEmail: string | null = null;
  let createdByRole: string | null = null;
  try {
    const admin = await getCurrentAdminContextAny(lodgeId);
    createdByEmail = admin?.email ?? null;
    createdByRole = admin?.role ?? null;
  } catch (err) {
    console.warn("Take payment POST: could not resolve admin identity", {
      lodge_id: lodgeId,
      message: err instanceof Error ? err.message : String(err),
    });
  }

  let supa: ReturnType<typeof createServiceClient>;
  try {
    supa = createServiceClient();
  } catch (err) {
    console.error("Take payment POST: supabase service client unavailable", {
      message: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: "In-person payments are not configured." },
      { status: 503 },
    );
  }

  let merchantId: string | null;
  try {
    merchantId = await loadMooovMerchant(supa, lodgeId);
  } catch (err) {
    console.error("Take payment POST: mooov merchant lookup failed", {
      lodge_id: lodgeId,
      message: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: "Could not look up payment processor for this lodge." },
      { status: 500 },
    );
  }
  if (!merchantId) {
    return NextResponse.json(
      {
        error:
          "This lodge has not connected its payment processor yet. Visit Integrations to connect Mooov before taking in-person payments.",
        code: "lodge_not_connected",
      },
      { status: 503 },
    );
  }

  const amountMinor = Math.round(amount * 100);
  const currency = "GBP";
  const paymentId = `tip_${lodgeId}_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 10)}`;
  const idempotencyKey = `tip_${paymentId}`;

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const successUrl = `${siteUrl}/admin/take-payment/done?payment_id=${encodeURIComponent(paymentId)}`;
  const cancelUrl = `${siteUrl}/admin/take-payment?cancelled=${encodeURIComponent(paymentId)}`;
  const intentDescription = description || `Payment to lodge (${reference || "in-person"})`;

  // If the admin has attributed this QR to a specific member we resolve them
  // here so the downstream webhook projector can credit user_name /
  // user_email correctly and we can auto-attach a Gift Aid declaration if
  // one already exists for that member's email on this lodge.
  let memberName: string | null = null;
  let memberEmail: string | null = null;
  let giftAidDeclarationId: string | null = null;
  let giftAidEligible = false;
  if (memberId) {
    try {
      const member = await db.getMemberById(memberId, lodgeId);
      if (member) {
        memberName = member.full_name ?? null;
        memberEmail = member.email ?? null;
        if (memberEmail) {
          try {
            const declaration = await db.getActiveGiftAidDeclarationByEmail(
              lodgeId,
              memberEmail,
            );
            if (declaration) {
              giftAidDeclarationId = declaration.id;
              giftAidEligible = true;
            }
          } catch (err) {
            // Non-fatal; the treasurer can attach Gift Aid manually later.
            console.warn(
              "Take payment POST: gift aid declaration lookup failed",
              {
                lodge_id: lodgeId,
                member_id: memberId,
                message: err instanceof Error ? err.message : String(err),
              },
            );
          }
        }
      }
    } catch (err) {
      console.warn("Take payment POST: member lookup failed", {
        lodge_id: lodgeId,
        member_id: memberId,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const initialMetadata: Record<string, unknown> = {
    source: "lodgepay_take_payment",
    lodge_slug: lodgeSlug,
    lodge_id: lodgeId,
    intent: "take_payment",
    category,
    reference: reference || null,
    description: intentDescription,
    created_by_email: createdByEmail,
    created_by_role: createdByRole,
    created_at_iso: new Date().toISOString(),
    member_id: memberId,
    member_name: memberName,
    member_email: memberEmail,
    gift_aid_declaration_id: giftAidDeclarationId,
    gift_aid_eligible: giftAidEligible,
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
      intent: "take_payment",
      status: "pending",
      idempotency_key: idempotencyKey,
      metadata: initialMetadata,
      guest_descriptor: {
        source: "in_person_take_payment",
        lodge_slug: lodgeSlug,
        reference: reference || null,
        category,
        member_id: memberId,
        member_name: memberName,
        member_email: memberEmail,
        gift_aid_declaration_id: giftAidDeclarationId,
        gift_aid_eligible: giftAidEligible,
      },
    });
  if (insertError) {
    console.error("Take payment POST: preflight insert failed", {
      lodge_id: lodgeId,
      payment_id: paymentId,
      code: insertError.code,
      message: insertError.message,
    });
    return NextResponse.json(
      { error: "Could not start the in-person payment." },
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
          description: intentDescription,
          metadata: {
            intent: "take_payment",
            lodge_id: lodgeId,
            lodge_slug: lodgeSlug,
            category,
            reference: reference || undefined,
          },
        },
      },
    );

    const hostedUrl = result.provider?.hosted_url ?? null;
    if (!hostedUrl) {
      console.error("Take payment POST: Mooov returned no hosted_url", {
        payment_id: paymentId,
        merchant_id: merchantId,
        state: result.state,
        provider: result.provider ?? null,
        full_response: result,
      });
      return NextResponse.json(
        { error: "Payment processor did not return a checkout URL." },
        { status: 502 },
      );
    }

    const persistedMetadata: Record<string, unknown> = {
      ...initialMetadata,
      hosted_url: hostedUrl,
      flow: "embedded",
      checkout_session_id: result.checkout_session_id ?? null,
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
      console.error(
        "Take payment POST: post-mint update failed (will rely on webhook)",
        {
          payment_id: paymentId,
          code: updateError.code,
          message: updateError.message,
        },
      );
    }

    return NextResponse.json({
      url: hostedUrl,
      payment_id: paymentId,
      amount: amountMinor,
      currency,
    });
  } catch (err) {
    if (err instanceof MooovApiError) {
      console.error("Take payment POST: Mooov call failed", {
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
              "This lodge has not finished setting up online payments yet.",
            code: "lodge_setup_incomplete",
            setup_url: err.setupHint.setupUrl,
          },
          { status: 503 },
        );
      }
      return NextResponse.json(
        { error: "Could not create payment session.", code: err.category },
        { status: 502 },
      );
    }
    console.error("Take payment POST unexpected error:", err);
    await supa
      .schema("mooov")
      .from("payment_attempts")
      .update({ status: "failed", failure_reason: "unexpected_error" })
      .eq("payment_id", paymentId);
    return NextResponse.json(
      { error: "Could not create payment session." },
      { status: 500 },
    );
  }
}
