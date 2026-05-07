-- Compliance & trust: GDPR consents, data retention, subject access requests,
-- and admin two-factor authentication.

-- ---------------------------------------------------------------------------
-- 1. Member consents (track lawful basis for processing)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.member_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lodge_id uuid NOT NULL REFERENCES public.lodges(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  consent_key text NOT NULL,
  granted boolean NOT NULL DEFAULT true,
  granted_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  source text NOT NULL DEFAULT 'admin'
    CHECK (source IN ('admin', 'member', 'import', 'system')),
  ip_address inet,
  user_agent text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_member_consents_member_id
  ON public.member_consents(member_id);
CREATE INDEX IF NOT EXISTS idx_member_consents_lodge_id
  ON public.member_consents(lodge_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_member_consents_unique_active
  ON public.member_consents(member_id, consent_key)
  WHERE revoked_at IS NULL;

-- ---------------------------------------------------------------------------
-- 2. Data retention settings (per lodge)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.data_retention_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lodge_id uuid NOT NULL UNIQUE REFERENCES public.lodges(id) ON DELETE CASCADE,
  resigned_member_retention_months integer NOT NULL DEFAULT 84,
  deceased_member_retention_months integer NOT NULL DEFAULT 240,
  lead_inactive_retention_months integer NOT NULL DEFAULT 24,
  audit_log_retention_months integer NOT NULL DEFAULT 84,
  archive_strategy text NOT NULL DEFAULT 'soft_delete'
    CHECK (archive_strategy IN ('soft_delete', 'anonymise', 'hard_delete')),
  notes text,
  updated_by_admin_user_id uuid REFERENCES public.admin_users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 3. Subject access request log
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.subject_access_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lodge_id uuid NOT NULL REFERENCES public.lodges(id) ON DELETE CASCADE,
  member_id uuid REFERENCES public.members(id) ON DELETE SET NULL,
  requester_email text NOT NULL,
  requester_name text,
  status text NOT NULL DEFAULT 'received'
    CHECK (status IN ('received', 'in_progress', 'fulfilled', 'rejected')),
  fulfilled_at timestamptz,
  fulfilled_by_admin_user_id uuid REFERENCES public.admin_users(id),
  delivery_method text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 4. Admin two-factor authentication
-- ---------------------------------------------------------------------------

ALTER TABLE public.admin_users
  ADD COLUMN IF NOT EXISTS mfa_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS mfa_secret text,
  ADD COLUMN IF NOT EXISTS mfa_backup_codes jsonb,
  ADD COLUMN IF NOT EXISTS mfa_enrolled_at timestamptz;

-- ---------------------------------------------------------------------------
-- 5. Member archival flag (used by retention strategy)
-- ---------------------------------------------------------------------------

ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_reason text;

CREATE INDEX IF NOT EXISTS idx_members_archived_at
  ON public.members(lodge_id, archived_at);
