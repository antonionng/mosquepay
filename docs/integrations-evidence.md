# LodgePay × Mooov integration: evidence + current state

Last updated: 2026-05-19, post-launch handoff.

## What's running in production

Per-lodge auth is live end-to-end on `https://www.lodgepayments.co.uk`.
Mooov chose their **Connect / OBO** model rather than the per-lodge
encrypted-credentials model the original May 15 quickstart described.

| Concern | How it works | Where it lives |
| --- | --- | --- |
| Platform identity | Single LodgePay-the-platform Mooov API key | Vercel env `MOOOV_KEY_ID`, `MOOOV_KEY_SECRET` (aliases: `MOOOV_PLATFORM_KEY_ID`, `MOOOV_PLATFORM_KEY_SECRET`) |
| Per-lodge auth | OAuth Connect grants — each lodge admin runs a consent dance once to authorize LodgePay to act on their merchant | `mooov.lodges.metadata.{grant_id, granted_scopes, granted_at, entity_id, platform_id}` per lodge row |
| Consent start | Signs a state cookie, redirects to `${MOOOV_CONNECT_BASE}/authorize?client_id=lodgepay&...&state=...` | `app/api/mooov/connect/start/route.ts` |
| Consent callback | Verifies state, exchanges `code` via `POST /v1/public/connect/token` (platform-key signed), upserts row | `app/oauth/mooov/callback/route.ts` |
| Outbound signing | HMAC-SHA256 with platform key over `${METHOD}\n${PATH}\n${TIMESTAMP}\n${SHA256_HEX(body)}`, plus `Mooov-Merchant: <merchant_id>` OBO header | `lib/mooov.ts::callMooovConnect()` |
| Dues / payment intent start | Resolves merchant by `lodge_id`, signs request, OBO header, idempotency key, persists `mooov.payment_attempts` in both pre- and post-Mooov phases | `app/api/dues/start/route.ts` |
| Inbound webhook verification | HMAC-SHA256 of `${t}.${raw_body}` with platform webhook secret | `lib/mooov.ts::verifyMooovWebhook()` |
| Inbound webhook receiver | Single Connect endpoint, resolves lodge by `merchant_id`, idempotent insert into `mooov.mooov_webhook_events`, projects to `mooov.payment_attempts` and `mooov.lodges` (revoke) | `app/api/mooov-webhooks/connect/route.ts` |

## End-to-end smoke proof — 2026-05-19

### Inbound: 5 signed webhook deliveries from Mooov's outbox

All 5 post-bug-D deliveries from Mooov's gateway landed `200 {"ok":true}` after the schema toggle was flipped at ~12:04 UTC. Verified by SQL on the LodgePayments Supabase:

```text
event_id                                                              event_type          payment_id                              lodge_id              delivery_id  received_at
--------------------------------------------------------------------  ------------------  --------------------------------------  --------------------  -----------  ---------------------------
gateway_payment.captured_pay_lp_posttoggle_17791922518071             payment.succeeded   pay_lp_posttoggle_17791922518071        merch_lodgepay_demo   7            2026-05-19 12:05:27.593241+00
gateway_payment.captured_pay_lp_outbox_17791847498689                 payment.succeeded   pay_lp_outbox_17791847498689            merch_lodgepay_demo   4            2026-05-19 12:06:27.963997+00
gateway_payment.captured_pay_lp_env_17791844818819                    payment.succeeded   pay_lp_env_17791844818819               merch_lodgepay_demo   3            2026-05-19 12:06:29.479856+00
gateway_payment.captured_pay_lp_finalcheck_17791861707887             payment.succeeded   pay_lp_finalcheck_17791861707887        merch_lodgepay_demo   5            2026-05-19 12:06:30.561554+00
gateway_payment.captured_pay_lp_msprecision_17791879722183            payment.succeeded   pay_lp_msprecision_17791879722183       merch_lodgepay_demo   6            2026-05-19 12:08:28.818182+00
```

Mooov's id=1 and id=2 deliveries stay dead-lettered on their side intentionally — they carry the pre-bug-D flat shape (`merchant_id` + `occurred_at` at the top level instead of nested `merchant.id`); our 400 path correctly rejects them as "Missing event id, type, or merchant.".

### Outbound: 1 dues round-trip via LodgePay → Mooov OBO

`POST https://www.lodgepayments.co.uk/api/dues/start` against the demo merchant:

