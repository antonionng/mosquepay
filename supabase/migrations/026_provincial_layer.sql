-- Provincial / district tenant layer above lodges.
-- Adds provinces, ranks/honours register, inter-lodge visiting, and
-- supports cross-lodge officer directories and annual returns exports.

-- ---------------------------------------------------------------------------
-- 1. Provinces
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.provinces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  jurisdiction text,
  country text NOT NULL DEFAULT 'United Kingdom',
  contact_email text,
  contact_phone text,
  primary_color text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.lodges
  ADD COLUMN IF NOT EXISTS province_id uuid REFERENCES public.provinces(id)
  ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_lodges_province_id
  ON public.lodges(province_id);

-- ---------------------------------------------------------------------------
-- 2. Ranks & honours register (held per member, scoped per lodge)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.member_ranks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lodge_id uuid NOT NULL REFERENCES public.lodges(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  scope text NOT NULL DEFAULT 'lodge'
    CHECK (scope IN ('lodge', 'provincial', 'grand', 'other')),
  rank_label text NOT NULL,
  conferred_on date,
  conferred_by text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_member_ranks_member_id
  ON public.member_ranks(member_id);
CREATE INDEX IF NOT EXISTS idx_member_ranks_lodge_id
  ON public.member_ranks(lodge_id);

-- ---------------------------------------------------------------------------
-- 3. Inter-lodge visiting log
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.lodge_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visiting_lodge_id uuid NOT NULL REFERENCES public.lodges(id) ON DELETE CASCADE,
  host_lodge_id uuid REFERENCES public.lodges(id) ON DELETE SET NULL,
  host_lodge_name text,
  member_id uuid REFERENCES public.members(id) ON DELETE SET NULL,
  member_name text,
  visit_date date NOT NULL,
  occasion text,
  notes text,
  recorded_by_admin_user_id uuid REFERENCES public.admin_users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lodge_visits_visiting_lodge
  ON public.lodge_visits(visiting_lodge_id, visit_date DESC);
CREATE INDEX IF NOT EXISTS idx_lodge_visits_host_lodge
  ON public.lodge_visits(host_lodge_id);

-- ---------------------------------------------------------------------------
-- 4. Convenience view: cross-lodge officer directory by province
-- ---------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.province_officer_directory AS
SELECT
  l.province_id,
  l.id AS lodge_id,
  l.name AS lodge_name,
  l.lodge_number,
  m.id AS member_id,
  m.full_name,
  m.office_title,
  m.officer_sort_order,
  m.email,
  m.rank
FROM public.members m
JOIN public.lodges l ON l.id = m.lodge_id
WHERE m.office_title IS NOT NULL AND m.membership_status = 'active';

-- ---------------------------------------------------------------------------
-- 5. Convenience view: annual returns aggregate (per lodge)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.lodge_annual_returns AS
SELECT
  l.id AS lodge_id,
  l.province_id,
  l.name AS lodge_name,
  l.lodge_number,
  COUNT(*) FILTER (WHERE m.membership_status = 'active') AS active_members,
  COUNT(*) FILTER (WHERE m.membership_status = 'resigned') AS resigned_members,
  COUNT(*) FILTER (WHERE m.membership_status = 'excluded') AS excluded_members,
  COUNT(*) FILTER (
    WHERE m.date_of_initiation IS NOT NULL
      AND m.date_of_initiation >= date_trunc('year', now())
  ) AS initiations_ytd,
  COUNT(*) FILTER (
    WHERE m.date_of_passing IS NOT NULL
      AND m.date_of_passing >= date_trunc('year', now())
  ) AS passings_ytd,
  COUNT(*) FILTER (
    WHERE m.date_of_raising IS NOT NULL
      AND m.date_of_raising >= date_trunc('year', now())
  ) AS raisings_ytd
FROM public.lodges l
LEFT JOIN public.members m ON m.lodge_id = l.id
GROUP BY l.id, l.province_id, l.name, l.lodge_number;
