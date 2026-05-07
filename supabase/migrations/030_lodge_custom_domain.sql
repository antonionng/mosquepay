ALTER TABLE public.lodges
  ADD COLUMN IF NOT EXISTS custom_domain text,
  ADD COLUMN IF NOT EXISTS custom_domain_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS custom_domain_verification_token text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_lodges_custom_domain
  ON public.lodges (lower(custom_domain))
  WHERE custom_domain IS NOT NULL;
