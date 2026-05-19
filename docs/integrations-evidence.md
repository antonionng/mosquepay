# LodgePay × Mooov integration: evidence + current state

Last updated: 2026-05-19 (Tuesday launch day).

This file is the agent-side record of what shipped, what's running in
production, and what's left for "per-lodge auth working" to mean
end-to-end on real lodge traffic.

## Architecture as shipped (May 19, 10:06 UTC, commit `033800f`)

Mooov went with their **Connect / OBO** model rather than the per-lodge
encrypted-API-key model the May 15 dev quickstart described. The shape:

| Concern | How it works | Where it lives |
| --- | --- | --- |
| Platform identity | A single LodgePay-the-platform Mooov API key | Vercel env vars `MOOOV_KEY_ID`, `MOOOV_KEY_SECRET` (aliases: `MOOOV_PLATFORM_KEY_ID`, `MOOOV_PLATFORM_KEY_SECRET`) |
| Per-lodge auth | OAuth Connect grants — each lodge admin runs a consent dance once to authorize LodgePay to act on their merchant's behalf | `mooov.lodges.metadata.grant_id` per lodge row |
| Outbound signing (LodgePay -> Mooov) | HMAC-SHA256 with the platform key over `${METHOD}\n${PATH}\n${TIMESTAMP}\n${SHA256_HEX(body)}`, plus a `Mooov-Merchant: <merchant_id>` header for OBO | `lib/mooov.ts::callMooovConnect()` |
| Inbound webhook verification | HMAC-SHA256 of `${t}.${raw_body}` with the **platform-wide** webhook signing secret (not per-lodge) | `lib/mooov.ts::verifyMooovWebhook()` |
| Webhook receiver | Single endpoint, resolves the lodge by looking up `merchant_id` on the event | `app/api/mooov-webhooks/connect/route.ts` |
| Per-lodge state | `mooov.lodges` row keyed by LodgePay's internal `lodge_id` (UUID from `public.lodges.id`), with the Mooov `merchant_id`, `entity_id`, `grant_id`, `granted_scopes`, `granted_at` stored as columns + JSON metadata | Supabase project `fgtqpeswnakznsvibfvp` |

## Production endpoint posture (verified May 19, 10:30 UTC)

Live URL: `https://www.lodgepayments.co.uk/api/mooov-webhooks/connect`.
Mooov's outbound webhook sender doesn't follow redirects (SSRF posture);
they pointed at `www` directly after observing the apex `307 -> www`.

