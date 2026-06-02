-- 061_demo_reset_gift_aid_function.sql
--
-- Helper function so the demo seeder (`scripts/seed-gift-aid-demo.mjs --reset`)
-- can wipe its prefixed test data and re-seed cleanly. We deliberately make
-- `gift_aid_declaration_events` append-only via the trigger added in 059, so
-- a normal DELETE would be blocked even when cascading from the parent
-- declaration. This SECURITY DEFINER function temporarily flips
-- `session_replication_role = replica` for the duration of the call so the
-- trigger is bypassed for the wipe.
--
-- Safety guards:
--   * only deletes rows whose discriminator columns start with the LP-DEMO /
--     demo+ prefixes used by the seeder
--   * scoped to a single lodge_id argument
--   * never touches anything that is not demo-prefixed
--
-- This function exists so production audit invariants stay intact for real
-- data while still letting us reproduce realistic demo state for testing.

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
  -- Bypass the BEFORE DELETE trigger on gift_aid_declaration_events for
  -- the duration of this transaction so we can cascade-delete the demo
  -- declarations alongside their audit-event rows.
  set local session_replication_role = 'replica';

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

  -- Order matters: child rows before parents.
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
