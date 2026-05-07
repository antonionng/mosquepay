ALTER TABLE public.lodges
  ADD COLUMN IF NOT EXISTS lodge_number text,
  ADD COLUMN IF NOT EXISTS consecrated_at date,
  ADD COLUMN IF NOT EXISTS governing_body text,
  ADD COLUMN IF NOT EXISTS meeting_schedule text,
  ADD COLUMN IF NOT EXISTS secretary_name text,
  ADD COLUMN IF NOT EXISTS secretary_address text,
  ADD COLUMN IF NOT EXISTS secretary_phone text,
  ADD COLUMN IF NOT EXISTS charity_donation_url text,
  ADD COLUMN IF NOT EXISTS relief_chest_name text,
  ADD COLUMN IF NOT EXISTS data_protection_notice text,
  ADD COLUMN IF NOT EXISTS visiting_notice text,
  ADD COLUMN IF NOT EXISTS loi_contact text,
  ADD COLUMN IF NOT EXISTS wifi_details text;

ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS address_line_1 text,
  ADD COLUMN IF NOT EXISTS address_line_2 text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS county text,
  ADD COLUMN IF NOT EXISTS postcode text,
  ADD COLUMN IF NOT EXISTS country text DEFAULT 'United Kingdom',
  ADD COLUMN IF NOT EXISTS country_list boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS royal_arch boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS honorary boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS office_title text,
  ADD COLUMN IF NOT EXISTS officer_sort_order integer,
  ADD COLUMN IF NOT EXISTS directory_sort_order integer;

CREATE TABLE IF NOT EXISTS public.event_summons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lodge_id uuid NOT NULL REFERENCES public.lodges(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  issue_date date NOT NULL DEFAULT CURRENT_DATE,
  opening_text text,
  agenda_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  menu_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  dining_time text,
  notices jsonb NOT NULL DEFAULT '[]'::jsonb,
  include_member_directory boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lodge_id, event_id)
);

ALTER TABLE public.event_summons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role all event_summons"
  ON public.event_summons
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

UPDATE public.lodges
SET
  lodge_number = COALESCE(lodge_number, '4344'),
  consecrated_at = COALESCE(consecrated_at, DATE '1922-04-03'),
  governing_body = COALESCE(governing_body, 'Member of London Metropolitan Grand Lodge'),
  meeting_schedule = COALESCE(
    meeting_schedule,
    'Regular meetings are held in January, March, June, and November.'
  ),
  secretary_name = COALESCE(secretary_name, 'Lodge Secretary'),
  secretary_address = COALESCE(
    secretary_address,
    'Mark Masons Hall, 86 St James''s Street, London, SW1A 1PL'
  ),
  secretary_phone = COALESCE(secretary_phone, '01582 461961'),
  charity_donation_url = COALESCE(charity_donation_url, 'https://gtap.uk/L4344'),
  relief_chest_name = COALESCE(relief_chest_name, 'Covenant Relief Chest'),
  data_protection_notice = COALESCE(
    data_protection_notice,
    'A member database is held by the Lodge Secretary for lodge business. Members who object to their details being held should contact the Secretary.'
  ),
  visiting_notice = COALESCE(
    visiting_notice,
    'Brethren travelling abroad should confirm regularity before visiting lodges under other jurisdictions.'
  ),
  loi_contact = COALESCE(loi_contact, 'Contact the Secretary for Lodge of Instruction dates.'),
  wifi_details = COALESCE(wifi_details, 'MMH Guest WiFi details are available at the venue.')
WHERE slug = 'covenant-4344';

UPDATE public.members
SET
  address_line_1 = COALESCE(address_line_1, '1 Example Road'),
  city = COALESCE(city, 'London'),
  postcode = COALESCE(postcode, 'SW1A 1AA'),
  country = COALESCE(country, 'United Kingdom'),
  rank = COALESCE(rank, 'Bro'),
  directory_sort_order = COALESCE(directory_sort_order, 1),
  office_title = COALESCE(office_title, 'Secretary'),
  officer_sort_order = COALESCE(officer_sort_order, 5)
WHERE email = 'member@example.com';

INSERT INTO public.event_summons (
  lodge_id,
  event_id,
  issue_date,
  agenda_items,
  menu_items,
  dining_time,
  notices,
  include_member_directory
)
SELECT
  events.lodge_id,
  events.id,
  CURRENT_DATE,
  '[
    "To open the Lodge.",
    "To submit for confirmation the circulated Minutes of the last regular meeting.",
    "To receive correspondence and apologies.",
    "To conduct the business of the Lodge.",
    "To receive the Almoner''s report.",
    "To receive the Charity Steward''s report and collect alms.",
    "Risings.",
    "To close the Lodge."
  ]'::jsonb,
  '[
    "Starter to be confirmed",
    "Main course to be confirmed",
    "Dessert to be confirmed",
    "Coffee and tea"
  ]'::jsonb,
  '7.30 pm',
  '[
    "All cheques for subscriptions should be made payable to the lodge and sent direct to the Treasurer.",
    "Brethren wishing to donate to lodge charities should contact the Charity Steward.",
    "UGLE Members Portal may be accessed via desktop and mobile versions."
  ]'::jsonb,
  true
FROM public.events
JOIN public.lodges ON lodges.id = events.lodge_id
WHERE lodges.slug = 'covenant-4344'
AND events.slug = 'regular-lodge-meeting'
ON CONFLICT (lodge_id, event_id) DO UPDATE SET
  agenda_items = EXCLUDED.agenda_items,
  menu_items = EXCLUDED.menu_items,
  dining_time = EXCLUDED.dining_time,
  notices = EXCLUDED.notices,
  include_member_directory = true,
  updated_at = now();
