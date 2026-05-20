-- Canonical lodge offices.
--
-- Promotes `officer_ladder` to be the single source of truth for "who holds
-- what office", and seeds every lodge with the standard UGLE craft offices so
-- the new Members → Offices tab has a clean, finite list out of the box.
--
-- A trigger keeps the denormalised `members.office_title` /
-- `members.officer_sort_order` columns in sync, so the existing summons
-- rendering (which reads from the member rows) keeps working unchanged.
--
-- Members can hold MULTIPLE offices simultaneously (smaller lodges routinely
-- combine Secretary + Charity Steward + Membership Officer in one brother).
-- `members.office_title` therefore stores a semicolon-separated list of all
-- offices the member currently holds, and `officer_sort_order` mirrors the
-- lowest (most senior) sort order across those offices.
--
-- Idempotent so it can be replayed safely.

-- ---------------------------------------------------------------------------
-- Canonical offices reference data
--
-- Labels match the abbreviations already used on the printed Covenant summons
-- so that the backfill of existing `members.office_title` values lands on the
-- right rung without creating duplicates.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.canonical_offices()
RETURNS TABLE (rung_label text, sort_order integer)
LANGUAGE sql
IMMUTABLE
AS $$
  VALUES
    ('Worshipful Master',              10),
    ('Immediate Past Master',          20),
    ('Master Elect',                   30),
    ('Senior Warden',                  40),
    ('Junior Warden',                  50),
    ('Chaplain',                       60),
    ('Treasurer',                      70),
    ('Secretary',                      80),
    ('Assistant Secretary',            85),
    ('Director of Ceremonies',         90),
    ('Assistant Director of Ceremonies', 95),
    ('Almoner',                       100),
    ('Charity Steward',               110),
    ('Membership Officer',            120),
    ('Mentor',                        130),
    ('Senior Deacon',                 140),
    ('Junior Deacon',                 150),
    ('Inner Guard',                   160),
    ('Senior Steward',                170),
    ('Steward',                       180),
    ('Royal Arch Rep',                190),
    ('Organist',                      200),
    ('Guest Organist',                205),
    ('Tyler',                         210);
$$;

-- ---------------------------------------------------------------------------
-- Seed canonical offices for every existing lodge
-- ---------------------------------------------------------------------------

INSERT INTO public.officer_ladder (lodge_id, rung_label, sort_order)
SELECT l.id, o.rung_label, o.sort_order
FROM public.lodges l
CROSS JOIN public.canonical_offices() o
ON CONFLICT (lodge_id, rung_label) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Auto-seed canonical offices for newly created lodges
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.seed_canonical_offices_for_lodge()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.officer_ladder (lodge_id, rung_label, sort_order)
  SELECT NEW.id, o.rung_label, o.sort_order
  FROM public.canonical_offices() o
  ON CONFLICT (lodge_id, rung_label) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS seed_canonical_offices ON public.lodges;
CREATE TRIGGER seed_canonical_offices
  AFTER INSERT ON public.lodges
  FOR EACH ROW
  EXECUTE FUNCTION public.seed_canonical_offices_for_lodge();

-- ---------------------------------------------------------------------------
-- Backfill: pull any existing office_title from members into the ladder.
--
-- members.office_title is split on ';' so that someone recorded as
-- "Secretary; Charity Steward; Membership Officer" claims all three rungs.
-- If a fragment matches a canonical rung (case-insensitive) we set them as
-- the current holder; if it's a label we don't know about we insert a custom
-- rung so nothing is lost.
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  m record;
  raw_label text;
  clean_label text;
  rung_id uuid;
BEGIN
  FOR m IN
    SELECT id, lodge_id, office_title, officer_sort_order
    FROM public.members
    WHERE office_title IS NOT NULL
      AND length(trim(office_title)) > 0
  LOOP
    FOREACH raw_label IN ARRAY string_to_array(m.office_title, ';')
    LOOP
      clean_label := trim(raw_label);
      CONTINUE WHEN clean_label = '';

      SELECT id INTO rung_id
      FROM public.officer_ladder
      WHERE lodge_id = m.lodge_id
        AND lower(rung_label) = lower(clean_label)
      LIMIT 1;

      IF rung_id IS NULL THEN
        INSERT INTO public.officer_ladder (
          lodge_id, rung_label, sort_order, current_member_id
        )
        VALUES (
          m.lodge_id,
          clean_label,
          COALESCE(m.officer_sort_order, 999),
          m.id
        )
        ON CONFLICT (lodge_id, rung_label) DO NOTHING;
      ELSE
        UPDATE public.officer_ladder
        SET current_member_id = m.id, updated_at = now()
        WHERE id = rung_id
          AND current_member_id IS NULL;
      END IF;
    END LOOP;
  END LOOP;
END
$$;

-- ---------------------------------------------------------------------------
-- Sync member denormalised office_title / officer_sort_order
--
-- officer_ladder is the source of truth. After any change to the ladder we
-- recompute the affected member rows from the ladder, joining all offices
-- they currently hold into a single "; "-separated label and taking the
-- lowest sort_order as the canonical sort.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.refresh_member_offices(p_member_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_title text;
  v_sort integer;
BEGIN
  IF p_member_id IS NULL THEN
    RETURN;
  END IF;

  SELECT string_agg(rung_label, '; ' ORDER BY sort_order),
         MIN(sort_order)
    INTO v_title, v_sort
  FROM public.officer_ladder
  WHERE current_member_id = p_member_id;

  UPDATE public.members
  SET office_title = v_title,
      officer_sort_order = v_sort,
      updated_at = now()
  WHERE id = p_member_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_member_office_from_ladder()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.refresh_member_offices(NEW.current_member_id);
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    PERFORM public.refresh_member_offices(OLD.current_member_id);
    RETURN OLD;
  END IF;

  -- UPDATE
  IF OLD.current_member_id IS DISTINCT FROM NEW.current_member_id THEN
    PERFORM public.refresh_member_offices(OLD.current_member_id);
    PERFORM public.refresh_member_offices(NEW.current_member_id);
  ELSIF (OLD.rung_label IS DISTINCT FROM NEW.rung_label
         OR OLD.sort_order IS DISTINCT FROM NEW.sort_order)
        AND NEW.current_member_id IS NOT NULL THEN
    PERFORM public.refresh_member_offices(NEW.current_member_id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_member_office_from_ladder
  ON public.officer_ladder;
CREATE TRIGGER sync_member_office_from_ladder
  AFTER INSERT OR UPDATE OR DELETE ON public.officer_ladder
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_member_office_from_ladder();

-- ---------------------------------------------------------------------------
-- One-shot reconciliation so existing members.office_title is recomputed
-- from the now-populated ladder.
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  member_id uuid;
BEGIN
  FOR member_id IN
    SELECT DISTINCT current_member_id
    FROM public.officer_ladder
    WHERE current_member_id IS NOT NULL
  LOOP
    PERFORM public.refresh_member_offices(member_id);
  END LOOP;

  -- Clear office_title for anyone no longer matched to any rung.
  UPDATE public.members m
  SET office_title = NULL,
      officer_sort_order = NULL,
      updated_at = now()
  WHERE office_title IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.officer_ladder l
      WHERE l.current_member_id = m.id
    );
END
$$;
