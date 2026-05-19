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
  // Dues-cycle identifier. When provided, makes the request idempotent on the
  // (lodge_id, member_id, period) tuple: caller-side retries collapse to the
  // same payment_id and the same Mooov authorize. When omitted, falls back to
  // a monotonic-time key (smoke tests, ad-hoc charges that should NOT collapse).
  period?: string;
}

// Period must be safe to embed in a payment_id / idempotency_key. Conservative
// charset keeps Mooov server-side validation happy and avoids URL-encoding gotchas.
const PERIOD_RE = /^[A-Za-z0-9_-]{1,40}$/;

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
  if (input.period !== undefined && !PERIOD_RE.test(input.period)) {
    return NextResponse.json(
      { error: "period must match /^[A-Za-z0-9_-]{1,40}$/" },
      { status: 400 },
    );
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

  // Idempotency key: deterministic when caller passes `period`, monotonic
  // (Date.now) otherwise. Deterministic mode lets retries collapse to the
  // same Mooov payment via the unique(lodge_id, idempotency_key) constraint
  // -- preserves payment safety under client retries during a dues cycle.
  const paymentId = input.period
    ? `pay_${input.lodge_id}_${input.member_id}_${input.period}`
    : `pay_${input.lodge_id}_${input.member_id}_${Date.now()}`;
  const idempotencyKey = input.period
    ? `dues_${input.member_id}_${input.period}`
    : `dues_${input.member_id}_${paymentId}`;
  const initialMetadata: Record<string, unknown> = {
    source: input.period ? "lodgepay_dues_start" : "lodgepay_dev_quickstart",
    ...(input.period ? { period: input.period } : {}),
  };

  // Replay short-circuit: in deterministic (period) mode, if this exact
  // (lodge_id, idempotency_key) was already processed, return the persisted
  // state without re-calling Mooov. This is the user-facing contract of
  // idempotency: same input -> same payment.
  if (input.period) {
    const { data: existing, error: lookupError } = await supa
      .schema("mooov")
      .from("payment_attempts")
      .select("payment_id, status, provider_ref, metadata, failure_reason")
      .eq("lodge_id", input.lodge_id)
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle<{
        payment_id: string;
        status: string;
        provider_ref: string | null;
        metadata: Record<string, unknown> | null;
        failure_reason: string | null;
      }>();
    if (lookupError) {
      console.error("dues_start idempotency lookup failed", {
        lodge_id: input.lodge_id,
        idempotency_key: idempotencyKey,
        code: lookupError.code,
        message: lookupError.message,
      });
      return NextResponse.json(
        { error: "idempotency_lookup_failed", db_code: lookupError.code ?? null },
        { status: 500 },
      );
    }
    if (existing) {
      const hostedUrl =
        typeof existing.metadata?.hosted_url === "string"
          ? (existing.metadata.hosted_url as string)
          : null;
      return NextResponse.json({
        payment_id: existing.payment_id,
        state: existing.status,
        hosted_url: hostedUrl,
        idempotent_replay: true,
        failure_reason: existing.failure_reason,
      });
    }
  }

  // Pre-flight: persist the attempt BEFORE talking to Mooov. If this
  // fails (RLS, FK miss on members, network), we must not call Mooov --
  // an authorize without a local row leaves a Mooov payment we can't
  // reconcile and the eventual payment.succeeded webhook will only land
  // in mooov_webhook_events with no payment_attempts row to project to.
  const { error: insertError } = await supa
    .schema("mooov")
    .from("payment_attempts")
    .insert({
      payment_id: paymentId,
      lodge_id: input.lodge_id,
      member_id: input.member_id,
      amount: input.amount,
      currency: input.currency,
      intent: "dues",
      status: "pending",
      idempotency_key: idempotencyKey,
      metadata: initialMetadata,
    });
  if (insertError) {
    // 23505 = Postgres unique_violation. Two requests with the same
    // (lodge_id, idempotency_key) raced past the lookup above; the loser
    // should re-read and return the winner's row instead of erroring.
    if (insertError.code === "23505" && input.period) {
      const { data: raced } = await supa
        .schema("mooov")
        .from("payment_attempts")
        .select("payment_id, status, provider_ref, metadata, failure_reason")
        .eq("lodge_id", input.lodge_id)
        .eq("idempotency_key", idempotencyKey)
        .maybeSingle<{
          payment_id: string;
          status: string;
          provider_ref: string | null;
          metadata: Record<string, unknown> | null;
          failure_reason: string | null;
        }>();
      if (raced) {
        const hostedUrl =
          typeof raced.metadata?.hosted_url === "string"
            ? (raced.metadata.hosted_url as string)
            : null;
        return NextResponse.json({
          payment_id: raced.payment_id,
          state: raced.status,
          hosted_url: hostedUrl,
          idempotent_replay: true,
          failure_reason: raced.failure_reason,
        });
      }
    }
    console.error("dues_start preflight insert failed", {
      lodge_id: input.lodge_id,
      member_id: input.member_id,
      payment_id: paymentId,
      code: insertError.code,
      message: insertError.message,
      details: insertError.details,
      hint: insertError.hint,
    });
    return NextResponse.json(
      {
        error: "preflight_persist_failed",
        payment_id: paymentId,
        db_code: insertError.code ?? null,
        db_hint: insertError.hint ?? null,
      },
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

    // Mooov authorized; persist the new state. If THIS update fails we
    // can't undo the Mooov authorize, so log loudly and still return
    // 200 to the caller (with persisted: false). The eventual
    // payment.succeeded webhook gives us a second chance to reconcile.
    //
    // hosted_url is stashed in metadata so that an idempotent replay (caller
    // retries with the same period) can return the same hosted checkout URL
    // without re-calling Mooov. Without this, the replay would lose the URL.
    const hostedUrl = result.provider?.hosted_url ?? null;
    const persistedMetadata: Record<string, unknown> = {
      ...initialMetadata,
      ...(hostedUrl ? { hosted_url: hostedUrl } : {}),
    };
    const { error: updateError, count: updateCount } = await supa
      .schema("mooov")
      .from("payment_attempts")
      .update(
        {
          status: result.state,
          provider_ref: result.provider?.provider_ref ?? null,
          metadata: persistedMetadata,
          authorized_at:
            result.state === "authorized" ? new Date().toISOString() : null,
          captured_at:
            result.state === "captured" ? new Date().toISOString() : null,
        },
        { count: "exact" },
      )
      .eq("payment_id", paymentId);
    if (updateError || (updateCount ?? 0) === 0) {
      console.error("dues_start post-authorize update failed", {
        lodge_id: input.lodge_id,
        payment_id: paymentId,
        mooov_state: result.state,
        provider_ref: result.provider?.provider_ref ?? null,
        update_count: updateCount ?? null,
        code: updateError?.code ?? null,
        message: updateError?.message ?? null,
      });
    }

    return NextResponse.json({
      payment_id: paymentId,
      state: result.state,
      hosted_url: hostedUrl,
      persisted: !updateError && (updateCount ?? 0) > 0,
      idempotent_replay: false,
    });
  } catch (err) {
    if (err instanceof MooovApiError) {
      console.error("mooov call failed", {
        category: err.category,
        status: err.status,
        method: "POST",
        path: "/v1/payment_intents",
      });
      const { error: failUpdateError } = await supa
        .schema("mooov")
        .from("payment_attempts")
        .update({
          status: "failed",
          failure_reason: `${err.category}:${err.status}`,
        })
        .eq("payment_id", paymentId);
      if (failUpdateError) {
        console.error("dues_start failure-status update failed", {
          payment_id: paymentId,
          code: failUpdateError.code,
          message: failUpdateError.message,
        });
      }
      if (err.status === 403 && err.body.includes("MERCHANT_GRANT_REVOKED")) {
        const { data: lodgeConnection } = await supa
          .schema("mooov")
          .from("lodges")
          .select("metadata")
          .eq("id", input.lodge_id)
          .maybeSingle<{ metadata: Record<string, unknown> | null }>();
        const { error: revokeUpdateError } = await supa
          .schema("mooov")
          .from("lodges")
          .update({
            status: "revoked",
            metadata: {
              ...(lodgeConnection?.metadata ?? {}),
              revoked_at: new Date().toISOString(),
              revoked_source: "dues_start",
              revoked_error: "MERCHANT_GRANT_REVOKED",
            },
          })
          .eq("id", input.lodge_id);
        if (revokeUpdateError) {
          console.error("dues_start revoke-status update failed", {
            lodge_id: input.lodge_id,
            code: revokeUpdateError.code,
            message: revokeUpdateError.message,
          });
        }
      }
      return NextResponse.json(
        { error: err.category, status: err.status, payment_id: paymentId },
        { status: userStatusFor(err.category) },
      );
    }
    console.error("dues_start unhandled error", {
      lodge_id: input.lodge_id,
      payment_id: paymentId,
      err_name: err instanceof Error ? err.name : typeof err,
      err_message: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: "internal_error", payment_id: paymentId },
      { status: 500 },
    );
  }
}