| Probe | Result | Notes |
| --- | --- | --- |
| `POST` with no `X-Mooov-Signature` header | `400 {"error":"Missing X-Mooov-Signature header."}` | post-fix copy; was previously "Webhook signature is not configured." |
| `POST` with a bad `X-Mooov-Signature: t=...,v1=deadbeef...` | `401 {"error":"Invalid signature."}` | platform webhook secret IS set in Vercel; route reached `verifyMooovWebhook` |
| `GET` on the endpoint | `405 Method Not Allowed` | correct (only `POST` exported) |
| `POST` to apex `https://lodgepayments.co.uk/...` | `307 -> https://www.lodgepayments.co.uk/...` | informs Mooov's www-only routing decision |
| TLS chain on `*.lodgepayments.co.uk` | Let's Encrypt R12, valid through 2026-08-05 | (per Mooov's external check) |
| Live TTFB | ~190ms from Mooov region | (per Mooov's external check) |

## Schema posture

Migration `040_mooov_integration.sql` applied to project
`fgtqpeswnakznsvibfvp` on 2026-05-19. Verified by SQL:

```text
table_name             | rls
-----------------------+-----
dues_schedules         | true
lodges                 | true
members                | true
mooov_credentials      | true
mooov_webhook_events   | true
payment_attempts       | true

schema | function                   | args
-------+----------------------------+-----------------
mooov  | current_lodge_id           |
mooov  | get_lodge_mooov_key        | p_lodge_id text
mooov  | get_lodge_outbound_secret  | p_lodge_id text
mooov  | mooov_master_key           |
```

`mooov.lodges` currently has 0 rows; no lodge has completed the consent
dance yet. The first row will be inserted by
`/oauth/mooov/callback/route.ts` when a lodge admin returns from Mooov's
`/authorize` page.

### Now-dead weight from the May 15 plan

These exist in the schema but are unused by the Connect path that
shipped. Harmless; can be dropped in a follow-up migration if desired.

- Table `mooov.mooov_credentials` — was for per-lodge encrypted API key
  secrets in the original plan. The Connect model uses the
  platform-wide key in env vars instead.
- Function `mooov.get_lodge_mooov_key(text)` — decrypts the per-lodge
  API key secret. Not called by `app/api/dues/start/route.ts` anymore
  (the new route uses `callMooovConnect(...)` with the platform key).
- Function `mooov.get_lodge_outbound_secret(text)` — same pattern,
  webhook secret. Not called; the Connect webhook receiver uses
  `MOOOV_WEBHOOK_SIGNING_SECRET` directly.
- Function `mooov.mooov_master_key()` — Vault resolver. Has no Vault
  secret backing it (the `MOOOV_CRED_MASTER_KEY` secret was never
  created); `select mooov.mooov_master_key()` returns NULL. The two
  decrypt RPCs above would 500 if called, but nothing calls them.

Old May 15 webhook route `app/api/mooov-webhooks/[lodgeId]/route.ts` is
also dead URL space — no webhook is registered against it. Either
delete in a follow-up or leave for archive.

## What "per-lodge auth working" requires end-to-end

1. **A real lodge admin signed into LodgePay.** Resolves
   `getAdminReadContext()` to `{mode: "database", lodgeId, lodgeSlug}`.
2. **Click "Connect Mooov"** on `/admin/integrations`. This GETs
   `/api/mooov/connect/start`, which signs a state cookie and 302s to
   `${MOOOV_CONNECT_BASE}/authorize?client_id=lodgepay&...`.
3. **Complete consent on Mooov.** Mooov redirects back to
   `/oauth/mooov/callback?code=...&state=...`.
4. **Token exchange.** The callback POSTs
   `${MOOOV_GATEWAY_BASE_URL}/v1/public/connect/token` (signed with the
   platform key) and gets back
   `{merchant_id, entity_id, grant_id, granted_scopes, granted_at, platform_id}`.
5. **Persist.** Upsert into `mooov.lodges` keyed by lodge_id; the badge
   on `/admin/integrations` flips to "Connected" with the merchant id.
6. **Test a payment.** `POST /api/dues/start` with that `lodge_id` ->
   route looks up `merchant_id` from `mooov.lodges` -> calls
   `callMooovConnect("POST", "/v1/payment_intents", {merchant, body})`
   -> Mooov returns `{payment_id, state: "authorized" | "captured" | "processing"}`.
   Persisted in `mooov.payment_attempts`.
7. **Webhook round-trip.** Mooov dispatches `payment.succeeded` to
   `https://www.lodgepayments.co.uk/api/mooov-webhooks/connect`. We
   verify the platform signing secret, resolve the lodge by merchant id,
   insert into `mooov.mooov_webhook_events`, and project state to
   `mooov.payment_attempts.status = 'captured'`.

Steps 1-6 are now executable; step 7 is gated on Mooov's known
dispatcher issue (rows ending up with `merchant_id = NULL` and never
publishing). Mooov flagged this as non-blocking for the protocol and
will send a heads-up when fixed.

## Required env vars on Vercel

The webhook endpoint is already responding correctly with the secret
configured, so at least one of the three aliases is set in production
(deployment-protected; can't enumerate via Vercel MCP). The full list
the code reads, by alias-fallback order:

| Code-read variable | Aliases tried (first non-empty wins) |
| --- | --- |
| Gateway base URL | `MOOOV_GATEWAY_BASE_URL`, `MOOOV_API_BASE`, `MOOOV_BASE_URL` |
| Platform key id | `MOOOV_KEY_ID`, `MOOOV_PLATFORM_KEY_ID` |
| Platform key secret | `MOOOV_KEY_SECRET`, `MOOOV_PLATFORM_KEY_SECRET` |
| Webhook signing secret | `MOOOV_WEBHOOK_SIGNING_SECRET`, `MOOOV_WEBHOOK_SECRET`, `MOOOV_PLATFORM_WEBHOOK_SECRET` |
| Connect/authorize host | `MOOOV_CONNECT_BASE` (default `https://staging.connect.mooov.money`) |
| Platform slug | `MOOOV_PLATFORM_SLUG` (default `lodgepay`) |
| Platform id | `MOOOV_PLATFORM_ID` (default `plat_lodgepay`) |
| Redirect URI override | `MOOOV_REDIRECT_URI` (optional; otherwise derived from `MOOOV_REDIRECT_BASE_URL ?? NEXT_PUBLIC_SITE_URL ?? request origin`) |
| Connect mode | `MOOOV_CONNECT_MODE` (default `test`) |
| Demo merchant | `MOOOV_DEMO_MERCHANT_ID`, `MOOOV_LODGE_PILOT_MERCHANT_ID` (Mooov-supplied demo: `merch_lodgepay_demo`) |
| Demo lodge id | `MOOOV_DEMO_LODGE_ID` (default `merch_lodgepay_demo`) |

## Mooov-side current state (per their 2026-05-19 10:18Z handoff)

- Webhook target: `https://www.lodgepayments.co.uk/api/mooov-webhooks/connect` (active, 0 consecutive failures).
- Allowlist (7 entries): apex + www lodgepayments.co.uk, two stable Vercel team/main aliases, the `integration-mooov-dev` branch preview alias, two legacy `lodgepay.com` entries (safety net; can be dropped on request).
- Demo merchant: `merch_lodgepay_demo`, grant `grant_lp_043a37f44f08`. Unchanged.
- Known issue: outbox dispatcher rows ending up with `merchant_id = NULL` and never publishing. Mooov tracking it; non-blocking for our code.

## Spec deviations from the May 15 dev quickstart

- All Mooov tables under a dedicated `mooov` schema (not `public`)
  because `public.lodges` (UUID PK) and `public.members` (UUID PK)
  already exist and have incompatible shapes.
- Code uses `supa.schema("mooov").from(...)` and
  `supa.schema("mooov").rpc(...)` to reach the new schema.
- The per-lodge encrypted-credentials path (Section 4c INSERT, Vault
  master key, decrypt RPCs) was superseded by the Connect/OBO model. The
  scaffolding lives in the migration but is unused; see "now-dead
  weight" above.
- Acceptance gates re-mapped:
  - 4.A: filter `table_schema = 'mooov'`.
  - 4b.A / 4c.A: not applicable in the Connect model. Per-lodge auth
    state is the `mooov.lodges` row populated by `/oauth/mooov/callback`.
  - 5.A / 5.B: typecheck + deterministic sign smoke still pass.
  - 6.A / 6.B: dues route still passes typecheck. End-to-end 6.B test
    requires step 6 above (a real grant in `mooov.lodges`).
  - 7.A: bogus-signature probe returns 401 ("Invalid signature.")
    against the live URL — verified 2026-05-19 10:30Z.
  - 7.B: gated on Mooov's dispatcher fix.
