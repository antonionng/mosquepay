ALTER TABLE public.lodge_site_pages
  ADD COLUMN IF NOT EXISTS custom_pages JSONB NOT NULL DEFAULT '[]'::jsonb;
