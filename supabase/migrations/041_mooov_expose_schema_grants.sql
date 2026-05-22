-- 041_mooov_expose_schema_grants
--
-- Companion to 040_mooov_integration. The 040 migration created the
-- mooov schema and granted table-level privileges, but PostgREST
-- additionally needs USAGE on routines and sequences in the schema,
-- plus ALTER DEFAULT PRIVILEGES so future tables/routines created in
-- this schema inherit the same grants. Per the Supabase "Using Custom
-- Schemas" guide (https://supabase.com/docs/guides/api/using-custom-schemas).
--
-- IMPORTANT operator step that is NOT in this migration: Supabase
-- Dashboard -> Project Settings -> API -> Exposed schemas must
-- include `mooov`. Without that toggle, every PostgREST call into
-- this schema returns 406 PGRST106 "Invalid schema: mooov" -- which
-- is the bug that caused the body-less 500s on the first 5 webhook
-- deliveries on 2026-05-19. The SQL below is necessary but not
-- sufficient; the dashboard toggle is the other half.

grant usage on schema mooov to anon, authenticated, service_role;
grant all on all tables    in schema mooov to anon, authenticated, service_role;
grant all on all routines  in schema mooov to anon, authenticated, service_role;
grant all on all sequences in schema mooov to anon, authenticated, service_role;

alter default privileges for role postgres in schema mooov grant all on tables    to anon, authenticated, service_role;
alter default privileges for role postgres in schema mooov grant all on routines  to anon, authenticated, service_role;
alter default privileges for role postgres in schema mooov grant all on sequences to anon, authenticated, service_role;

-- Re-tighten mooov_credentials. The blanket grant above just opened
-- it to anon/authenticated; that's the wrong posture for a table
-- holding (currently unused, but still sensitive) encrypted secrets.
-- 040 already declared this table service-role-only; reapply.
-- (Migration 042 later drops the table entirely, but we keep this
--  block for fresh-environment correctness: 040, 041, 042 must
--  replay in order without errors.)
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'mooov' and table_name = 'mooov_credentials'
  ) then
    execute 'revoke all on mooov.mooov_credentials from anon, authenticated';
    execute 'drop policy if exists "service role only" on mooov.mooov_credentials';
    execute 'create policy "service role only" on mooov.mooov_credentials for all to service_role using (true) with check (true)';
  end if;
end$$;

-- Webhook events: anon and authenticated should NOT be able to write
-- this log; only service_role inserts and the lodge admins read (via
-- existing RLS policy in 040).
revoke insert, update, delete on mooov.mooov_webhook_events from anon, authenticated;
