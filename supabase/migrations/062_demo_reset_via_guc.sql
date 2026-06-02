-- 062_demo_reset_via_guc.sql
--
-- Migration 061 tried to bypass the append-only trigger on
-- gift_aid_declaration_events by flipping session_replication_role
-- inside the demo reset function. On managed Supabase that GUC is
-- superuser-only, so the function 500'd when called from the seeder.
--
-- Replace that approach with a narrowly-scoped custom GUC the trigger
-- explicitly honours: `app.demo_reset_bypass = 'on'`. The demo reset
-- function sets the GUC for the local transaction; the trigger checks
-- it and allows the delete. Anyone else mutating the table still hits
-- the EXCEPTION because the GUC defaults to empty.
--
-- Custom GUCs prefixed with a dot can be set by any role without
-- superuser privileges, so this works under the standard Supabase
-- postgres role.

create or replace function public.forbid_gift_aid_declaration_event_mutation()
returns trigger
language plpgsql
as $$
begin
  -- Demo seeder reset path: explicit bypass via a per-transaction GUC.
  -- Anything else still gets the append-only error.
  if current_setting('app.demo_reset_bypass', true) = 'on' then
    return coalesce(OLD, NEW);
  end if;
  raise exception 'gift_aid_declaration_events is append-only';
end;
$$;

create or replace function public._demo_reset_gift_aid_data(p_lodge_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_event_ids uuid[];
  v_batch_ids uuid[];
  v_decl_ids  uuid[];
  v_member_ids uuid[];
begin
  -- Tell the append-only trigger to stand down for this transaction.
  perform set_config('app.demo_reset_bypass', 'on', true);

  select array(select id from public.events
                where lodge_id = p_lodge_id and slug like 'demo-%')
    into v_event_ids;
  select array(select id from public.gift_aid_claim_batches
                where lodge_id = p_lodge_id and claim_reference like 'LP-DEMO-MEET-%')
    into v_batch_ids;
  select array(select id from public.gift_aid_declarations
                where lodge_id = p_lodge_id and paper_filing_reference like 'LP-DEMO-DECL-%')
    into v_decl_ids;
  select array(select id from public.members
                where lodge_id = p_lodge_id and email like 'demo+%@lodgepay-test.test')
    into v_member_ids;

  delete from public.gift_aid_claim_declarations where claim_batch_id = any (v_batch_ids);
  delete from public.gift_aid_claim_items       where claim_batch_id = any (v_batch_ids);
  delete from public.donations                  where event_id = any (v_event_ids);
  delete from public.payments                   where event_id = any (v_event_ids);
  delete from public.meeting_collections        where event_id = any (v_event_ids);
  delete from public.rsvps                      where event_id = any (v_event_ids);
  delete from public.event_summons_sends        where event_id = any (v_event_ids);
  delete from public.event_summons_access_links where event_id = any (v_event_ids);
  delete from public.event_summons              where event_id = any (v_event_ids);
  delete from public.event_fee_overrides        where event_id = any (v_event_ids);
  delete from public.event_guests               where event_id = any (v_event_ids);
  delete from public.event_ritual_roles         where event_id = any (v_event_ids);
  delete from public.guest_invitations          where event_id = any (v_event_ids);
  delete from public.events                     where id = any (v_event_ids);
  delete from public.gift_aid_claim_batches     where id = any (v_batch_ids);
  delete from public.gift_aid_declaration_events where declaration_id = any (v_decl_ids);
  delete from public.gift_aid_declarations      where id = any (v_decl_ids);
  delete from public.members                    where id = any (v_member_ids);
end;
$$;

revoke all on function public._demo_reset_gift_aid_data(uuid) from public;
grant execute on function public._demo_reset_gift_aid_data(uuid) to service_role;
