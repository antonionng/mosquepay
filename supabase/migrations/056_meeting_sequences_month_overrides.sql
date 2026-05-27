-- Per-month overrides for meeting sequences.
--
-- Some lodges meet on different weeks (or different weekdays) in different
-- months, e.g. "3rd Saturday in Jan/Mar/Sep/Nov, but 2nd Saturday in Jun".
-- The base sequence still defines the default (week_of_month, day_of_week)
-- pair. month_overrides is a JSON object keyed by month number as a string
-- ("1".."12") whose values may set their own week_of_month and/or
-- day_of_week. Anything missing or unset falls back to the sequence default.
--
-- Example value:
--   {
--     "6":  { "week_of_month": 2 },
--     "11": { "week_of_month": -1, "day_of_week": 5 }
--   }
--
-- The shape is enforced in application code (API validation), not in
-- Postgres, to keep the column flexible if we later add per-month time or
-- location overrides.

ALTER TABLE public.meeting_sequences
  ADD COLUMN IF NOT EXISTS month_overrides jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.meeting_sequences.month_overrides IS
  'JSON object keyed by month number ("1".."12") with optional week_of_month / day_of_week overrides. Falls back to the sequence default when unset.';
