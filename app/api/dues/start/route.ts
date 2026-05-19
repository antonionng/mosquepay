// POST /api/dues/start
//
// Starts a Mooov payment_intent for a single member due using Mooov Connect.
// LodgePay signs with its platform key and acts on behalf of the lodge merchant
// via the Mooov-Merchant header.

import { type NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { callMooovConnect, MooovApiError } from "@/lib/mooov";

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

async function loadMerchant(
  supa: ReturnType<typeof createServiceClient>,
  lodgeId: string,
): Promise<string | null> {
  const { data, error } = await supa
    .schema("mooov")
    .from("lodges")
    .select("merchant_id")
    .eq("id", lodgeId)
    .maybeSingle<{ merchant_id: string }>();
  if (error) {
    throw new Error(`unknown lodge ${lodgeId}: ${error.message}`);
  }
  return data?.merchant_id ?? null;
}

async function ensureDemoLodge(
  supa: ReturnType<typeof createServiceClient>,
  lodgeId: string,
): Promise<string | null> {
  const demoMerchant =
    process.env.MOOOV_DEMO_MERCHANT_ID ??
    process.env.MOOOV_DEMO_LODGE_ID ??
    process.env.MOOOV_LODGE_PILOT_MERCHANT_ID;
  const demoLodgeId = process.env.MOOOV_DEMO_LODGE_ID ?? "merch_lodgepay_demo";
  if (!demoMerchant || lodgeId !== demoLodgeId) return null;

  const { error } = await supa.schema("mooov").from("lodges").upsert(
    {
      id: demoLodgeId,
      merchant_id: demoMerchant,
      display_name: "LodgePay demo merchant",
      currency: "GBP",
      status: "active",
      metadata: { source: "mooov_connect_staging" },
    },
    { onConflict: "id" }
  );
  if (error) throw error;
  return demoMerchant;
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

  let merchantId: string;
  try {
    merchantId =
      (await loadMerchant(supa, input.lodge_id)) ??
      (await ensureDemoLodge(supa, input.lodge_id)) ??
      "";
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
  if (!merchantId) {
    return NextResponse.json(
      { error: "lodge has not connected Mooov" },
      { status: 409 },
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
    const result = await callMooovConnect<PaymentIntentResponse>(
      "POST",
      "/v1/payment_intents",
      {
        merchant: merchantId,
        idempotencyKey,
        body: {
          payment_id: paymentId,
          amount: input.amount,
          currency: input.currency,
          payment_method: input.payment_method,
          metadata: {
            lodgepay_member_id: input.member_id,
            lodge_id: input.lodge_id,
          },
        },
      }
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
