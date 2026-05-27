-- Migration 057: Raffle wine pledges
--
-- Adds support for "bring a bottle for the raffle" non-cash pledges on the
-- summons RSVP. The cash raffle path (raffle_amount on payments) is left
-- untouched. Wine pledges are tracked on the RSVP row only -- there is no
-- payment associated, because the bottle itself is the donation.
--
-- Event-side fields gate the UI and supply a short description shown on
-- the summons. The RSVP-side fields capture the brother's response.

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS enable_raffle_wine_pledge BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS raffle_wine_description TEXT
    DEFAULT 'Bring a bottle of wine for the evening raffle';

ALTER TABLE rsvps
  ADD COLUMN IF NOT EXISTS raffle_wine_pledged BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS raffle_wine_bottles INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS raffle_wine_note TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'rsvps_raffle_wine_bottles_nonnegative'
      AND conrelid = 'public.rsvps'::regclass
  ) THEN
    ALTER TABLE rsvps
      ADD CONSTRAINT rsvps_raffle_wine_bottles_nonnegative
        CHECK (raffle_wine_bottles >= 0);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'rsvps_raffle_wine_pledge_consistent'
      AND conrelid = 'public.rsvps'::regclass
  ) THEN
    ALTER TABLE rsvps
      ADD CONSTRAINT rsvps_raffle_wine_pledge_consistent
        CHECK (
          (raffle_wine_pledged = TRUE AND raffle_wine_bottles >= 1)
          OR (raffle_wine_pledged = FALSE AND raffle_wine_bottles = 0)
        );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_rsvps_raffle_wine_pledged
  ON rsvps(event_id)
  WHERE raffle_wine_pledged = TRUE;
