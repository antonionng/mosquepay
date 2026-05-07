-- Per-lodge feature flags. A flag may be present (truthy/falsy) or absent
-- (defaults to enabled). Operators set these from the platform console.

CREATE TABLE IF NOT EXISTS public.lodge_feature_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lodge_id uuid NOT NULL REFERENCES public.lodges(id) ON DELETE CASCADE,
  flag_key text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  notes text,
  updated_by_email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lodge_id, flag_key)
);

CREATE INDEX IF NOT EXISTS idx_lodge_feature_flags_lodge
  ON public.lodge_feature_flags (lodge_id);

ALTER TABLE public.lodge_feature_flags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all_lodge_feature_flags"
  ON public.lodge_feature_flags;

CREATE POLICY "service_role_all_lodge_feature_flags"
  ON public.lodge_feature_flags
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