```bash
curl -sS -i -X POST https://www.lodgepayments.co.uk/api/dues/start \
  -H 'Content-Type: application/json' \
  -d '{"lodge_id":"merch_lodgepay_demo","member_id":"smoke_001","amount":100,"currency":"GBP","payment_method":"pm_card_visa"}'
# HTTP/2 200
# {"payment_id":"pay_merch_lodgepay_demo_smoke_001_1779193624596","state":"authorized","hosted_url":null}
```

Row in `mooov.payment_attempts`:

```text
payment_id        pay_merch_lodgepay_demo_smoke_001_1779193624596
lodge_id          merch_lodgepay_demo
member_id         smoke_001
amount            100  (1.00 GBP)
intent            dues
status            authorized
provider_ref      prov_pay_merch_lodgepay_demo_smoke_001_1779193624596    (minted by Mooov, returned in /v1/payment_intents response)
idempotency_key   dues_smoke_001_pay_merch_lodgepay_demo_smoke_001_1779193624596
created_at        2026-05-19 12:27:04.868015+00
authorized_at     2026-05-19 12:27:05.188+00      (320ms after creation; Mooov's authorize was fast)
```

The first attempt at the same smoke also returned 200 but failed to persist locally — surfaced a silent-failure bug in the route that was fixed in commit `cdceef9` (see "Hardening shipped in this slice" below).

## Production endpoint posture (verified 2026-05-19)

Live URL: `https://www.lodgepayments.co.uk/api/mooov-webhooks/connect`. Mooov's outbound sender doesn't follow redirects (SSRF posture) so they target `www` directly after observing `apex 307 → www`.

| Probe | Result | Notes |
| --- | --- | --- |
| `POST` with no `X-Mooov-Signature` header | `400 {"error":"Missing X-Mooov-Signature header."}` | post-fix copy; was previously the conflated "Webhook signature is not configured." (commit `ad9c627`) |
| `POST` with bad `X-Mooov-Signature: t=...,v1=deadbeef...` | `401 {"error":"Invalid signature."}` | platform webhook secret IS set in Vercel; route reached `verifyMooovWebhook` |
| `POST` with valid signed body, schema unexposed | `500 {"error":"Internal error processing webhook.","ref":<event_id>,"err_code":"PGRST106"}` | now-impossible since the schema toggle; commit `00a980d` made the body structured instead of body-less |
| `POST` with valid signed body, schema exposed | `200 {"ok":true}` | proven 5 times today |
| `GET` on the endpoint | `405 Method Not Allowed` | correct (only `POST` exported) |
| `POST` to apex `https://lodgepayments.co.uk/...` | `307 → https://www.lodgepayments.co.uk/...` | informs Mooov's www-only routing decision |
| TLS chain on `*.lodgepayments.co.uk` | Let's Encrypt R12, valid through 2026-08-05 | per Mooov's external check |

## Schema posture

Supabase project `fgtqpeswnakznsvibfvp`. Three migrations applied this slice:

| Migration | Applied | What it does |
| --- | --- | --- |
| `040_mooov_integration` | 2026-05-19 | Creates `mooov` schema; 6 tables + RLS; tenant resolver; original encrypted-credentials scaffolding (later dropped by 042) |
| `041_mooov_expose_schema_grants` | 2026-05-19 | Adds USAGE on routines/sequences + ALTER DEFAULT PRIVILEGES per Supabase's "Using Custom Schemas" guide; re-tightens `mooov_credentials` and `mooov_webhook_events` after the broad grant |
| `042_mooov_drop_dead_credentials_path` | 2026-05-19 | Drops the now-unused `mooov.mooov_credentials` table + `get_lodge_mooov_key` / `get_lodge_outbound_secret` / `mooov_master_key` functions — leftovers from the May 15 per-lodge encrypted-credentials plan that Connect superseded |

Post-cleanup `mooov` schema (5 tables, 1 function):

```text
table_name              function
----------------------- ----------------
dues_schedules          current_lodge_id
lodges
members
mooov_webhook_events
payment_attempts
```

**Required operator step** (one-time, not in any migration): add `mooov` to Supabase Project Settings → API → **Exposed schemas** so PostgREST will serve `Accept-Profile: mooov`. Without this, every PostgREST call into the schema returns `406 PGRST106 "Invalid schema: mooov"`. This was the root cause of the body-less 500s on the first 5 webhook deliveries earlier today.

## Required env vars on Vercel

Webhook receiver and dues route are both serving correctly, so all the required vars are set in production. Full alias-fallback order (first non-empty wins):

| Code-read variable | Aliases tried |
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
| Demo merchant fallback | `MOOOV_DEMO_MERCHANT_ID`, `MOOOV_LODGE_PILOT_MERCHANT_ID` |
| Demo lodge id | `MOOOV_DEMO_LODGE_ID` (default `merch_lodgepay_demo`) |

