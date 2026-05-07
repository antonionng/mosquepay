-- Communications hub: templates, message log, and per-lodge automation toggles.
-- Member birthdays support the birthday automation.

ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS date_of_birth date;

CREATE TABLE IF NOT EXISTS public.message_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lodge_id uuid REFERENCES public.lodges(id) ON DELETE CASCADE,
  template_key text NOT NULL,
  name text NOT NULL,
  subject text NOT NULL,
  html_body text NOT NULL,
  channel text NOT NULL DEFAULT 'email' CHECK (channel IN ('email', 'sms')),
  merge_tags text[] NOT NULL DEFAULT '{}',
  is_system boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lodge_id, template_key)
);

CREATE INDEX IF NOT EXISTS idx_message_templates_lodge
  ON public.message_templates(lodge_id);

ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role message templates"
  ON public.message_templates;
CREATE POLICY "Service role message templates" ON public.message_templates
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lodge_id uuid NOT NULL REFERENCES public.lodges(id) ON DELETE CASCADE,
  channel text NOT NULL DEFAULT 'email' CHECK (channel IN ('email', 'sms')),
  template_key text,
  subject text,
  body_preview text,
  recipient_email text,
  recipient_name text,
  recipient_member_id uuid REFERENCES public.members(id) ON DELETE SET NULL,
  recipient_lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  audience_label text,
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'sent', 'failed', 'skipped')),
  error_message text,
  metadata jsonb DEFAULT '{}'::jsonb,
  sent_by_admin_user_id uuid REFERENCES public.admin_users(id),
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messages_lodge ON public.messages(lodge_id);
CREATE INDEX IF NOT EXISTS idx_messages_member ON public.messages(recipient_member_id);
CREATE INDEX IF NOT EXISTS idx_messages_lead ON public.messages(recipient_lead_id);
CREATE INDEX IF NOT EXISTS idx_messages_template ON public.messages(template_key);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role messages" ON public.messages;
CREATE POLICY "Service role messages" ON public.messages
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.automation_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lodge_id uuid NOT NULL REFERENCES public.lodges(id) ON DELETE CASCADE,
  automation_key text NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  last_run_at timestamptz,
  config jsonb DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lodge_id, automation_key)
);

ALTER TABLE public.automation_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role automation settings"
  ON public.automation_settings;
CREATE POLICY "Service role automation settings"
  ON public.automation_settings
  FOR ALL TO service_role USING (true) WITH CHECK (true);
