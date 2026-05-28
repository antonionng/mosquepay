#!/usr/bin/env node
// Smoke test for Mooov's GET /v1/customers/by_ref endpoint.
//
// Per Mooov's 2026-05-28 lock-in (Q-A fallback): an HMAC-signed GET
// against the platform key returns { customer_ref, stripe_customer_id,
// merchant_id } when a (merchant, customer_ref) tuple has been resolved
// by a previous /v1/payment_intents call with customer_ref. 404 when no
// mapping exists, 422 if called with a merchant key, 400 if the ref is
// missing or > 255 chars.
//
// LP doesn't currently call this endpoint in any production path
// because the webhook stamps data.stripe_customer_id automatically
// (Q-A primary). This smoke exists purely to validate that:
//
//   1. Our HMAC signer works against a GET (no body) on Mooov prod.
//   2. Our platform key has the customers:read scope so we can adopt
//      the by_ref fallback later if a cron-side resolution becomes
//      necessary (e.g. a member opens "Resume verification" before the
//      webhook lands).
//
// Usage:
//   node --env-file=.env.production scripts/smoke-mooov-by-ref.mjs <merchant_id> <customer_ref>
//
// Or with explicit env:
//   MOOOV_API_BASE=... \
//   MOOOV_PLATFORM_API_KEY_ID=... \
//   MOOOV_PLATFORM_API_KEY_SECRET=... \
//   node scripts/smoke-mooov-by-ref.mjs merch_lodgepaytest_3f3a5w mbr_test_smoke_001
//
// Expected outcomes:
//   200 + JSON body  -> the tuple was resolved (real or seeded)
//   404              -> auth + scope OK, no mapping for this ref. PASS.
//   403 SCOPE_DENIED -> auth OK, platform key missing customers:read.
//                       Ask Mooov to add the scope to our platform key.
//   401              -> HMAC wrong. Check signer.
//   422              -> we sent a merchant key not a platform key.
//                       Check key id is mk_platform_*.

import { createHash, createHmac } from "node:crypto";
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
  console.error(`smoke-mooov-by-ref: ${msg}`);
  process.exit(code);
}

// RFC3339 second-precision UTC, matching lib/mooov.ts mooovTimestamp().
function mooovTimestamp() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
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
  const customerRef = process.argv[3];
  if (!merchantId || !customerRef) {
    die(
      "usage: node scripts/smoke-mooov-by-ref.mjs <merchant_id> <customer_ref>"
    );
  }

  const base =
    process.env.MOOOV_API_BASE ??
    process.env.MOOOV_GATEWAY_BASE_URL ??
    process.env.MOOOV_BASE_URL;
  const keyId =
    process.env.MOOOV_PLATFORM_API_KEY_ID ??
    process.env.MOOOV_PLATFORM_KEY_ID ??
    process.env.MOOOV_KEY_ID;
  const secret =
    process.env.MOOOV_PLATFORM_API_KEY_SECRET ??
    process.env.MOOOV_PLATFORM_KEY_SECRET ??
    process.env.MOOOV_KEY_SECRET;
  if (!base || !keyId || !secret) {
    die(
      "missing env: need MOOOV_API_BASE, MOOOV_PLATFORM_API_KEY_ID, MOOOV_PLATFORM_API_KEY_SECRET (or _KEY_ aliases)"
    );
  }

  const path = `/v1/customers/by_ref?ref=${encodeURIComponent(customerRef)}`;
  const ts = mooovTimestamp();
  // GET has no body; canonical body hash is sha256("").
  const sig = sign(secret, canonical("GET", path, ts, ""));

  const headers = {
    "X-Mooov-Key-Id": keyId,
    "X-Mooov-Timestamp": ts,
    "X-Mooov-Signature": sig,
    "Mooov-Merchant": merchantId,
  };

  console.error(`GET ${base}${path}`);
  console.error(`  Mooov-Merchant: ${merchantId}`);
  console.error(`  X-Mooov-Key-Id: ${keyId.slice(0, 12)}...`);
  console.error(`  X-Mooov-Timestamp: ${ts}`);

  const res = await fetch(base + path, { method: "GET", headers });
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
    console.log("BY_REF_RESOLVED");
    process.exit(0);
  }
  if (res.status === 404) {
    console.log("BY_REF_NOT_FOUND_AUTH_OK");
    process.exit(0);
  }
  if (res.status === 403) {
    console.log("SCOPE_DENIED_NEEDS_CUSTOMERS_READ");
    process.exit(2);
  }
  if (res.status === 422) {
    console.log("WRONG_KEY_TYPE");
    process.exit(3);
  }
  if (res.status === 401) {
    console.log("AUTH_FAIL_CHECK_HMAC");
    process.exit(4);
  }
  console.log(`UNEXPECTED ${res.status}`);
  process.exit(99);
}

main().catch((err) => {
  console.error("smoke-mooov-by-ref: fatal", err);
  process.exit(99);
});
