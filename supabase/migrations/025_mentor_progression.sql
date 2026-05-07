-- Candidate progression, mentor assignments, ritual roles per meeting,
-- and officer succession ladder.

-- Progression dates plus a signoff log keep the audit trail clean.
ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS date_of_passing date,
  ADD COLUMN IF NOT EXISTS date_of_raising date,
  ADD COLUMN IF NOT EXISTS progression_signed_off_initiation boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS progression_signed_off_passing boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS progression_signed_off_raising boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.progression_signoffs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lodge_id uuid NOT NULL REFERENCES public.lodges(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  degree text NOT NULL CHECK (degree IN ('initiation', 'passing', 'raising')),
  signed_off boolean NOT NULL DEFAULT true,
  signed_off_by_admin_user_id uuid REFERENCES public.admin_users(id),
  signed_off_by_member_id uuid REFERENCES public.members(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_progression_signoffs_lodge
  ON public.progression_signoffs(lodge_id);
CREATE INDEX IF NOT EXISTS idx_progression_signoffs_member
  ON public.progression_signoffs(member_id);

ALTER TABLE public.progression_signoffs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role progression signoffs"
  ON public.progression_signoffs;
CREATE POLICY "Service role progression signoffs"
  ON public.progression_signoffs
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.mentor_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lodge_id uuid NOT NULL REFERENCES public.lodges(id) ON DELETE CASCADE,
  mentor_member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  mentee_member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  started_at date NOT NULL DEFAULT CURRENT_DATE,
  ended_at date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mentor_assignments_lodge
  ON public.mentor_assignments(lodge_id);
CREATE INDEX IF NOT EXISTS idx_mentor_assignments_mentor
  ON public.mentor_assignments(mentor_member_id);
CREATE INDEX IF NOT EXISTS idx_mentor_assignments_mentee
  ON public.mentor_assignments(mentee_member_id);

ALTER TABLE public.mentor_assignments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role mentor assignments"
  ON public.mentor_assignments;
CREATE POLICY "Service role mentor assignments"
  ON public.mentor_assignments
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.mentor_contact_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lodge_id uuid NOT NULL REFERENCES public.lodges(id) ON DELETE CASCADE,
  assignment_id uuid REFERENCES public.mentor_assignments(id) ON DELETE CASCADE,
  mentor_member_id uuid REFERENCES public.members(id) ON DELETE SET NULL,
  mentee_member_id uuid REFERENCES public.members(id) ON DELETE SET NULL,
  contacted_at timestamptz NOT NULL DEFAULT now(),
  contact_method text NOT NULL DEFAULT 'meeting'
    CHECK (contact_method IN ('meeting', 'phone', 'video', 'email', 'visit')),
  topic text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mentor_contact_log_lodge
  ON public.mentor_contact_log(lodge_id);
CREATE INDEX IF NOT EXISTS idx_mentor_contact_log_assignment
  ON public.mentor_contact_log(assignment_id);

ALTER TABLE public.mentor_contact_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role mentor contact log"
  ON public.mentor_contact_log;
CREATE POLICY "Service role mentor contact log"
  ON public.mentor_contact_log
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.event_ritual_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lodge_id uuid NOT NULL REFERENCES public.lodges(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  role_title text NOT NULL,
  member_id uuid REFERENCES public.members(id) ON DELETE SET NULL,
  notes text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, role_title)
);

CREATE INDEX IF NOT EXISTS idx_event_ritual_roles_lodge
  ON public.event_ritual_roles(lodge_id);
CREATE INDEX IF NOT EXISTS idx_event_ritual_roles_event
  ON public.event_ritual_roles(event_id);

ALTER TABLE public.event_ritual_roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role event ritual roles"
  ON public.event_ritual_roles;
CREATE POLICY "Service role event ritual roles"
  ON public.event_ritual_roles
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.officer_ladder (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lodge_id uuid NOT NULL REFERENCES public.lodges(id) ON DELETE CASCADE,
  rung_label text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  current_member_id uuid REFERENCES public.members(id) ON DELETE SET NULL,
  successor_member_id uuid REFERENCES public.members(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lodge_id, rung_label)
);

CREATE INDEX IF NOT EXISTS idx_officer_ladder_lodge
  ON public.officer_ladder(lodge_id);

ALTER TABLE public.officer_ladder ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role officer ladder" ON public.officer_ladder;
CREATE POLICY "Service role officer ladder" ON public.officer_ladder
  FOR ALL TO service_role USING (true) WITH CHECK (true);
