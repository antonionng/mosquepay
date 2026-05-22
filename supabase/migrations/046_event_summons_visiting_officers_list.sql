-- Stores multiple Visiting Officers for a summons while keeping the legacy
-- single-VO columns populated for older reads and reports.

ALTER TABLE public.event_summons
  ADD COLUMN IF NOT EXISTS visiting_officers jsonb NOT NULL DEFAULT '[]'::jsonb;

UPDATE public.event_summons
SET visiting_officers = jsonb_build_array(
  jsonb_strip_nulls(
    jsonb_build_object(
      'name', visiting_officer_name,
      'email', visiting_officer_email,
      'phone', visiting_officer_phone
    )
  )
)
WHERE visiting_officers = '[]'::jsonb
  AND visiting_officer_name IS NOT NULL;

COMMENT ON COLUMN public.event_summons.visiting_officers IS
  'List of Visiting Officers printed on the summons. Each item may include name, email, and phone.';
