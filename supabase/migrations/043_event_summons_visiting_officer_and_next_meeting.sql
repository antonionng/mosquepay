-- Adds structured fields the printed summons captures but that the schema did
-- not have a home for: visiting officer details, the next meeting date, and
-- the master elect's qualification line.
--
-- Idempotent so it can be replayed safely.

ALTER TABLE public.event_summons
  ADD COLUMN IF NOT EXISTS visiting_officer_name text,
  ADD COLUMN IF NOT EXISTS visiting_officer_email text,
  ADD COLUMN IF NOT EXISTS visiting_officer_phone text,
  ADD COLUMN IF NOT EXISTS next_meeting_date date,
  ADD COLUMN IF NOT EXISTS next_meeting_note text,
  ADD COLUMN IF NOT EXISTS master_elect_name text,
  ADD COLUMN IF NOT EXISTS master_elect_qualification text;

COMMENT ON COLUMN public.event_summons.visiting_officer_name IS
  'Visiting Officer (VO) named on the printed summons, e.g. "W Bro Jim Heatley LGR".';
COMMENT ON COLUMN public.event_summons.visiting_officer_email IS
  'Contact email for the Visiting Officer.';
COMMENT ON COLUMN public.event_summons.visiting_officer_phone IS
  'Optional contact phone for the Visiting Officer.';
COMMENT ON COLUMN public.event_summons.next_meeting_date IS
  'Date of the next regular meeting, printed at the foot of the summons.';
COMMENT ON COLUMN public.event_summons.next_meeting_note IS
  'Free-form note printed beside the next meeting date, e.g. "Installation".';
COMMENT ON COLUMN public.event_summons.master_elect_name IS
  'Master Elect being installed at this meeting, used to enrich agenda item 3.';
COMMENT ON COLUMN public.event_summons.master_elect_qualification IS
  'Qualifying statement for the Master Elect, e.g. "Qualified to serve by virtue of holding the office of WM of Park Street Lodge 8556 in the year 2004-05.".';
