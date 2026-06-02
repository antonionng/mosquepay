-- 063_backfill_charity_payment_donations.sql
--
-- Backfill `donations` rows from historical charity payments.
--
-- Background: charity money taken via the in-person take-payment / QR / cash
-- flow (and online event RSVP charity portions) was recorded only on
-- public.payments.charity_amount. The Gift Aid surfaces (admin Gift Aid page,
-- per-meeting close batch, donations list) read the public.donations table,
-- so that charity was invisible to Gift Aid and could never be reclaimed --
-- even after the donor's declaration was added.
--
-- The application now writes an event-linked donation row at capture time for
-- every charity entry. This migration repairs the rows that predate that fix:
-- one donation per succeeded payment that carries charity income and does not
-- already have a donation linked to it.
--
-- Why this is enough to be "retrospective": the Gift Aid claim batcher matches
-- a donation to a declaration BY EMAIL at claim time
-- (lib/gift-aid/eligible.ts). So a donation backfilled here with status
-- 'eligible' becomes reclaimable the moment a matching declaration exists --
-- whether the declaration was added before or after this migration runs.
--
-- Idempotent: the NOT EXISTS guard means a re-run inserts nothing, and it
-- never touches payments that already produced a donation row (go-forward
-- captures, online donations, dues charitable portions, etc.).

INSERT INTO public.donations (
  lodge_id,
  event_id,
  payment_id,
  donor_name,
  donor_email,
  amount,
  currency,
  source,
  status,
  gift_aid_declaration_id,
  gift_aid_status,
  gift_aid_eligible_amount,
  gasds_eligible,
  created_at
)
SELECT
  p.lodge_id,
  p.event_id,
  p.id,
  p.user_name,
  COALESCE(NULLIF(TRIM(p.user_email), ''), '') AS donor_email,
  p.charity_amount,
  LOWER(COALESCE(NULLIF(TRIM(p.currency), ''), 'gbp')) AS currency,
  CASE
    WHEN p.payment_method = 'cash' THEN 'in_person_take_payment_cash'
    WHEN p.payment_method = 'card_qr' THEN 'in_person_take_payment'
    ELSE 'event_charity'
  END AS source,
  'completed' AS status,
  NULL::uuid AS gift_aid_declaration_id,
  -- 'eligible' when we have an email to match a declaration against,
  -- otherwise 'unknown' (anonymous cash: counts as income, not reclaimable).
  CASE
    WHEN COALESCE(NULLIF(TRIM(p.user_email), ''), '') <> '' THEN 'eligible'
    ELSE 'unknown'
  END AS gift_aid_status,
  0 AS gift_aid_eligible_amount,
  FALSE AS gasds_eligible,
  -- Date the donation to when the money actually came in so it lands in the
  -- correct tax year / per-meeting claim window.
  COALESCE(p.completed_at, p.created_at, NOW()) AS created_at
FROM public.payments p
WHERE p.charity_amount > 0
  AND p.status IN ('succeeded', 'completed', 'paid', 'partially_refunded')
  AND NOT EXISTS (
    SELECT 1
    FROM public.donations d
    WHERE d.payment_id = p.id
  );
