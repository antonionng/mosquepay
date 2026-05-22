#!/usr/bin/env node
// Mooov charge-capability preflight.
//
// Fires one signed POST /v1/payment_intents (flow:"redirect") to confirm a
// freshly-connected merchant has cleared Stripe KYB and flipped to
// charges_enabled=true on the Mooov side. Used during a live onboarding
// screenshare to decide whether to ask the cardholder to actually pay, or to
// send them back to setup_url to finish verification.
//
// Per Mooov (ant, 2026-05-22): "Until that flip, any POST /v1/payment_intents
// for the merchant gets the typed 422 merchant_not_charge_capable with a
// single-use setup_url (1h TTL); on the flip, the next call succeeds with no
// further Mooov action." This script reads that signal and prints CHARGE_OK
// or SETUP_REQUIRED <setup_url>, plus the full body for debugging.
//
// Footprint: a successful preflight creates one real Stripe Checkout Session
// on the connected account that auto-expires after ~24h (Stripe default).
// The session is never followed (we discard hosted_url) so it appears as
// "incomplete / expired" in the merchant's Stripe dashboard. Harmless noise,
// acknowledged by Mooov as the cleanest single signal.
//
// Usage:
//   node scripts/mooov-preflight.mjs <merchant_id> [amount_minor]
// Env:
//   MOOOV_GATEWAY_BASE_URL       e.g. https://api.mooov.money
//   MOOOV_PLATFORM_KEY_ID        e.g. mk_platform_xxx
//   MOOOV_PLATFORM_KEY_SECRET    48-hex-char string, used UTF-8 (NOT decoded)

import { createHash, createHmac, randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";

function loadDotEnvLocal() {
  if (!existsSync(".env.local")) return;
  const text = readFileSync(".env.local", "utf8");
  for (const line of text.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    const [, k, v] = m;
    if (process.env[k] === undefined) {
      process.env[k] = v.replace(/^["']|["']$/g, "");
    }
  }
}

function die(msg, code = 1) {
  console.error(`mooov-preflight: ${msg}`);
  process.exit(code);
}

function mooovTimestamp() {
  return Math.floor(Date.now() / 1000).toString();
}

function canonical(method, path, timestamp, rawBody) {
  const bodyHash = createHash("sha256").update(rawBody, "utf8").digest("hex");
  return [method.toUpperCase(), path, timestamp, bodyHash].join("\n");
}

function sign(secret, c) {
  return createHmac("sha256", secret).update(c, "utf8").digest("hex");
}

async function main() {
  loadDotEnvLocal();

  const merchantId = process.argv[2];
  if (!merchantId) die("missing arg: merchant_id (e.g. merch_xxx)");

  const amountMinor = Number(process.argv[3] ?? 50);
  if (!Number.isFinite(amountMinor) || amountMinor < 1) {
    die(`bad amount_minor: ${process.argv[3]}`);
  }

  const base = process.env.MOOOV_GATEWAY_BASE_URL;
  const keyId = process.env.MOOOV_PLATFORM_KEY_ID;
  const secret = process.env.MOOOV_PLATFORM_KEY_SECRET;
  if (!base || !keyId || !secret) {
    die(
      "missing env: need MOOOV_GATEWAY_BASE_URL, MOOOV_PLATFORM_KEY_ID, MOOOV_PLATFORM_KEY_SECRET"
    );
  }

  const path = "/v1/payment_intents";
  const paymentId = `preflight_${Date.now().toString(36)}_${randomUUID().slice(0, 8)}`;
  const body = {
    payment_id: paymentId,
    amount: amountMinor,
    currency: "GBP",
    flow: "redirect",
    success_url: "https://www.lodgepayments.co.uk/admin/integrations?preflight=ok",
    cancel_url: "https://www.lodgepayments.co.uk/admin/integrations?preflight=cancel",
    description: "LodgePay charge-capability preflight (not a real charge intent)",
  };
  const raw = JSON.stringify(body);
  const ts = mooovTimestamp();
  const idem = `preflight_${randomUUID()}`;
  const sig = sign(secret, canonical("POST", path, ts, raw));

  const headers = {
    "Content-Type": "application/json",
    "X-Mooov-Key-Id": keyId,
    "X-Mooov-Timestamp": ts,
    "X-Mooov-Signature": sig,
    "X-Mooov-Idempotency": idem,
    "Mooov-Merchant": merchantId,
  };

  console.error(`POST ${base}${path}  (merchant=${merchantId}, amount=${amountMinor}p)`);
  const res = await fetch(base + path, { method: "POST", headers, body: raw });
  const text = await res.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = { raw: text };
  }

  console.error(`HTTP ${res.status}`);
  console.error(JSON.stringify(parsed, null, 2));

  if (res.status === 200) {
    console.log("CHARGE_OK");
    process.exit(0);
  }

  const errBody = parsed?.error ?? parsed;
  const type = errBody?.type ?? errBody?.code;
  if (res.status === 422 && type === "merchant_not_charge_capable") {
    const setupUrl = errBody?.setup_url ?? "(no setup_url in response)";
    console.log(`SETUP_REQUIRED ${setupUrl}`);
    process.exit(2);
  }

  console.log(`UNEXPECTED ${res.status} ${type ?? "no_type"}`);
  process.exit(3);
}

main().catch((err) => {
  console.error("preflight: fatal", err);
  process.exit(99);
});
