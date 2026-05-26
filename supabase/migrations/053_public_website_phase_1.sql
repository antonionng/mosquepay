-- 053_public_website_phase_1
--
-- Phase 1 of the lodge website overhaul. Adds the structured fields the
-- public site needs to stop relying on hardcoded placeholders, and adds the
-- per-member opt-in flags required to render real officers without
-- exposing any member who has not explicitly agreed.
--
-- Privacy is the headline: every new visibility flag defaults to false.
-- No existing data becomes public as a side effect of running this
-- migration.

-- ---------------------------------------------------------------------------
-- Lodge: structured meeting venue and accessibility fields
-- ---------------------------------------------------------------------------
-- `secretary_address` is the correspondence address used on summons. The
-- public website needs a distinct "meeting venue" (the hall the lodge
-- actually meets in), a map link visitors can tap, an accessibility note,
-- and a default dress code so the meeting details cards can stand on
-- their own without copy-paste from another field.

alter table public.lodges
  add column if not exists meeting_location text,
  add column if not exists meeting_location_url text,
  add column if not exists accessibility_notes text,
  add column if not exists default_dress_code text;

comment on column public.lodges.meeting_location is
  'Public-facing meeting venue (e.g. "Mark Masons Hall, 86 St Jamess Street, London"). '
  'Distinct from secretary_address (used on summons). Surfaced on the public site '
  'Meeting Details cards.';
comment on column public.lodges.meeting_location_url is
  'Optional URL for the meeting venue, typically a Google Maps / What3Words / venue '
  'page link. When set the public Meeting Details card renders the venue as a tappable '
  'link so visitors can get directions.';
comment on column public.lodges.accessibility_notes is
  'Short note about wheelchair access, hearing loops, parking, or other accessibility '
  'considerations for visitors. Rendered on the public Meeting Details card when set.';
comment on column public.lodges.default_dress_code is
  'Default lodge dress code shown on the public site Meeting Details card and used as '
  'a fallback when an individual event has no dress_code set.';

-- ---------------------------------------------------------------------------
-- Member: per-member opt-in for the public website
-- ---------------------------------------------------------------------------
-- Even when an officer holds an elected office in the OfficerLadder, their
-- name and photo never leave the admin until they tick "Show on public
-- website". This keeps the lodge in control of who appears publicly and
-- gives us a clean GDPR story: explicit consent, recorded per-member,
-- revocable at any time.

alter table public.members
  add column if not exists show_on_website boolean not null default false,
  add column if not exists public_bio text,
  add column if not exists public_photo_url text;

comment on column public.members.show_on_website is
  'Per-member opt-in flag controlling whether the member is eligible to be rendered '
  'on the public lodge website (currently the Officers section). Defaults to false. '
  'Combined with the member holding an officer rung in officer_ladder.';
comment on column public.members.public_bio is
  'Short public-facing biography (one or two paragraphs) shown alongside the member '
  'on the public Officers section when show_on_website is true. Plain text; line '
  'breaks are preserved at render time.';
comment on column public.members.public_photo_url is
  'Optional headshot URL shown alongside the member on the public Officers section. '
  'Falls back to initials when null. Hosted via the lodge image upload pipeline.';

-- Helper index: the officers panel reads a tiny per-lodge list of members
-- who have opted in. A partial index keeps the index size proportional to
-- the opt-in population rather than the full member roll.
create index if not exists members_show_on_website_true_idx
  on public.members (lodge_id)
  where show_on_website = true;
