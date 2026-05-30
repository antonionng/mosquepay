-- Migration 062: canonical member rank + derived Masonic title.
--
-- Locks the previously free-form `members.rank` column to one of five
-- canonical codes and exposes a derived Masonic title for downstream
-- consumers (summons, exports, mail-merge, reports).
--
-- Canonical codes (stored in members.rank):
--   EA      Entered Apprentice
--   FC      Fellow Craft
--   MM      Master Mason
--   Master  Master      (a brother in his year as Worshipful Master)
--   PM      Past Master
--
-- Derived (members.masonic_title, GENERATED ALWAYS AS ... STORED):
--   EA, FC, MM   -> 'Bro'
--   Master, PM   -> 'W Bro'
--
-- Higher Provincial / Grand titles (VW Bro, RW Bro) are not derivable
-- from craft rank alone; they live in member_ranks (migration 026) and
-- can be layered on by the application when rendering names.
--
-- Notes:
--   * masonic_title is a STORED generated column so it cannot be written
--     directly. There is no application path to set it; Postgres rejects
--     INSERT/UPDATE attempts at write time. This is the "non-editable
--     field automatically derived in code" behaviour.
--   * Some legacy rows stored a Masonic TITLE in the rank column
--     ('Bro', 'W Bro') instead of a craft rank. We map those to the
--     canonical rank that yields the SAME derived title, so the rendered
--     name on summons is unchanged:
--         'Bro'   -> 'MM'  (derived title stays 'Bro')
--         'W Bro' -> 'PM'  (derived title stays 'W Bro')
--     This preserves information rather than discarding it.
--   * Any other value outside the canonical set (none currently exist in
--     production) is normalised to NULL as a safety catch-all. Operators
--     can re-set those through the admin UI from the new dropdown.

-- 1. Normalise existing data BEFORE adding the constraint.

-- 1a. Map legacy title-style values onto equivalent canonical ranks.
update public.members set rank = 'MM' where rank = 'Bro';
update public.members set rank = 'PM' where rank = 'W Bro';

-- 1b. Safety catch-all for any remaining non-canonical values.
update public.members
set rank = null
where rank is not null
  and rank not in ('EA', 'FC', 'MM', 'Master', 'PM');

-- 2. Lock the column to the canonical set.
alter table public.members
  drop constraint if exists members_rank_check;

alter table public.members
  add constraint members_rank_check
  check (rank is null or rank in ('EA', 'FC', 'MM', 'Master', 'PM'));

-- 3. Derived, non-editable Masonic title. STORED so it shows up in
--    SELECT * exports without recomputation and so indexes can target it
--    if we ever want to filter by title.
alter table public.members
  drop column if exists masonic_title;

alter table public.members
  add column masonic_title text generated always as (
    case rank
      when 'EA'     then 'Bro'
      when 'FC'     then 'Bro'
      when 'MM'     then 'Bro'
      when 'Master' then 'W Bro'
      when 'PM'     then 'W Bro'
      else null
    end
  ) stored;

comment on column public.members.rank is
  'Canonical craft rank code: EA, FC, MM, Master, PM. Single source of '
  'truth for the brother''s status in the Craft.';

comment on column public.members.masonic_title is
  'Derived Masonic title (Bro, W Bro). Generated from rank; never '
  'written directly. Higher honours (VW Bro, RW Bro) are tracked in '
  'member_ranks and applied at render time.';
