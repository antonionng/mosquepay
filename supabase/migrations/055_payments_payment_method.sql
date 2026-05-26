-- 055_payments_payment_method.sql
--
-- Treasurers still take cash in meetings. As Lodgepay moves the lodge to
-- card/QR, we still need a first-class home for cash, cheque, and BACS
-- entries so the ledger and Gift Aid flow keep working in one place — not on
-- a separate paper sheet that gets lost.
--
-- This migration adds a `payment_method` column to public.payments and
-- backfills it conservatively:
--   * card_qr      — captured via Mooov (in-person QR or hosted page)
--   * card_online  — legacy direct-Stripe checkout (pre-Mooov cutover)
--   * cash         — recorded manually by a treasurer
--   * cheque       — recorded manually, reserved for a follow-up PR
--   * bacs         — recorded manually, reserved for a follow-up PR
--   * other        — escape hatch (rare)
--
-- We also add `payment_method_note` for free-form cash context ("from Bro.
-- Smith for festive board") and `recorded_by_email` so the audit trail
-- knows which admin keyed the row in (the QR flow already stashes this in
-- mooov.payment_attempts.metadata.created_by_email; cash needs the same
-- breadcrumb directly on the projected row).

alter table public.payments
  add column if not exists payment_method text default 'card_qr';

alter table public.payments
  add column if not exists payment_method_note text;

alter table public.payments
  add column if not exists recorded_by_email text;

-- Backfill: assume Mooov-projected rows are card_qr; everything else is
-- card_online (the legacy Stripe path). The default for new rows is card_qr
-- because nearly all new traffic goes through the QR/hosted Mooov flow; the
-- cash endpoint overrides this explicitly.
update public.payments
  set payment_method =
    case
      when mooov_payment_id is not null then 'card_qr'
      when stripe_payment_intent_id is not null then 'card_online'
      else 'card_online'
    end
  where payment_method = 'card_qr'
    and (mooov_payment_id is null or stripe_payment_intent_id is not null);

alter table public.payments
  drop constraint if exists payments_payment_method_chk;

alter table public.payments
  add constraint payments_payment_method_chk
  check (payment_method in (
    'card_qr', 'card_online', 'cash', 'cheque', 'bacs', 'other'
  )) not valid;

alter table public.payments
  validate constraint payments_payment_method_chk;

create index if not exists idx_payments_payment_method
  on public.payments (lodge_id, payment_method, completed_at desc);

comment on column public.payments.payment_method is
  'How the money arrived. card_qr=scanned/hosted Mooov QR, card_online=legacy '
  'direct Stripe checkout, cash/cheque/bacs=treasurer-recorded manual entry, '
  'other=misc. Enforced by payments_payment_method_chk.';

comment on column public.payments.payment_method_note is
  'Optional free-form context for manually recorded payments (e.g. "From '
  'Bro. Smith for festive board"). Surfaced in the admin payments ledger.';

comment on column public.payments.recorded_by_email is
  'Email of the admin who keyed the row in for non-card payments. Mirrors '
  'mooov.payment_attempts.metadata.created_by_email for the cash/cheque/bacs '
  'paths so the audit trail lives directly on public.payments.';
