-- Meeting sequences: yearly schedule recipes for regular meetings.
--
-- Most masonic lodges hold their regular meetings on a fixed weekday in
-- a fixed week of selected months (for example "the third Saturday of
-- January, March, June, September and November at 6.00pm"). A sequence
-- captures that recipe so a secretary can generate the year's meetings
-- in one go and have draft summons auto-prepared 4 to 6 weeks ahead.
--
-- IMPORTANT: drafts are auto-created. Sends are NEVER automatic. The
-- summons must be explicitly approved by an admin before the existing
-- /api/summons/[eventId]/send route is allowed to dispatch emails.

CREATE TABLE IF NOT EXISTS public.meeting_sequences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lodge_id uuid NOT NULL REFERENCES public.lodges(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  event_type text NOT NULL DEFAULT 'regular_meeting',

  -- Recipe: which day, which week of the month, which months.
  -- day_of_week uses ISO style 1=Monday .. 7=Sunday.
  day_of_week smallint NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
  -- week_of_month: 1..5 (1st..5th occurrence) or -1 for "last".
  week_of_month smallint NOT NULL CHECK (
    week_of_month IN (1, 2, 3, 4, 5, -1)
  ),
  -- months: 1..12, e.g. {1,3,6,9,11}.
  months smallint[] NOT NULL CHECK (
    array_length(months, 1) BETWEEN 1 AND 12
  ),

  -- Defaults applied when generating events from this sequence.
  default_event_time text,
  default_location text,
  default_temple_room text,
  default_dress_code text,
  default_dining_price numeric(10, 2),
  default_meeting_fee_amount numeric(10, 2),
  default_enable_dining_rsvp boolean NOT NULL DEFAULT false,
  default_enable_meeting_fee boolean NOT NULL DEFAULT false,
  default_enable_charity_donation boolean NOT NULL DEFAULT false,
  default_charity_name text,

  -- Summons workflow.
  -- Lead window in weeks before the event date. The cron creates drafts
  -- when (event_date - now) <= summons_lead_weeks AND there is no
  -- summons row yet. summons_min_lead_weeks is for UI warnings only.
  summons_lead_weeks smallint NOT NULL DEFAULT 6
    CHECK (summons_lead_weeks BETWEEN 1 AND 26),
  summons_min_lead_weeks smallint NOT NULL DEFAULT 4
    CHECK (summons_min_lead_weeks BETWEEN 1 AND 26),
  auto_draft_summons boolean NOT NULL DEFAULT true,

  active boolean NOT NULL DEFAULT true,
  created_by_email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS meeting_sequences_lodge_id_idx
  ON public.meeting_sequences (lodge_id);

ALTER TABLE public.meeting_sequences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role all meeting_sequences"
  ON public.meeting_sequences;
CREATE POLICY "Service role all meeting_sequences"
  ON public.meeting_sequences
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Link generated events back to their sequence and track summons workflow.
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS sequence_id uuid
    REFERENCES public.meeting_sequences(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sequence_position smallint;

CREATE INDEX IF NOT EXISTS events_sequence_id_idx
  ON public.events (sequence_id);

-- Summons lifecycle on the event itself, so the meetings list and the
-- send guard can read it without joining event_summons.
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS summons_status text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS summons_auto_drafted_at timestamptz,
  ADD COLUMN IF NOT EXISTS summons_approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS summons_approved_by_email text,
  ADD COLUMN IF NOT EXISTS summons_last_sent_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'events_summons_status_check'
      AND conrelid = 'public.events'::regclass
  ) THEN
    ALTER TABLE public.events
      ADD CONSTRAINT events_summons_status_check
      CHECK (summons_status IN ('none', 'draft', 'approved', 'sent'));
  END IF;
END $$;

-- Backfill summons_status for events that already have a summons row.
UPDATE public.events e
SET summons_status = 'draft'
WHERE e.summons_status = 'none'
  AND EXISTS (
    SELECT 1 FROM public.event_summons s WHERE s.event_id = e.id
  );

-- Backfill summons_status to 'sent' for events that have at least one
-- successful send recorded.
UPDATE public.events e
SET summons_status = 'sent',
    summons_last_sent_at = COALESCE(
      e.summons_last_sent_at,
      (
        SELECT max(s.created_at)
        FROM public.event_summons_sends s
        WHERE s.event_id = e.id AND s.sent_count > 0
      )
    )
WHERE EXISTS (
  SELECT 1 FROM public.event_summons_sends s
  WHERE s.event_id = e.id AND s.sent_count > 0
);
