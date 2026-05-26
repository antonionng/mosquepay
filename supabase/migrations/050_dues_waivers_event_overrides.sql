-- Profile-level annual dues waiver, per-record dues waiver note,
-- event-wide dining waiver, and per-recipient event fee overrides.

ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS annual_dues_waived boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS annual_dues_waiver_reason text;

ALTER TABLE public.member_dues
  ADD COLUMN IF NOT EXISTS waiver_reason text;

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS dining_waived_for_all boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.event_fee_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lodge_id uuid NOT NULL REFERENCES public.lodges(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  subject_type text NOT NULL CHECK (subject_type IN ('member', 'guest')),
  subject_id uuid NOT NULL,
  levy_amount numeric(10, 2),
  dining_amount numeric(10, 2),
  levy_waived boolean NOT NULL DEFAULT false,
  dining_waived boolean NOT NULL DEFAULT false,
  note text,
  created_by_email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, subject_type, subject_id)
);

CREATE INDEX IF NOT EXISTS idx_event_fee_overrides_event
  ON public.event_fee_overrides(event_id);

CREATE INDEX IF NOT EXISTS idx_event_fee_overrides_lodge
  ON public.event_fee_overrides(lodge_id);

ALTER TABLE public.event_fee_overrides ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role all event fee overrides" ON public.event_fee_overrides;
CREATE POLICY "Service role all event fee overrides"
  ON public.event_fee_overrides FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Expose waiver_reason in the treasurer ledger so the UI can render the
-- reason inline next to a waived dues entry. The CREATE OR REPLACE keeps
-- column compatibility with migration 021's projection.
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
    'reminder_count', d.reminder_count,
    'waiver_reason', d.waiver_reason
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
