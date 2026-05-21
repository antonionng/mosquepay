-- 047_mooov_payment_attempts_guest_support.sql
--
-- Allow mooov.payment_attempts to carry payments where there is no LodgePay
-- member behind the charge (guest event payments, anonymous donations, etc.).
--
-- Existing shape assumed dues, so every row needed a mooov.members.id. Once
-- "everything runs through Mooov" we'll be persisting:
--   * dues       -> member_id set, guest_descriptor null
--   * events     -> member_id null, guest_descriptor {email,name,event_id,...}
--   * donations  -> member_id null, guest_descriptor {email,name,...}
--
-- Changes:
--   1. Drop the strict mooov.members FK so non-member rows can persist. We
--      keep the column as text so dues continue to write the real member id.
--   2. Add guest_descriptor jsonb for the non-member metadata above.

alter table mooov.payment_attempts
  drop constraint if exists payment_attempts_member_id_fkey;

alter table mooov.payment_attempts
  add column if not exists guest_descriptor jsonb;

comment on column mooov.payment_attempts.member_id is
  'LodgePay member id when the charge is on behalf of a known member (dues).'
  ' Nullable: guest/anonymous charges (events, donations) set this to NULL'
  ' and populate guest_descriptor instead. No FK to mooov.members on purpose'
  ' so guest pseudo-ids do not violate referential integrity.';

comment on column mooov.payment_attempts.guest_descriptor is
  'Free-form jsonb capturing the payer for non-member charges. Conventional'
  ' keys: email, name, event_id, donation_id, source. NULL for dues.';
