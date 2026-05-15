-- 040_mooov_integration.sql
--
-- LodgePay <-> Mooov payments gateway integration. Implements the schema,
-- RLS, Vault-backed master key, and SECURITY DEFINER decrypt RPCs spec'd in
-- mooov3:docs/integrations/lodgepay-mooov-dev-quickstart.md (Section 4).
--
-- Deviation from the literal quickstart SQL: every Mooov-integration table
-- lives under a dedicated `mooov` schema instead of `public`. The LodgePay
-- repo already has incompatible `public.lodges` (UUID PK, no merchant_id)
-- from migration 002 and `public.members` (UUID PK) from migration 006.
-- Putting Mooov tables under their own schema avoids any clash with the
-- existing tenant data model and keeps the integration cleanly isolated.
--
-- Acceptance gate 4.A is therefore checked with `table_schema = 'mooov'`
-- (see docs/integrations-evidence.md).

-- 0. Required extension for symmetric encryption of per-lodge secrets.
--    Installed under the standard Supabase `extensions` schema.
create extension if not exists pgcrypto with schema extensions;

create schema if not exists mooov;

-- 1. Lodges that LodgePay has onboarded as Mooov merchants.
create table if not exists mooov.lodges (
  id              text primary key,
  merchant_id     text not null unique,
  display_name    text not null,
  currency        text not null default 'GBP',
  status          text not null default 'active',
  created_at      timestamptz not null default now(),
  metadata        jsonb not null default '{}'::jsonb
);

-- 2. Per-lodge Mooov credentials. Secrets are pgcrypto-encrypted with a
--    Vault-managed master key (see Section 4b of the quickstart).
create table if not exists mooov.mooov_credentials (
  lodge_id                          text primary key references mooov.lodges(id) on delete cascade,
  api_key_id                        text not null,
  api_key_secret_enc                bytea not null,
  outbound_webhook_id               text not null,
  outbound_signing_secret_enc       bytea not null,
  base_url                          text not null,
  created_at                        timestamptz not null default now(),
  rotated_at                        timestamptz
);

-- 3. LodgePay's lodge members (Mooov-side projection; not the same row set
--    as public.members, which holds full LodgePay member profile data).
create table if not exists mooov.members (
  id             text primary key,
  lodge_id       text not null references mooov.lodges(id) on delete cascade,
  email          text,
  display_name   text not null,
  status         text not null default 'active',
  joined_at      date,
  metadata       jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now()
);
create index if not exists members_lodge_idx on mooov.members(lodge_id);

-- 4. One row per call to POST /v1/payment_intents.
create table if not exists mooov.payment_attempts (
  payment_id             text primary key,
  lodge_id               text not null references mooov.lodges(id) on delete cascade,
  member_id              text references mooov.members(id),
  amount                 bigint not null,
  currency               text not null,
  intent                 text not null,
  status                 text not null,
  provider_ref           text,
  idempotency_key        text not null,
  failure_reason         text,
  metadata               jsonb not null default '{}'::jsonb,
  created_at             timestamptz not null default now(),
  authorized_at          timestamptz,
  captured_at            timestamptz,
  refunded_at            timestamptz,
  unique(lodge_id, idempotency_key)
);
create index if not exists payment_attempts_lodge_idx
  on mooov.payment_attempts(lodge_id, created_at desc);

-- 5. Append-only outbound-webhook log; (lodge_id, event_id) is the
--    idempotency key. Replays return 200 quickly.
create table if not exists mooov.mooov_webhook_events (
  lodge_id       text not null references mooov.lodges(id) on delete cascade,
  event_id       text not null,
  event_type     text not null,
  payment_id     text,
  raw_body       text not null,
  delivery_id    text,
  received_at    timestamptz not null default now(),
  primary key (lodge_id, event_id)
);

-- 6. Dues schedules; persisted now even though Phase A drives them.
create table if not exists mooov.dues_schedules (
  id            text primary key,
  lodge_id      text not null references mooov.lodges(id) on delete cascade,
  member_id     text not null references mooov.members(id) on delete cascade,
  amount        bigint not null,
  currency      text not null,
  cadence       text not null,
  next_due_on   date not null,
  payment_method_ref text,
  status        text not null default 'active',
  created_at    timestamptz not null default now()
);
create index if not exists dues_schedules_lodge_idx
  on mooov.dues_schedules(lodge_id, next_due_on);

-- 7. RLS: every table on. Service-role bypasses RLS by default, which is
--    how the LodgePay API routes will read and write these rows.
alter table mooov.lodges               enable row level security;
alter table mooov.members              enable row level security;
alter table mooov.payment_attempts     enable row level security;
alter table mooov.mooov_webhook_events enable row level security;
alter table mooov.dues_schedules       enable row level security;
alter table mooov.mooov_credentials    enable row level security;

-- Tenant resolver. Pulls lodge_id off the Supabase JWT.
create or replace function mooov.current_lodge_id() returns text
language sql stable as $$
  select coalesce(
    (auth.jwt() -> 'user_metadata' ->> 'lodge_id'),
    (auth.jwt() ->> 'lodge_id')
  );
