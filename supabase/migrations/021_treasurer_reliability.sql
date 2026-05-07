-- Treasurer reliability: per-instalment schedule, dues reminder tracking,
-- and a unified financial ledger view across payments, dues, and donations.

-- 1. Per-instalment rows for a single MemberDues record. Allows clear
--    schedules ("instalment 3 of 12") and per-row paid/overdue status without
--    fragmenting MemberDues itself.
CREATE TABLE IF NOT EXISTS public.member_dues_instalments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lodge_id uuid NOT NULL REFERENCES public.lodges(id) ON DELETE CASCADE,
  member_dues_id uuid NOT NULL REFERENCES public.member_dues(id) ON DELETE CASCADE,
  sequence integer NOT NULL,
  due_date date NOT NULL,
  amount numeric(12, 2) NOT NULL,
  currency text NOT NULL DEFAULT 'gbp',
  status text NOT NULL DEFAULT 'outstanding'
    CHECK (status IN ('outstanding', 'paid', 'waived', 'overdue')),
  paid_at timestamptz,
  reminder_sent_at timestamptz,
  payment_reference text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (member_dues_id, sequence)
);

CREATE INDEX IF NOT EXISTS idx_member_dues_instalments_lodge
  ON public.member_dues_instalments(lodge_id);
CREATE INDEX IF NOT EXISTS idx_member_dues_instalments_due_date
  ON public.member_dues_instalments(due_date);
CREATE INDEX IF NOT EXISTS idx_member_dues_instalments_status
  ON public.member_dues_instalments(status);

ALTER TABLE public.member_dues_instalments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role all member dues instalments"
  ON public.member_dues_instalments;
CREATE POLICY "Service role all member dues instalments"
  ON public.member_dues_instalments FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 2. Track dues reminders so we never spam.
ALTER TABLE public.member_dues
  ADD COLUMN IF NOT EXISTS reminder_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS reminder_count integer NOT NULL DEFAULT 0;

-- 3. Treasurer ledger: a server-side view that normalises every financial
--    event into a single reportable shape. Built as a regular VIEW so it is
--    always live; can be promoted to a materialised view later if needed.
CREATE OR REPLACE VIEW public.treasurer_ledger AS
SELECT
  p.id AS source_id,
  'payment'::text AS source_type,
  p.lodge_id,
  COALESCE(p.completed_at, p.created_at) AS occurred_at,
  p.user_email AS contact_email,
  p.user_name AS contact_name,
  p.total_amount AS amount,
  COALESCE(p.refund_amount, 0) AS refund_amount,
  p.currency,
  p.status,
  CASE
    WHEN p.event_id IS NOT NULL THEN 'event'
    ELSE 'general'
  END AS category,
  jsonb_build_object(
    'event_id', p.event_id,
    'rsvp_id', p.rsvp_id,
    'dining', p.dining_amount,
    'meeting_fee', p.meeting_fee_amount,
    'charity', p.charity_amount,
    'raffle', p.raffle_amount,
    'guest_ticket', p.guest_ticket_amount,
    'charity_name', p.charity_name,
    'reference', p.stripe_payment_intent_id
  ) AS metadata
FROM public.payments p

UNION ALL

SELECT
  d.id AS source_id,
  'dues'::text AS source_type,
  d.lodge_id,
  COALESCE(d.paid_at, d.updated_at, d.created_at) AS occurred_at,
  d.member_email AS contact_email,
  d.member_name AS contact_name,
  d.amount,
  0::numeric AS refund_amount,
  d.currency,
  d.status,
  'dues'::text AS category,
  jsonb_build_object(
    'period_start', d.period_start,
    'period_end', d.period_end,
    'dues_id', d.dues_id,
    'reminder_count', d.reminder_count
  ) AS metadata
FROM public.member_dues d

UNION ALL

SELECT
  don.id AS source_id,
  'donation'::text AS source_type,
  don.lodge_id,
  don.created_at AS occurred_at,
  don.donor_email AS contact_email,
  don.donor_name AS contact_name,
  don.amount,
  0::numeric AS refund_amount,
  don.currency,
  don.status,
  'donation'::text AS category,
  jsonb_build_object(
    'event_id', don.event_id,
    'campaign_id', don.campaign_id,
    'gift_aid_status', don.gift_aid_status,
    'source', don.source
  ) AS metadata
FROM public.donations don;

COMMENT ON VIEW public.treasurer_ledger IS
  'Unified financial ledger across payments, member dues, and donations. '
  'Use for treasurer reporting and bank reconciliation.';
