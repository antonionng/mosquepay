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
//   * mode = "one_off" (default): single hosted Checkout charge.
//   * mode = "subscription": currently 501. Mooov ships
//     `mode:"subscription"` on flow="redirect" next sprint; the body shape
//     here is forward-compatible (we already stash instalment_count /
//     interval on guest_descriptor) so the switch will be a small follow-up.
import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import * as db from "@/lib/db";
import { getDefaultLodgeSlug, getLodgeSlugFromRequest } from "@/lib/tenant";
import { createServiceClient } from "@/lib/supabase/server";
import { callMooovConnect, MooovApiError } from "@/lib/mooov";

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
      // TODO(phase-5): Mooov ships `mode:"subscription"` on flow="redirect"
      // next sprint per the 2026-05-21 reply. When it lands, plumb
      // lodge_dues.instalment_count / instalment_frequency into the body
      // and remove this 501.
      return NextResponse.json(
        {
          error:
            "Instalment payments are temporarily unavailable. Please pay in full or contact your lodge secretary.",
          code: "subscriptions_not_supported_yet",
        },
        { status: 501 }
      );
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
