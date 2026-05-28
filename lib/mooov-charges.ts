// lib/mooov-charges.ts
//
// Adapters for the Mooov saved-charge subscription surface that backs
// LP's monthly dues schedules. Two surfaces:
//
//   1. Enrolment intent — POST /v1/payment_intents with
//      setup_future_usage:"off_session" + customer_ref. Captures the
//      first cycle and saves the card. Reuses callMooovConnect() so
//      auth/idempotency/error handling stays unified.
//
//   2. Saved charge — POST /v1/charges/saved with the persisted
//      payment_method_id. Driven by the daily LP cron.
//
// Both functions are STUBBED until Mooov confirms Q-A through Q-E from
// 2026-05-28 (stripe_customer_id surface, requires_action envelope,
// idempotency replay semantics, SCA resume webhook). The signatures are
// the contracts the rest of LP will compile against; once Mooov replies,
// the call bodies fill in without rippling type changes.

import { callMooovConnect } from "@/lib/mooov";

export type DuesEnrolmentIntentInput = {
  payment_id: string;
  merchant_id: string;
  customer_ref: string;
  customer_email: string;
  amount_minor: number;
  currency: string;
  description: string;
  success_url: string;
  cancel_url: string;
  metadata: Record<string, string>;
  idempotency_key: string;
};

export type DuesEnrolmentIntentResult = {
  payment_id: string;
  state: "authorized" | "captured" | "processing" | "failed";
  hosted_url: string | null;
  checkout_session_id: string | null;
  // Populated on payment.succeeded webhook for the enrolment intent.
  // We do NOT read this synchronously — the L1.1 sync response only
  // returns the redirect URL.
};

/**
 * Mint the Mooov payment intent that captures month 1 AND saves the
 * cardholder PM for future off-session cycles. The saved PM id arrives
 * later on the payment.succeeded webhook for the same payment_id.
 *
 * Mooov spec ref: 2026-05-28 reply, Task L1.1.
 */
export async function createDuesEnrolmentIntent(
  input: DuesEnrolmentIntentInput
): Promise<DuesEnrolmentIntentResult> {
  const result = await callMooovConnect<{
    payment_id: string;
    state: "authorized" | "captured" | "processing" | "failed";
    provider?: { provider: string; provider_ref?: string; hosted_url?: string };
    checkout_session_id?: string;
  }>("POST", "/v1/payment_intents", {
    merchant: input.merchant_id,
    idempotencyKey: input.idempotency_key,
    body: {
      payment_id: input.payment_id,
      amount: input.amount_minor,
      currency: input.currency,
      flow: "redirect",
      success_url: input.success_url,
      cancel_url: input.cancel_url,
      description: input.description,
      customer_email: input.customer_email,
      customer_ref: input.customer_ref,
      setup_future_usage: "off_session",
      metadata: input.metadata,
    },
  });

  return {
    payment_id: result.payment_id,
    state: result.state,
    hosted_url: result.provider?.hosted_url ?? null,
    checkout_session_id: result.checkout_session_id ?? null,
  };
}

export type SavedChargeInput = {
  payment_id: string;
  merchant_id: string;
  customer_ref: string;
  payment_method_id: string;
  amount_minor: number;
  currency: string;
  description: string;
  metadata: Record<string, string>;
  idempotency_key: string;
};

// Mooov 2026-05-28 reply, Q-C: next_action is top-level on
// CreateSavedChargeResponse, sibling of payment_id / status / state.
// publishable_key is on the next_action object (Q-B). error is mutually
// exclusive with next_action and only present on status='failed'.
//
// Mooov 2026-05-28 reply (locked): publishable_key MAY be "" (empty
// string) on rare ops events where the gateway boots without the key
// configured. Field is always present, may be empty. Treat empty as
// "not present" and fall back to NEXT_PUBLIC_MOOOV_STRIPE_PUBLISHABLE_KEY
// in the SCA resume page.
export type SavedChargeNextAction = {
  type: string; // typically "use_stripe_sdk"
  client_secret: string;
  connected_account_id: string;
  publishable_key: string;
};

export type SavedChargeError = {
  code: string;
  category?: string;
  message?: string;
};

export type SavedChargeStatus =
  | "succeeded"
  | "requires_action"
  | "failed"
  | "processing";

export type SavedChargeResult = {
  payment_id: string;
  status: SavedChargeStatus;
  state?: string;
  provider?: string;
  provider_ref?: string;
  next_action?: SavedChargeNextAction;
  error?: SavedChargeError;
};

/**
 * Run a single off-session cycle against the saved PM. Caller drives
 * idempotency via input.idempotency_key — Mooov returns the original
 * envelope on replay (Mooov 2026-05-28 reply, Q-D). Three response
 * branches the cron must code for, plus three idempotency edge cases:
 *
 *   status="succeeded"        flip instalment paid, advance schedule
 *   status="requires_action"  store next_action.* on dues_schedules and
 *                             email the member a resume link
 *   status="failed"           bump consecutive_failures; cron retries on
 *                             next tick (idempotency key keeps replays safe)
 *
 *   409 IDEMPOTENCY_KEY_REUSED       same key, different body — bug in
 *                                    LP's key constructor; alert
 *   409 "request already processing" same key, prior call still in-flight;
 *                                    back off, retry next tick
 *   network failure / timeout        retry with the same key; replay
 *                                    returns the originally committed
 *                                    envelope if Mooov did commit
 */
export async function runSavedDuesCharge(
  input: SavedChargeInput
): Promise<SavedChargeResult> {
  const result = await callMooovConnect<SavedChargeResult>(
    "POST",
    "/v1/charges/saved",
    {
      merchant: input.merchant_id,
      idempotencyKey: input.idempotency_key,
      body: {
        payment_id: input.payment_id,
        amount: input.amount_minor,
        currency: input.currency,
        customer_ref: input.customer_ref,
        payment_method_id: input.payment_method_id,
        auto_capture: true,
        description: input.description,
        metadata: input.metadata,
      },
    }
  );
  return result;
}