## Mooov-side state (per their 2026-05-19 handoffs)

- Webhook target: `https://www.lodgepayments.co.uk/api/mooov-webhooks/connect` (active, 0 consecutive failures).
- Redirect-URI allowlist: 5 entries (apex + www `lodgepayments.co.uk`, three Vercel preview hosts). Legacy `lodgepay.com` entries removed per our ask.
- Demo merchant: `merch_lodgepay_demo`, grant `grant_lp_043a37f44f08`. Live and reusable for smoke tests.
- Gateway now emits millisecond-precision `created` timestamps (`2026-05-19T10:52:52.960Z`); nanosecond precision was the prior shape. Both work for our handler (we don't parse `created` — `raw_body` is stored as text and `received_at` uses Postgres `now()`).
- Known issue on their side, NOT blocking us: their outbox dispatcher's `outbox_events.merchant_id = NULL` bug. The platform-webhook lane (our lane) writes directly to `platform_webhook_deliveries` without going through `outbox_events`, so unaffected.

## Hardening shipped in this slice

| Commit | Subject | Purpose |
| --- | --- | --- |
| `ad9c627` | Webhook receiver: split conflated 400 into 400 (missing header) + 500 (server misconfig) | Mooov's polish ask; clear caller-vs-operator failure distinction |
| `00a980d` | Webhook receiver: guard post-verify path against body-less 500s | Single try/catch around everything post-`verifyMooovWebhook`; structured 500 body with `ref` for correlation; this is how we diagnosed PGRST106 within minutes |
| `cdceef9` | Dues route: harden silent failure pattern (matches webhook hardening) | Fail-fast on pre-Mooov insert errors (don't mint an orphan Mooov authorize); log+still-200 on post-Mooov update errors with new `persisted:true\|false` flag |
| `3ac6f19` | Drop dead per-lodge encrypted credentials path from mooov schema | Migration 042 removes 1 table + 3 functions that no code path touches |
| `8ec8734` | Remove dead per-lodge webhook route `/api/mooov-webhooks/[lodgeId]` | No registration anywhere; superseded by `/connect` |

## How to onboard another lodge

1. Lodge admin signs into LodgePay → `getAdminReadContext()` resolves `{mode:"database", lodgeId, lodgeSlug}`.
2. Navigates to `/admin/integrations`. "Connect Mooov" button is visible (existing UI from `033800f`).
3. Click → `GET /api/mooov/connect/start` → state cookie + 302 to `${MOOOV_CONNECT_BASE}/authorize?client_id=lodgepay&...`.
4. Complete consent on Mooov. Mooov 302s back to `/oauth/mooov/callback?code=...&state=...`.
5. Callback exchanges code via `POST /v1/public/connect/token` (platform-signed), upserts the lodge row in `mooov.lodges` with new `merchant_id` + `grant_id` etc., then 302s to `/admin/integrations?mooov=connected`. Badge flips to "Connected".
6. Any subsequent `POST /api/dues/start` for that lodge_id resolves the merchant from `mooov.lodges` and signs OBO with the platform key.

Mooov offered to mirror `connect_consent_approved` audit log from their side when a real lodge runs this — ping them when you do it.

## Known pending items

- The two legacy stuck Vercel deployments (`c0v-w5kc6w8hy`, `c0v-kg4n1dzxm`, both UNKNOWN-status with 0ms build time) are still in the project. Cosmetic only — not on any production alias. Worth raising with Vercel support if this pattern continues on future pushes, since `git push` to this project consistently creates UNKNOWN previews while local `vercel build && vercel deploy --prebuilt --prod` builds in 14-30s.
- Smoke fixture rows (`mooov.lodges.id = 'merch_lodgepay_demo'`, `mooov.members.id = 'smoke_001'`) are still in the DB. Harmless — `merch_lodgepay_demo` collides with no real lodge merchant (each real lodge gets a unique merchant from Mooov's consent flow). Drop with `delete from mooov.payment_attempts where lodge_id = 'merch_lodgepay_demo'; delete from mooov.members where lodge_id = 'merch_lodgepay_demo'; delete from mooov.lodges where id = 'merch_lodgepay_demo';` if/when you want clean-room.
- Idempotency on `/api/dues/start`: `idempotency_key` includes `Date.now()`, so caller-initiated retries currently produce different keys and would create distinct Mooov payments. Worth a follow-up to derive the key from `(lodge_id, member_id, period)` instead of monotonic time, once a dues-cycle concept is in place.
