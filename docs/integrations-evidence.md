# LodgePay × Mooov dev-environment integration evidence

This file is the proof-of-work the launch owner asked for. It captures
the curl output and SQL count proofs that satisfy every "Done for dev"
checkbox in `mooov3:docs/integrations/lodgepay-mooov-dev-quickstart.md`,
and any spec deviations.

> Companion source-of-truth: the Mooov repo branch
> `feature/lodgepay-weekend`, files
> `docs/integrations/lodgepay-mooov-dev-quickstart.md` and
> `docs/integrations/lodgepay-mooov-integration.md`. Do not assume
> anything that is not in those documents.

---

## Spec deviations

Single, justified deviation from the literal quickstart SQL:

- **All Mooov-integration tables and helper RPCs live under a dedicated
  `mooov` schema** (`mooov.lodges`, `mooov.members`,
  `mooov.mooov_credentials`, `mooov.payment_attempts`,
  `mooov.mooov_webhook_events`, `mooov.dues_schedules`).
- The LodgePay repo already has incompatible `public.lodges` (UUID PK,
  no `merchant_id` column; from migration `002_multi_tenant_saas_and_gift_aid.sql`)
  and `public.members` (UUID PK, FK to `public.lodges` by UUID; from
  migration `006_members.sql`). Creating the quickstart's `text`-PK
  `public.lodges` would either error out or destroy the existing
  multi-tenant LodgePay data.
- The `pgcrypto` extension is installed under the standard Supabase
  `extensions` schema; encrypt/decrypt calls inside the SECURITY DEFINER
  functions are qualified as `extensions.pgp_sym_*`.
- API routes use `supa.schema("mooov").from(...)` and
  `supa.schema("mooov").rpc(...)` to reach the new tables and helpers.
- Acceptance gate 4.A is therefore re-stated below with
  `table_schema = 'mooov'` instead of `'public'`. Every other gate
  (4b.A, 4c.A, 5.A, 5.B, 6.A, 6.B, 7.A, 7.B, Section 8) is unchanged.

---

## Section 3 — Vercel env vars

(Vercel project: `c0v`, team `team_tyiuaDaKUtT2oBq7EfVQUFtZ`. Set on
Preview + Development scope only; Production is out of scope per
quickstart Section 0.)

