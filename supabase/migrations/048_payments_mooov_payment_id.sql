-- 048_payments_mooov_payment_id.sql
--
-- Add mooov_payment_id to public.payments so the Mooov webhook handler can
-- dedupe Mooov-routed donation/event payments the same way the legacy Stripe
-- handler dedupes via stripe_payment_intent_id.
--
-- Mooov payment ids look like "don_<lodge>_<rand>" / "evt_<lodge>_<rand>" /
-- "pay_<lodge>_<member>_<period>"; they're our caller-side ids, not Stripe's
-- pi_*. We keep stripe_payment_intent_id around for legacy / direct Stripe
-- rows during the cutover window (Phase 6 / decommission removes it).

alter table public.payments
  add column if not exists mooov_payment_id text;

create unique index if not exists payments_mooov_payment_id_uniq
  on public.payments (mooov_payment_id)
  where mooov_payment_id is not null;

comment on column public.payments.mooov_payment_id is
  'Mooov-side payment id (caller-generated, e.g. don_<lodge>_<rand>). Used as'
  ' the idempotency key for projecting Mooov payment.captured / payment.succeeded'
  ' webhooks into public.payments. Mutually exclusive in practice with'
  ' stripe_payment_intent_id (the latter is set for legacy direct-Stripe rows'
  ' only and will be retired in Phase 6).';
