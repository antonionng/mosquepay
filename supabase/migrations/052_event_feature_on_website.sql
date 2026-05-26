-- 052_event_feature_on_website.sql
--
-- Public site visibility for events. Lodge meetings and lodges of instruction
-- are private operational data; only "social" and "charity" events should
-- ever appear on the public lodge website by default. A secretary can opt a
-- specific event into the public site (e.g. an installation that welcomes
-- visitors) by flipping feature_on_website to true.
--
-- The application-level helper lib/events/public-visibility.ts encodes the
-- rule:  published = true
--    AND guest_policy != 'closed'
--    AND (event_type in ('social','charity') OR feature_on_website = true)
--
-- This column is the explicit override; the default of false preserves the
-- privacy expectation for every existing row without further migration.

alter table public.events
  add column if not exists feature_on_website boolean not null default false;

comment on column public.events.feature_on_website is
  'When true, this event is eligible to appear on the public lodge website '
  'even though its event_type is not naturally public (e.g. an installation '
  'meeting opened to visiting brethren). Combined with guest_policy != closed '
  'and published = true. Defaults to false so regular lodge meetings and '
  'lodges of instruction stay private unless an admin opts them in.';

-- Partial index supports the public events query path (the only query that
-- filters on this column). Most events will be false, so the partial index
-- stays small and the index-write cost on the common path is zero.
create index if not exists events_feature_on_website_true_idx
  on public.events (lodge_id, event_date)
  where feature_on_website = true;
