-- Migration 061: dues schedules (saved-charge subscription) + pay-in-advance.
--
-- Backs two new flows:
--   1. Yearly dues paid monthly via Mooov saved-charge interim
--      (POST /v1/payment_intents with setup_future_usage, then
--      POST /v1/charges/saved per cycle from a daily LP cron).
--      Migrates to Stripe Subscriptions on the connected account once
--      Mooov ships subscription pass-through (post-2026-06-05) without
--      card re-collection.
--   2. Pay-in-advance for next year's dues (one-off charge today against
--      a member_dues row scoped to the upcoming masonic year).
--
-- Key design choices:
--   * Per-cycle amounts live on member_dues_instalments (already in
--     migration 021). dues_schedules stores only the saved-charge
--     metadata + cron pointer. Means strategy-driven variable-amount
--     schedules (catch-up lump, balloon, reslice) "just work" — the
--     cron reads the next outstanding instalment's amount and posts it.
--   * mooov.dues_schedules from migration 040 is intentionally separate
--     and stays unused; that schema was reserved for the original
--     Mooov-driven design we did not adopt.

-- 1. Mark advance bills explicitly so reports + UI can split them.
alter table public.member_dues
  add column if not exists is_advance boolean not null default false,
  add column if not exists advance_for_year_id uuid
    references public.lodge_masonic_years(id);

create index if not exists idx_member_dues_advance_year
  on public.member_dues(advance_for_year_id);

-- 2. Map an instalment row to the Mooov payment_id that paid it (so the
--    cycle webhook knows exactly which child row to flip) and to its
--    parent dues_schedules row.
alter table public.member_dues_instalments
  add column if not exists mooov_payment_id text,
  add column if not exists schedule_id uuid;

-- 3. Lodge-level controls for the dues subscription experience.
--    Advance discount expressed as a percentage of the annual amount;
--    0 means "pay-in-advance just locks next year, no discount".
alter table public.lodge_dues
  add column if not exists enable_strategy_catch_up_lump boolean not null default true,
  add column if not exists enable_strategy_balloon boolean not null default false,
  add column if not exists enable_strategy_reslice boolean not null default true,
  add column if not exists auto_renew_default boolean not null default true,
  add column if not exists year_start_prompt_days integer not null default 30
    check (year_start_prompt_days between 1 and 180),
  add column if not exists catch_up_max_months integer not null default 6
    check (catch_up_max_months between 1 and 12),
  add column if not exists advance_discount_percent numeric(5,2) not null default 0
    check (advance_discount_percent between 0 and 50);

-- 4. dues_schedules: one row per saved-charge subscription LodgePay runs
--    on behalf of a member. Survives the Stripe Subscriptions migration
--    by gaining a non-null mooov_subscription_id at that point.
create table if not exists public.dues_schedules (
  id uuid primary key default gen_random_uuid(),
  lodge_id uuid not null references public.lodges(id) on delete cascade,
  member_id uuid references public.members(id) on delete set null,
  member_dues_id uuid not null references public.member_dues(id) on delete cascade,
  member_email text not null,
  -- Mooov surface
  customer_ref text not null,
  mooov_payment_method_id text,
  stripe_customer_id text,
  mooov_subscription_id text,
  -- Schedule shape
  cadence text not null default 'monthly'
    check (cadence in ('monthly','quarterly')),
  split_strategy text not null
    check (split_strategy in (
      'pro_rata',
      'even_full_year',
      'catch_up_lump_then_monthly',
      'monthly_then_balloon',
      'reslice_remaining'
    )),
  auto_renew boolean not null default true,
  -- Lifecycle
  status text not null default 'pending'
    check (status in (
      'pending',           -- waiting for first hosted-Checkout success
      'active',            -- charging on schedule
      'action_required',   -- SCA challenge outstanding
      'past_due',          -- last cycle failed; awaiting retry
      'paused',            -- treasurer paused; cron skips
      'cancelled',
      'completed',         -- all cycles paid; fixed-term done
      'active_stripe'      -- migrated to Stripe Subscription post-cutover
    )),
  -- Dunning / SCA
  consecutive_failures integer not null default 0,
  last_failure_code text,
  last_failure_category text,
  last_failure_at timestamptz,
  next_action_client_secret text,
  next_action_connected_account_id text,
  next_action_expires_at timestamptz,
  -- Cron pointer
  next_charge_at date,
  last_charged_at timestamptz,
  cancelled_at timestamptz,
  cancelled_by_actor text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_dues_schedules_lodge
  on public.dues_schedules(lodge_id);
create index if not exists idx_dues_schedules_member_dues
  on public.dues_schedules(member_dues_id);
create index if not exists idx_dues_schedules_status
  on public.dues_schedules(status);
create index if not exists idx_dues_schedules_due_cron
  on public.dues_schedules(status, next_charge_at)
  where status in ('active','past_due');
create unique index if not exists uniq_dues_schedules_mooov_subscription
  on public.dues_schedules(mooov_subscription_id)
  where mooov_subscription_id is not null;

-- 5. Now we can FK member_dues_instalments.schedule_id back, after the
--    target table exists.
alter table public.member_dues_instalments
  drop constraint if exists member_dues_instalments_schedule_id_fkey;
alter table public.member_dues_instalments
  add constraint member_dues_instalments_schedule_id_fkey
  foreign key (schedule_id) references public.dues_schedules(id) on delete set null;

create index if not exists idx_instalments_schedule
  on public.member_dues_instalments(schedule_id);

-- 6. RLS — service role only, matching the pattern used across the
--    public schema for treasury tables.
alter table public.dues_schedules enable row level security;
drop policy if exists "Service role all dues_schedules" on public.dues_schedules;
create policy "Service role all dues_schedules"
  on public.dues_schedules for all
  to service_role
  using (true)
  with check (true);

-- 7. Updated_at trigger so the row touches when the cron flips status
--    or stamps a failure reason. Reuses the standard helper if one
--    exists; otherwise create the touch trigger inline.
create or replace function public.touch_dues_schedules_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_dues_schedules_updated_at on public.dues_schedules;
create trigger trg_dues_schedules_updated_at
  before update on public.dues_schedules
  for each row execute function public.touch_dues_schedules_updated_at();

comment on table public.dues_schedules is
  'Saved-charge subscription state for monthly dues. One row per active or historical schedule per member. Per-cycle amounts live on member_dues_instalments; this table stores Mooov saved-charge metadata, cron position, and dunning state. Migrates to Stripe Subscriptions post-2026-06-05 by populating mooov_subscription_id and flipping status to active_stripe.';

comment on column public.member_dues.is_advance is
  'TRUE when the bill was created as a pay-in-advance for a future masonic year. advance_for_year_id points at the lodge_masonic_years row it relates to. Treasurer reports filter on this to split current-period income from prepaid future-period income.';