| Name | Sensitive | Status |
| --- | --- | --- |
| `MOOOV_BASE_URL` | No | _to fill in after `vercel env ls`_ |
| `MOOOV_PLATFORM_MERCHANT_ID` | No | |
| `MOOOV_LODGE_PILOT_MERCHANT_ID` | No | |
| `MOOOV_PLATFORM_KEY_ID` | No | |
| `MOOOV_PLATFORM_KEY_SECRET` | **Yes** | |
| `MOOOV_PLATFORM_WEBHOOK_SECRET` | **Yes** | |
| `NEXT_PUBLIC_SUPABASE_URL` | No | already set (existing repo convention; satisfies the doc's `SUPABASE_URL`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | No | already set |
| `SUPABASE_SERVICE_ROLE_KEY` | **Yes** | already set |
| `NEXT_PUBLIC_APP_URL` / `NEXT_PUBLIC_SITE_URL` | No | `NEXT_PUBLIC_SITE_URL` already populated repo-wide |

> **Acceptance gate 3.A** — pending CLI capture:
>
> ```bash
> vercel env ls preview | grep -E 'MOOOV|SUPABASE'
> vercel env ls development | grep -E 'MOOOV|SUPABASE'
> ```

---

## Section 4 — Supabase schema + RLS + Vault

Migration applied: `supabase/migrations/040_mooov_integration.sql`.

### Acceptance gate 4.A (adapted to the `mooov` schema)

```sql
select table_name
from information_schema.tables
where table_schema = 'mooov'
  and table_name in (
    'lodges','members','mooov_credentials',
    'payment_attempts','mooov_webhook_events','dues_schedules'
  );
-- expect: 6 rows

select tablename, rowsecurity
from pg_tables
where schemaname = 'mooov'
  and tablename in (
    'lodges','members','mooov_credentials',
    'payment_attempts','mooov_webhook_events','dues_schedules'
  );
-- expect: rowsecurity = true on every row
```

_Result: pending application._

### Acceptance gate 4b.A — Vault master key resolves

```sql
select length(mooov.mooov_master_key()) > 0 as master_key_resolves;
-- expect: t
```

The key is created out-of-band, once, by the operator pasting:

```sql
select vault.create_secret(
  'MOOOV_CRED_MASTER_KEY',
  '<PASTE_FRESHLY_GENERATED_BASE64_KEY_HERE>'
);
```

Generate the key locally with `openssl rand -base64 32` and clear the
SQL editor recent-queries panel afterwards.

_Result: pending paste._

### Acceptance gate 4c.A — pilot lodge credentials inserted and decrypt to length 48

The four staging secrets the user pastes:

- `<PASTE_LODGE_API_KEY_ID>` — pilot-lodge Mooov API key id, format `mk_live_<hex16>`.
- `<PASTE_LODGE_API_KEY_SECRET>` — pilot-lodge Mooov API key secret, 48 hex chars.
- `<PASTE_LODGE_WEBHOOK_ID>` — pilot-lodge outbound webhook id, format `wh_<hex16>`.
- `<PASTE_LODGE_WEBHOOK_SIGNING_SECRET>` — pilot-lodge outbound webhook signing secret, 48 hex chars.

Run once, then clear recent-queries:

```sql
insert into mooov.lodges (id, merchant_id, display_name, currency, status)
values ('lodge_pilot', 'merch_lpay_lodge_pilot', 'Pilot Lodge', 'GBP', 'active')
on conflict (id) do update
  set merchant_id  = excluded.merchant_id,
      display_name = excluded.display_name;

insert into mooov.mooov_credentials (
  lodge_id,
  api_key_id,
  api_key_secret_enc,
  outbound_webhook_id,
  outbound_signing_secret_enc,
  base_url
) values (
  'lodge_pilot',
  '<PASTE_LODGE_API_KEY_ID>',
  extensions.pgp_sym_encrypt('<PASTE_LODGE_API_KEY_SECRET>', mooov.mooov_master_key()),
  '<PASTE_LODGE_WEBHOOK_ID>',
  extensions.pgp_sym_encrypt('<PASTE_LODGE_WEBHOOK_SIGNING_SECRET>', mooov.mooov_master_key()),
  'https://gateway-staging-vtpxtwykca-uc.a.run.app'
)
on conflict (lodge_id) do update
  set api_key_id                  = excluded.api_key_id,
      api_key_secret_enc          = excluded.api_key_secret_enc,
      outbound_webhook_id         = excluded.outbound_webhook_id,
      outbound_signing_secret_enc = excluded.outbound_signing_secret_enc,
      base_url                    = excluded.base_url,
      rotated_at                  = now();
```

Then verify:

```sql
select length(
  extensions.pgp_sym_decrypt(api_key_secret_enc, mooov.mooov_master_key())
) as api_key_secret_length
from mooov.mooov_credentials
where lodge_id = 'lodge_pilot';
-- expect: 48
```

_Result: pending paste._

---

## Section 5 — `lib/mooov.ts`

### Acceptance gate 5.A — typecheck passes

`npm run typecheck` is not yet defined on `main` (the `e2e-core-flow-hardening`
branch added it). Equivalent invocation:

```bash
rm -rf .next && npx tsc --noEmit
# exit code 0; no output
```

**Result: PASS — `npx tsc --noEmit` exits 0 against the integration branch with the new `lib/mooov.ts` and the two routes.**

### Acceptance gate 5.B — deterministic sign smoke

Reference vector (input: secret = `"0123456789abcdef"` repeated 3x = 48
hex chars, method = `POST`, path = `/v1/payment_intents`, timestamp =
`2026-05-19T14:00:00Z`, body = `""`):

```text
canonical: "POST\n/v1/payment_intents\n2026-05-19T14:00:00Z\ne3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
signature: f1d8f592db7cb6bb849b64efe9998070e60f16bd897e6b9d6999acc8d60e0aa8
length   : 64
lowerhex : true
repeat   : deterministic
```

(`e3b0c4...` is the SHA-256 of the empty string, as expected.)

**Result: PASS — 64-char lowercase hex, deterministic across two calls.**

---

## Section 6 — `app/api/dues/start/route.ts`

### Acceptance gate 6.A — typecheck passes (covered by 5.A)
### Acceptance gate 6.B — `/api/dues/start` returns 200 against the preview URL

```bash
curl -sS -i -X POST "$PREVIEW_URL/api/dues/start" \
  -H 'Content-Type: application/json' \
  -d '{
    "lodge_id": "lodge_pilot",
    "member_id": "member_test_001",
    "amount": 100,
    "currency": "GBP",
    "payment_method": "pm_card_visa"
  }'
# expect HTTP/2 200 with { "payment_id": "pay_...", "state": "authorized" }
```

_Result: pending capture._

---

## Section 7 — `app/api/mooov-webhooks/[lodgeId]/route.ts`

### Acceptance gate 7.A — synthetic bogus webhook returns 401 (or 400)

```bash
curl -sS -i -X POST "$PREVIEW_URL/api/mooov-webhooks/lodge_pilot" \
  -H 'Content-Type: application/json' \
  -H 'X-Mooov-Signature: t=1,v1=00' \
  -d '{"hello":"world"}'
# expect HTTP/2 401 with body {"error":"signature timestamp out of range"}
```

_Result: pending capture._

### Acceptance gate 7.B — real Mooov test event lands in `mooov.mooov_webhook_events`

```sql
select count(*) from mooov.mooov_webhook_events;
-- expect: >= 1
```

_Result: pending operator clicking "Send test event" in the Mooov portal._

---

## Section 8 — first-payment smoke

Path A (Stripe test PM `pm_card_visa`):

```bash
curl -sS -i -X POST "$PREVIEW_URL/api/dues/start" \
  -H 'Content-Type: application/json' \
  -d '{
    "lodge_id": "lodge_pilot",
    "member_id": "member_smoke_001",
    "amount": 100,
    "currency": "GBP",
    "payment_method": "pm_card_visa"
  }'
```

Then:

```sql
select payment_id, status, amount, currency, created_at
from mooov.payment_attempts
order by created_at desc
limit 1;
-- status = 'authorized' (and 'captured' once the webhook lands).
```

_Result: pending capture._

---

## "Done for dev" checklist

Mirrors Section 10 of the dev quickstart.

- [ ] 3.A: Vercel env vars listed (Preview + Development scope), Sensitive flagged.
- [ ] 4.A (adapted): six tables present in `mooov` schema, RLS enabled on all six.
- [ ] 4b.A: `mooov.mooov_master_key()` returns a non-empty string.
- [ ] 4c.A: decrypted API-key secret length = 48.
- [ ] 5.A: `npm run typecheck` passes.
- [ ] 5.B: `canonicalRequest` + `sign` deterministically produce a 64-char hex.
- [ ] 6.A: typecheck still passes after adding the dues route.
- [ ] 6.B: `/api/dues/start` returns 200 against the preview URL.
- [ ] 7.A: synthetic bogus webhook returns 401 / 400 (not 200, not 500).
- [ ] 7.B: real Mooov test event lands in `mooov.mooov_webhook_events`.
- [ ] Section 8 smoke: one payment ends up in `mooov.payment_attempts.status = 'captured'` after the webhook fires.
