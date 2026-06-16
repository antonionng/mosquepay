// POST /api/giving/start
//
// Starts a Mooov payment_intent for a single member due using Mooov Connect.
// MosquePay signs with its platform key and acts on behalf of the mosque merchant
// via the Mooov-Merchant header.

import { type NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { callMooovConnect, MooovApiError } from "@/lib/mooov";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface StartGivingBody {
  mosque_id: string;
  member_id: string;
  amount: number; // minor units (e.g. pence)
  currency: string;
  // Path A: server-driven PM token (Stripe test PM like "pm_card_visa", or a
  // real pm_*/ctok_* minted by the caller). Omit for Path B / Path C.
  payment_method?: string;
  // Path C (Mooov's recommended path, per docs.mooov.money/connect-protocol §4.1):
  // hosted Stripe Checkout via Mooov. Set `flow:"redirect"` + the two URLs and
  // Mooov returns `provider.hosted_url` for the caller to window.location.assign.
  // Keeps MosquePay at PCI SAQ A; 3DS / SCA / Apple Pay / Google Pay / Klarna /
  // iDEAL / SEPA all handled by Stripe on the hosted page.
  flow?: "server" | "redirect";
  // Absolute https URLs (Mooov validates and 400s otherwise; localhost allowed
  // in dev). Required by Mooov when flow="redirect"; we just pass through.
  success_url?: string;
  cancel_url?: string;
  description?: string;
  customer_email?: string;
  // Giving-cycle identifier. When provided, makes the request idempotent on the
  // (mosque_id, member_id, period) tuple: caller-side retries collapse to the
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
  mosqueId: string,
): Promise<string | null> {
  const { data, error } = await supa
    .schema("mooov")
    .from("mosques")
    .select("merchant_id")
    .eq("id", mosqueId)
    .maybeSingle<{ merchant_id: string }>();
  if (error) {
    throw new Error(`unknown mosque ${mosqueId}: ${error.message}`);
  }
  return data?.merchant_id ?? null;
}

async function ensureDemoMosque(
  supa: ReturnType<typeof createServiceClient>,
  mosqueId: string,
): Promise<string | null> {
  const demoMerchant =
    process.env.MOOOV_DEMO_MERCHANT_ID ??
    process.env.MOOOV_DEMO_MOSQUE_ID ??
    process.env.MOOOV_MOSQUE_PILOT_MERCHANT_ID;
  const demoMosqueId = process.env.MOOOV_DEMO_MOSQUE_ID ?? "merch_mosquepay_demo";
  if (!demoMerchant || mosqueId !== demoMosqueId) return null;

  const { error } = await supa.schema("mooov").from("mosques").upsert(
    {
      id: demoMosqueId,
      merchant_id: demoMerchant,
      display_name: "MosquePay demo merchant",
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
    case "invalid_request":
      // 4xx from Mooov that aren't auth/grant/idempotency mean the caller
      // built a malformed request (e.g. flow="redirect" without success_url).
      // Surface as 400 so the caller knows it's THEIR bug, not Mooov down.
      return 400;
    case "unprocessable":
      return 422;
    case "merchant_setup_required":
      return 422;
    case "rate_limited":
      return 429;
    default:
      return 502;
  }
}

// Read the merchant_setup hint persisted onto payment_attempts.metadata by
// the catch branch below. Returned in its on-the-wire (snake_case) shape so
// idempotent replays surface the same setup link the original 422 carried,
// per https://docs.mooov.money/errors/merchant_not_charge_capable.
function persistedSetupHint(
  metadata: Record<string, unknown> | null,
): {
  setup_url: string;
  setup_url_expires_at: string;
  providers: Array<{ id: string; display_name: string; status: string }>;
  message?: string;
  docs_url?: string;
} | null {
  if (!metadata || typeof metadata !== "object") return null;
  const ms = (metadata as Record<string, unknown>).merchant_setup;
  if (!ms || typeof ms !== "object") return null;
  const obj = ms as Record<string, unknown>;
  const setupUrl = typeof obj.setup_url === "string" ? obj.setup_url : null;
  const expiresAt =
    typeof obj.setup_url_expires_at === "string" ? obj.setup_url_expires_at : null;
  if (!setupUrl || !expiresAt) return null;
  return {
    setup_url: setupUrl,
    setup_url_expires_at: expiresAt,
    providers: Array.isArray(obj.providers)
      ? (obj.providers as Array<{ id: string; display_name: string; status: string }>)
      : [],
    message: typeof obj.message === "string" ? obj.message : undefined,
    docs_url: typeof obj.docs_url === "string" ? obj.docs_url : undefined,
  };
}

export async function POST(req: NextRequest) {
  let input: StartGivingBody;
  try {
    input = (await req.json()) as StartGivingBody;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  if (
    !input.mosque_id ||
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
      (await loadMerchant(supa, input.mosque_id)) ??
      (await ensureDemoMosque(supa, input.mosque_id)) ??
      "";
  } catch (err) {
    console.error("mooov credentials lookup failed", {
      mosque_id: input.mosque_id,
      message: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: "mosque credentials not found" },
      { status: 404 },
    );
  }
  if (!merchantId) {
    return NextResponse.json(
      { error: "mosque has not connected Mooov" },
      { status: 409 },
    );
  }

  // Idempotency key: deterministic when caller passes `period`, monotonic
  // (Date.now) otherwise. Deterministic mode lets retries collapse to the
  // same Mooov payment via the unique(mosque_id, idempotency_key) constraint
  // -- preserves payment safety under client retries during a giving cycle.
  const paymentId = input.period
    ? `pay_${input.mosque_id}_${input.member_id}_${input.period}`
    : `pay_${input.mosque_id}_${input.member_id}_${Date.now()}`;
  const idempotencyKey = input.period
    ? `giving_${input.member_id}_${input.period}`
    : `giving_${input.member_id}_${paymentId}`;
  const initialMetadata: Record<string, unknown> = {
    source: input.period ? "mosquepay_giving_start" : "mosquepay_dev_quickstart",
    ...(input.period ? { period: input.period } : {}),
  };

  // Replay short-circuit: in deterministic (period) mode, if this exact
  // (mosque_id, idempotency_key) was already processed, return the persisted
  // state without re-calling Mooov. This is the user-facing contract of
  // idempotency: same input -> same payment.
  if (input.period) {
    const { data: existing, error: lookupError } = await supa
      .schema("mooov")
      .from("payment_attempts")
      .select("payment_id, status, provider_ref, metadata, failure_reason")
      .eq("mosque_id", input.mosque_id)
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle<{
        payment_id: string;
        status: string;
        provider_ref: string | null;
        metadata: Record<string, unknown> | null;
        failure_reason: string | null;
      }>();
    if (lookupError) {
      console.error("giving_start idempotency lookup failed", {
        mosque_id: input.mosque_id,
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
      const setupHint = persistedSetupHint(existing.metadata);
      return NextResponse.json({
        payment_id: existing.payment_id,
        state: existing.status,
        hosted_url: hostedUrl,
        idempotent_replay: true,
        failure_reason: existing.failure_reason,
        ...(setupHint ? { merchant_setup: setupHint } : {}),
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
      mosque_id: input.mosque_id,
      member_id: input.member_id,
      amount: input.amount,
      currency: input.currency,
      intent: "giving",
      status: "pending",
      idempotency_key: idempotencyKey,
      metadata: initialMetadata,
    });
  if (insertError) {
    // 23505 = Postgres unique_violation. Two requests with the same
    // (mosque_id, idempotency_key) raced past the lookup above; the loser
    // should re-read and return the winner's row instead of erroring.
    if (insertError.code === "23505" && input.period) {
      const { data: raced } = await supa
        .schema("mooov")
        .from("payment_attempts")
        .select("payment_id, status, provider_ref, metadata, failure_reason")
        .eq("mosque_id", input.mosque_id)
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
        const setupHint = persistedSetupHint(raced.metadata);
        return NextResponse.json({
          payment_id: raced.payment_id,
          state: raced.status,
          hosted_url: hostedUrl,
          idempotent_replay: true,
          failure_reason: raced.failure_reason,
          ...(setupHint ? { merchant_setup: setupHint } : {}),
        });
      }
    }
    console.error("giving_start preflight insert failed", {
      mosque_id: input.mosque_id,
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
    const mooovBody: Record<string, unknown> = {
      payment_id: paymentId,
      amount: input.amount,
      currency: input.currency,
      metadata: {
        mosquepay_member_id: input.member_id,
        mosque_id: input.mosque_id,
      },
    };
    if (input.payment_method) mooovBody.payment_method = input.payment_method;
    if (input.flow) mooovBody.flow = input.flow;
    if (input.success_url) mooovBody.success_url = input.success_url;
    if (input.cancel_url) mooovBody.cancel_url = input.cancel_url;
    if (input.description) mooovBody.description = input.description;
    if (input.customer_email) mooovBody.customer_email = input.customer_email;
    const result = await callMooovConnect<PaymentIntentResponse>(
      "POST",
      "/v1/payment_intents",
      {
        merchant: merchantId,
        idempotencyKey,
        body: mooovBody,
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
      console.error("giving_start post-authorize update failed", {
        mosque_id: input.mosque_id,
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
        setup_url_expires_at: err.setupHint?.setupUrlExpiresAt ?? null,
      });

      // merchant_not_charge_capable: surface Mooov's single-use, ~1h-TTL setup
      // link so the admin UI can show a "Finish setup on Mooov" CTA. Persist
      // the hint into payment_attempts.metadata.merchant_setup so idempotent
      // replays (and the integrations page query) can recover it later.
      if (err.category === "merchant_setup_required" && err.setupHint) {
        const setupMetadata: Record<string, unknown> = {
          ...initialMetadata,
          merchant_setup: {
            setup_url: err.setupHint.setupUrl,
            setup_url_expires_at: err.setupHint.setupUrlExpiresAt,
            providers: err.setupHint.providers.map((p) => ({
              id: p.id,
              display_name: p.displayName,
              status: p.status,
            })),
            message: err.setupHint.message,
            docs_url: err.setupHint.docsUrl,
            recorded_at: new Date().toISOString(),
          },
        };
        const { error: setupUpdateError } = await supa
          .schema("mooov")
          .from("payment_attempts")
          .update({
            status: "failed",
            failure_reason: "merchant_setup_required",
            metadata: setupMetadata,
          })
          .eq("payment_id", paymentId);
        if (setupUpdateError) {
          console.error("giving_start setup-required update failed", {
            payment_id: paymentId,
            code: setupUpdateError.code,
            message: setupUpdateError.message,
          });
        }
        return NextResponse.json(
          {
            error: "merchant_setup_required",
            payment_id: paymentId,
            merchant_setup: {
              setup_url: err.setupHint.setupUrl,
              setup_url_expires_at: err.setupHint.setupUrlExpiresAt,
              providers: err.setupHint.providers.map((p) => ({
                id: p.id,
                display_name: p.displayName,
                status: p.status,
              })),
              message: err.setupHint.message,
              docs_url: err.setupHint.docsUrl,
            },
          },
          { status: 422 },
        );
      }

      const { error: failUpdateError } = await supa
        .schema("mooov")
        .from("payment_attempts")
        .update({
          status: "failed",
          failure_reason: `${err.category}:${err.status}`,
        })
        .eq("payment_id", paymentId);
      if (failUpdateError) {
        console.error("giving_start failure-status update failed", {
          payment_id: paymentId,
          code: failUpdateError.code,
          message: failUpdateError.message,
        });
      }
      if (err.status === 403 && err.body.includes("MERCHANT_GRANT_REVOKED")) {
        const { data: mosqueConnection } = await supa
          .schema("mooov")
          .from("mosques")
          .select("metadata")
          .eq("id", input.mosque_id)
          .maybeSingle<{ metadata: Record<string, unknown> | null }>();
        const { error: revokeUpdateError } = await supa
          .schema("mooov")
          .from("mosques")
          .update({
            status: "revoked",
            metadata: {
              ...(mosqueConnection?.metadata ?? {}),
              revoked_at: new Date().toISOString(),
              revoked_source: "giving_start",
              revoked_error: "MERCHANT_GRANT_REVOKED",
            },
          })
          .eq("id", input.mosque_id);
        if (revokeUpdateError) {
          console.error("giving_start revoke-status update failed", {
            mosque_id: input.mosque_id,
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
    console.error("giving_start unhandled error", {
      mosque_id: input.mosque_id,
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