$$;

drop policy if exists "lodge member read" on mooov.lodges;
create policy "lodge member read"
  on mooov.lodges for select to authenticated
  using (id = mooov.current_lodge_id());

drop policy if exists "members within lodge" on mooov.members;
create policy "members within lodge"
  on mooov.members for all to authenticated
  using (lodge_id = mooov.current_lodge_id())
  with check (lodge_id = mooov.current_lodge_id());

drop policy if exists "payments within lodge" on mooov.payment_attempts;
create policy "payments within lodge"
  on mooov.payment_attempts for all to authenticated
  using (lodge_id = mooov.current_lodge_id())
  with check (lodge_id = mooov.current_lodge_id());

drop policy if exists "webhook log within lodge" on mooov.mooov_webhook_events;
create policy "webhook log within lodge"
  on mooov.mooov_webhook_events for select to authenticated
  using (lodge_id = mooov.current_lodge_id());

drop policy if exists "dues within lodge" on mooov.dues_schedules;
create policy "dues within lodge"
  on mooov.dues_schedules for all to authenticated
  using (lodge_id = mooov.current_lodge_id())
  with check (lodge_id = mooov.current_lodge_id());

-- mooov_credentials is service-role-only. Never expose to anon/authenticated.
revoke all on mooov.mooov_credentials from anon, authenticated;
drop policy if exists "service role only" on mooov.mooov_credentials;
create policy "service role only"
  on mooov.mooov_credentials for all to service_role
  using (true) with check (true);

-- Allow the supabase-js client (which targets schemas via .schema('mooov'))
-- to see this schema at all. Service-role + authenticated still need USAGE.
grant usage on schema mooov to service_role, authenticated, anon;
grant all on all tables in schema mooov to service_role;
grant select, insert, update, delete on mooov.lodges, mooov.members,
  mooov.payment_attempts, mooov.dues_schedules to authenticated;
grant select on mooov.mooov_webhook_events to authenticated;
alter default privileges in schema mooov
  grant all on tables to service_role;

-- Section 4b. Vault master key for credential encryption.
--
-- The key itself is created out-of-band by the operator running:
--
--   select vault.create_secret(
--     'MOOOV_CRED_MASTER_KEY',
--     '<PASTE_FRESHLY_GENERATED_BASE64_KEY_HERE>'
--   );
--
-- This migration only installs the resolver function so the rest of the
-- application can read the key without poking at vault.* directly. If the
-- secret has not been created yet, mooov.mooov_master_key() returns null
-- and the encrypt/decrypt RPCs will fail loudly on first use.
create or replace function mooov.mooov_master_key() returns text
language sql security definer stable
set search_path = public, extensions, pg_temp
as $$
  select decrypted_secret
  from vault.decrypted_secrets
  where name = 'MOOOV_CRED_MASTER_KEY';
$$;

revoke all on function mooov.mooov_master_key() from public, anon, authenticated;
grant execute on function mooov.mooov_master_key() to service_role;

-- Section 6. SECURITY DEFINER helper that returns the decrypted API-key
-- secret alongside the matching merchant_id and base_url. The bytea
-- ciphertext never crosses the TypeScript boundary; only the decrypted
-- string does, and only the service role can call this function.
create or replace function mooov.get_lodge_mooov_key(p_lodge_id text)
returns table (
  api_key_id text,
  api_key_secret text,
  base_url text,
  merchant_id text
)
language sql
security definer
set search_path = public, extensions, pg_temp
as $$
  select
    c.api_key_id,
    extensions.pgp_sym_decrypt(c.api_key_secret_enc, mooov.mooov_master_key()) as api_key_secret,
    c.base_url,
    l.merchant_id
  from mooov.mooov_credentials c
  join mooov.lodges l on l.id = c.lodge_id
  where c.lodge_id = p_lodge_id;
$$;

revoke all on function mooov.get_lodge_mooov_key(text) from public, anon, authenticated;
grant execute on function mooov.get_lodge_mooov_key(text) to service_role;

-- Section 7. Sibling helper for the inbound-webhook signing secret.
create or replace function mooov.get_lodge_outbound_secret(p_lodge_id text)
returns table (outbound_signing_secret text)
language sql
security definer
set search_path = public, extensions, pg_temp
as $$
  select extensions.pgp_sym_decrypt(
    outbound_signing_secret_enc,
    mooov.mooov_master_key()
  ) as outbound_signing_secret
  from mooov.mooov_credentials
  where lodge_id = p_lodge_id;
$$;

revoke all on function mooov.get_lodge_outbound_secret(text) from public, anon, authenticated;
grant execute on function mooov.get_lodge_outbound_secret(text) to service_role;

-- Section 4c is run separately by the operator (not in this migration)
-- because it embeds the four staging secrets that the user pastes once
-- and never commits. The exact INSERT lives in
-- docs/integrations-evidence.md, with the encryption call wrapped in
-- extensions.pgp_sym_encrypt(<secret>, mooov.mooov_master_key()).
