-- Migration 058: Meeting sequence defaults for cash raffle and wine pledges
--
-- meeting_sequences is the "recipe" for a year of regular meetings. When a
-- secretary generates the year, each meeting inherits these defaults. We
-- already carry dining/charity defaults; this migration mirrors that
-- pattern for the cash raffle and the bring-a-bottle wine pledge added in
-- migration 057, so a lodge can opt in once and have every generated
-- summons RSVP form pick it up automatically.

ALTER TABLE public.meeting_sequences
  ADD COLUMN IF NOT EXISTS default_enable_raffle_donation BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS default_raffle_description TEXT,
  ADD COLUMN IF NOT EXISTS default_enable_raffle_wine_pledge BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS default_raffle_wine_description TEXT;
