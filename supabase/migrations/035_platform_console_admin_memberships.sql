-- Platform console admin memberships.
-- Allow one email address to hold separate platform and tenant memberships.

ALTER TABLE public.admin_users
  DROP CONSTRAINT IF EXISTS admin_users_email_key;

CREATE UNIQUE INDEX IF NOT EXISTS admin_users_platform_email_unique
  ON public.admin_users (lower(email))
  WHERE lodge_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS admin_users_lodge_email_unique
  ON public.admin_users (lodge_id, lower(email))
  WHERE lodge_id IS NOT NULL;

INSERT INTO public.admin_users (
  lodge_id,
  email,
  full_name,
  role,
  active,
  permissions
)
VALUES (
  NULL,
  'ag@experrt.com',
  'Platform Owner',
  'super_admin',
  true,
  '[]'::jsonb
)
ON CONFLICT DO NOTHING;
