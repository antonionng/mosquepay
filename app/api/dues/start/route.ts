// POST /api/dues/start
//
// Starts a Mooov payment_intent for a single member due. Implements
// Section 6 of mooov3:docs/integrations/lodgepay-mooov-dev-quickstart.md.
//
// Pre-conditions: the lodge_id passed in must already exist in
// mooov.lodges and have a credentials row in mooov.mooov_credentials with
// the API key + secret encrypted under the Vault master key.

import { type NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { callMooov, MooovApiError, type MooovKey } from "@/lib/mooov";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface StartDuesBody {
  lodge_id: string;
  member_id: string;
  amount: number; // minor units (e.g. pence)
  currency: string;
  // Path A: Stripe test PM (e.g. "pm_card_visa"). Omit for Path B
  // (Mooov returns provider.hosted_url for Mollie hosted checkout).
  payment_method?: string;
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

interface MooovKeyRow {
  api_key_id: string;
  api_key_secret: string;
  base_url: string;
  merchant_id: string;
}

async function loadKey(
  supa: ReturnType<typeof createServiceClient>,
  lodgeId: string,
): Promise<{ key: MooovKey; baseUrl: string; merchantId: string }> {
  const { data, error } = await supa
    .schema("mooov")
    .rpc("get_lodge_mooov_key", { p_lodge_id: lodgeId })
    .single<MooovKeyRow>();
  if (error || !data) {
    throw new Error(`unknown lodge ${lodgeId}: ${error?.message ?? "no row"}`);
  }
  return {
    key: { keyId: data.api_key_id, secret: data.api_key_secret },
    baseUrl: data.base_url,
    merchantId: data.merchant_id,
  };
}

function userStatusFor(category: MooovApiError["category"]): number {
  switch (category) {
    case "auth":
      return 502;
    case "idempotency_conflict":
      return 409;
    case "unprocessable":
      return 422;
    case "rate_limited":
      return 429;
    default:
      return 502;
  }
}

export async function POST(req: NextRequest) {
  let input: StartDuesBody;
  try {
    input = (await req.json()) as StartDuesBody;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  if (
    !input.lodge_id ||
    !input.member_id ||
    typeof input.amount !== "number" ||
    !input.currency
  ) {
    return NextResponse.json({ error: "missing required fields" }, { status: 400 });
  }

  let supa: ReturnType<typeof createServiceClient>;
  try {
    supa = createServiceClient();
  } catch (err) {
    console.error("supabase service client unavailable", {
      message: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: "supabase not configured" }, { status: 500 });
  }

  let key: MooovKey;
  let baseUrl: string;
  let merchantId: string;
  try {
    ({ key, baseUrl, merchantId } = await loadKey(supa, input.lodge_id));
  } catch (err) {
    console.error("mooov credentials lookup failed", {
      lodge_id: input.lodge_id,
      message: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: "lodge credentials not found" },
      { status: 404 },
    );
  }

  const paymentId = `pay_${input.lodge_id}_${input.member_id}_${Date.now()}`;
  const idempotencyKey = `dues_${input.member_id}_${paymentId}`;

  await supa.schema("mooov").from("payment_attempts").insert({
    payment_id: paymentId,
    lodge_id: input.lodge_id,
    member_id: input.member_id,
    amount: input.amount,
    currency: input.currency,
    intent: "dues",
    status: "pending",
    idempotency_key: idempotencyKey,
    metadata: { source: "lodgepay_dev_quickstart" },
  });

  try {
    const result = await callMooov<PaymentIntentResponse>(
      baseUrl,
      key,
      "POST",
      "/v1/payment_intents",
      {
        payment_id: paymentId,
        merchant_id: merchantId,
        amount: input.amount,
        currency: input.currency,
        payment_method: input.payment_method,
        metadata: {
          lodgepay_member_id: input.member_id,
          lodge_id: input.lodge_id,
        },
      },
      idempotencyKey,
    );

    await supa
      .schema("mooov")
      .from("payment_attempts")
      .update({
        status: result.state,
        provider_ref: result.provider?.provider_ref ?? null,
        authorized_at: result.state === "authorized" ? new Date().toISOString() : null,
      })
      .eq("payment_id", paymentId);

    return NextResponse.json({
      payment_id: paymentId,
      state: result.state,
      hosted_url: result.provider?.hosted_url ?? null,
    });
  } catch (err) {
    if (err instanceof MooovApiError) {
      // Log only the safe-to-log fields; never the body or headers.
      console.error("mooov call failed", {
        category: err.category,
        status: err.status,
        method: "POST",
        path: "/v1/payment_intents",
      });
      await supa
        .schema("mooov")
        .from("payment_attempts")
        .update({
          status: "failed",
          failure_reason: `${err.category}:${err.status}`,
        })
        .eq("payment_id", paymentId);
      return NextResponse.json(
        { error: err.category, status: err.status },
        { status: userStatusFor(err.category) },
      );
    }
    throw err;
  }
}
