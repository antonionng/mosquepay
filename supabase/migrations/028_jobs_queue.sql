-- Background job queue for emails, dues runs, exports, reconciliation, etc.
-- Drains via /api/jobs/process which can be called by Vercel Cron or any
-- external scheduler. At-least-once delivery semantics with retry.

CREATE TABLE IF NOT EXISTS public.jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lodge_id uuid REFERENCES public.lodges(id) ON DELETE CASCADE,
  job_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'in_progress', 'succeeded', 'failed', 'cancelled')),
  scheduled_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  finished_at timestamptz,
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 3,
  last_error text,
  created_by_admin_user_id uuid REFERENCES public.admin_users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_jobs_status_scheduled
  ON public.jobs(status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_jobs_lodge_id
  ON public.jobs(lodge_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_type_status
  ON public.jobs(job_type, status);

-- Integration tokens (per lodge, per provider). Stored encrypted in
-- application code is preferable; for now we store opaque text.
CREATE TABLE IF NOT EXISTS public.integration_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lodge_id uuid NOT NULL REFERENCES public.lodges(id) ON DELETE CASCADE,
  provider text NOT NULL
    CHECK (provider IN ('google_calendar', 'outlook', 'mailchimp', 'brevo', 'xero', 'quickbooks')),
  access_token text,
  refresh_token text,
  expires_at timestamptz,
  metadata jsonb DEFAULT '{}'::jsonb,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lodge_id, provider)
);
