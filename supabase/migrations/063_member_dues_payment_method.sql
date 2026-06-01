-- 063_member_dues_payment_method.sql
--
-- Track *how* each member is paying this year's dues alongside the
-- existing status (paid / outstanding / partial / waived). Until now
-- this signal was implicit and fragmented: an active dues_schedules
-- row meant "online subscription"; payments.payment_method='bacs'
-- hinted "BACS"; member_dues.waiver_reason hinted "waived". Treasurers
-- have no single column to read off, no way to mark a member as a
-- known BACS payer before any cash has cleared, and no audit trail
-- for "we agreed Bro X pays in full / fee waived".
--
-- The new column lives on member_dues (per masonic year) rather than
-- members (lodge-wide forever), because a member can move between
-- methods year to year without the admin having to remember to reset
-- the flag.
--
-- Methods:
--   'online_subscription' - paying via Mooov subscription / saved-charge.
--                           Auto-set when a dues_schedules row activates;
--                           admin can pre-tag before enrolment.
--   'bacs'                - external bank transfer; treasurer
--                           reconciles manually. bacs_monthly_amount
--                           captures the standing-order amount they've
--                           told us they pay.
--   'paid_in_full'        - admin marks "they paid me in full somehow"
--                           outside the platform (cheque, cash on the
--                           night, transfer, etc.). Status flips to
--                           'paid'.
--   'fee_waived'          - lodge has waived dues for this year for
--                           this member. Status flips to 'waived' and
--                           waiver_reason is filled in.
--
-- A NULL method means "we haven't tagged this yet" (outstanding).

alter table public.member_dues
  add column if not exists dues_payment_method text
    check (
      dues_payment_method is null
      or dues_payment_method in (
        'online_subscription',
        'bacs',
        'paid_in_full',
        'fee_waived'
      )
    ),
  add column if not exists bacs_monthly_amount numeric(10, 2),
  add column if not exists bacs_reference text,
  add column if not exists payment_method_set_by text,
  add column if not exists payment_method_set_at timestamptz;

-- Treasurer dashboard tile + members list column both filter by
-- (lodge_id, dues_payment_method) frequently. Compound index keeps
-- them snappy as the lodge grows.
create index if not exists idx_member_dues_lodge_method
  on public.member_dues(lodge_id, dues_payment_method);

-- One-shot back-fill for the obvious case: any member_dues row with an
-- active dues_schedule already counts as 'online_subscription'. We
-- skip rows where dues_payment_method is already set so re-running the
-- migration is safe.
update public.member_dues md
set
  dues_payment_method = 'online_subscription',
  payment_method_set_by = 'system_backfill_063',
  payment_method_set_at = now()
where
  md.dues_payment_method is null
  and exists (
    select 1
    from public.dues_schedules ds
    where ds.member_dues_id = md.id
      and ds.lodge_id = md.lodge_id
      and ds.status in ('active', 'active_stripe', 'past_due', 'action_required', 'paused')
  );

-- Also back-fill 'fee_waived' for any row already in waived state with
-- a waiver_reason. Treasurers can later re-tag if they disagree.
update public.member_dues
set
  dues_payment_method = 'fee_waived',
  payment_method_set_by = 'system_backfill_063',
  payment_method_set_at = now()
where
  dues_payment_method is null
  and status = 'waived';

-- And 'paid_in_full' for plain status='paid' rows that don't already
-- have a subscription tag. Conservative: anything paid without a
-- schedule was paid by some other method (one-off online, cash on the
-- night, etc.); the treasurer can re-tag if any of those should
-- actually be 'bacs'.
update public.member_dues md
set
  dues_payment_method = 'paid_in_full',
  payment_method_set_by = 'system_backfill_063',
  payment_method_set_at = now()
where
  md.dues_payment_method is null
  and md.status = 'paid';

comment on column public.member_dues.dues_payment_method is
  'How this member is paying this year''s dues. Drives treasurer dashboard breakdown + member-detail dues panel.';
comment on column public.member_dues.bacs_monthly_amount is
  'Monthly standing-order amount when dues_payment_method = ''bacs''.';
comment on column public.member_dues.bacs_reference is
  'Optional BACS reference / payee note (e.g. "BRO ANTONIO 25/26") for treasurer reconciliation.';
