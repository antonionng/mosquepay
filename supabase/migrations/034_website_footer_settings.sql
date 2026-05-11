ALTER TABLE public.lodge_site_pages
  ADD COLUMN IF NOT EXISTS footer_settings JSONB;
