-- Almoner module: welfare cases, visits log, bereavement and widow registers,
-- and a generated care-alerts table for missed meetings or overdue dues.
--
-- Care alerts are write-only inserts surfaced to the almoner; the almoner can
-- acknowledge them.

CREATE TABLE IF NOT EXISTS public.welfare_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lodge_id uuid NOT NULL REFERENCES public.lodges(id) ON DELETE CASCADE,
  member_id uuid REFERENCES public.members(id) ON DELETE SET NULL,
  contact_name text NOT NULL,
  contact_email text,
  contact_phone text,
  case_type text NOT NULL DEFAULT 'general'
    CHECK (case_type IN ('general', 'illness', 'bereavement', 'financial', 'family', 'isolation')),
  severity text NOT NULL DEFAULT 'standard'
    CHECK (severity IN ('low', 'standard', 'high', 'urgent')),
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'monitoring', 'closed')),
  summary text,
  next_action text,
  next_action_due date,
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  created_by_admin_user_id uuid REFERENCES public.admin_users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_welfare_cases_lodge ON public.welfare_cases(lodge_id);
CREATE INDEX IF NOT EXISTS idx_welfare_cases_member ON public.welfare_cases(member_id);
CREATE INDEX IF NOT EXISTS idx_welfare_cases_status ON public.welfare_cases(status);

ALTER TABLE public.welfare_cases ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role welfare cases" ON public.welfare_cases;
CREATE POLICY "Service role welfare cases" ON public.welfare_cases
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.welfare_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lodge_id uuid NOT NULL REFERENCES public.lodges(id) ON DELETE CASCADE,
  case_id uuid NOT NULL REFERENCES public.welfare_cases(id) ON DELETE CASCADE,
  visited_at timestamptz NOT NULL DEFAULT now(),
  contact_method text NOT NULL DEFAULT 'visit'
    CHECK (contact_method IN ('visit', 'phone', 'video', 'email', 'letter')),
  outcome text,
  notes text,
  visited_by_admin_user_id uuid REFERENCES public.admin_users(id),
  follow_up_due date,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_welfare_visits_lodge ON public.welfare_visits(lodge_id);
CREATE INDEX IF NOT EXISTS idx_welfare_visits_case ON public.welfare_visits(case_id);

ALTER TABLE public.welfare_visits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role welfare visits" ON public.welfare_visits;
CREATE POLICY "Service role welfare visits" ON public.welfare_visits
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Bereavement and widow registers share a structure: contact for someone we
-- still maintain a duty of care toward.
CREATE TABLE IF NOT EXISTS public.welfare_register_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lodge_id uuid NOT NULL REFERENCES public.lodges(id) ON DELETE CASCADE,
  member_id uuid REFERENCES public.members(id) ON DELETE SET NULL,
  register_type text NOT NULL
    CHECK (register_type IN ('bereavement', 'widow', 'family')),
  full_name text NOT NULL,
  relationship text,
  contact_email text,
  contact_phone text,
  address text,
  date_of_event date,
  last_contact_at date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_welfare_register_lodge
  ON public.welfare_register_entries(lodge_id);
CREATE INDEX IF NOT EXISTS idx_welfare_register_type
  ON public.welfare_register_entries(register_type);

ALTER TABLE public.welfare_register_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role welfare register"
  ON public.welfare_register_entries;
CREATE POLICY "Service role welfare register" ON public.welfare_register_entries
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.welfare_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lodge_id uuid NOT NULL REFERENCES public.lodges(id) ON DELETE CASCADE,
  member_id uuid REFERENCES public.members(id) ON DELETE CASCADE,
  alert_type text NOT NULL
    CHECK (alert_type IN ('missed_meetings', 'overdue_dues', 'silent', 'manual')),
  severity text NOT NULL DEFAULT 'standard'
    CHECK (severity IN ('low', 'standard', 'high', 'urgent')),
  message text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'snoozed', 'acknowledged', 'resolved')),
  acknowledged_by_admin_user_id uuid REFERENCES public.admin_users(id),
  acknowledged_at timestamptz,
  case_id uuid REFERENCES public.welfare_cases(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lodge_id, member_id, alert_type)
);

CREATE INDEX IF NOT EXISTS idx_welfare_alerts_lodge_status
  ON public.welfare_alerts(lodge_id, status);

ALTER TABLE public.welfare_alerts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role welfare alerts" ON public.welfare_alerts;
CREATE POLICY "Service role welfare alerts" ON public.welfare_alerts
  FOR ALL TO service_role USING (true) WITH CHECK (true);
