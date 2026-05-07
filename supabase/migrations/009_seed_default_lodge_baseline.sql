-- Seed a usable baseline tenant for the LodgePay dashboard.

WITH lodge_row AS (
  INSERT INTO public.lodges (
    slug,
    name,
    city,
    country,
    tagline,
    primary_color,
    secondary_color,
    support_email,
    is_active
  )
  VALUES (
    'covenant-4344',
    'Covenant Lodge No. 4344',
    'London',
    'United Kingdom',
    'Brotherhood, charity, and timeless tradition.',
    '#111827',
    '#b45309',
    'secretary@covenantlodge4344.org',
    true
  )
  ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    city = EXCLUDED.city,
    country = EXCLUDED.country,
    tagline = EXCLUDED.tagline,
    primary_color = EXCLUDED.primary_color,
    secondary_color = EXCLUDED.secondary_color,
    support_email = EXCLUDED.support_email,
    is_active = true,
    updated_at = now()
  RETURNING id
)
INSERT INTO public.lodge_site_pages (
  lodge_id,
  page_key,
  page_title,
  page_description,
  sections,
  published
)
SELECT
  id,
  'home',
  'Covenant Lodge No. 4344',
  'A London lodge rooted in fellowship, service, and meaningful ritual.',
  '[
    {
      "id": "seed-hero",
      "type": "hero",
      "heading": "Welcome to Covenant Lodge No. 4344",
      "body": "Join a modern brotherhood with deep heritage in the heart of London.",
      "cta_label": "Express Interest",
      "cta_href": "/join",
      "visible": true,
      "order": 1,
      "style": {
        "primary_color": "#111827",
        "overlay_opacity": 0.45,
        "background_position": "center"
      }
    },
    {
      "id": "seed-meetings",
      "type": "meeting_details",
      "heading": "Meetings at Mark Masons Hall",
      "body": "Regular meetings, social dining, and charity events throughout the year.",
      "cta_label": "View Events",
      "cta_href": "/events",
      "visible": true,
      "order": 2
    },
    {
      "id": "seed-charity",
      "type": "charity",
      "heading": "Charity and Community",
      "body": "We support local and national causes through regular giving and fundraising.",
      "cta_label": "Our Charity Work",
      "cta_href": "/charity",
      "visible": true,
      "order": 3
    },
    {
      "id": "seed-contact",
      "type": "contact",
      "heading": "Speak With Our Team",
      "body": "If you are interested in joining or visiting, we are happy to hear from you.",
      "cta_label": "Contact Us",
      "cta_href": "/contact",
      "visible": true,
      "order": 4
    }
  ]'::jsonb,
  true
FROM lodge_row
ON CONFLICT (lodge_id, page_key) DO UPDATE SET
  page_title = EXCLUDED.page_title,
  page_description = EXCLUDED.page_description,
  sections = EXCLUDED.sections,
  published = true,
  updated_at = now();

INSERT INTO public.admin_users (
  lodge_id,
  email,
  full_name,
  role,
  active
)
SELECT
  id,
  'admin@covenantlodge.org.uk',
  'Covenant Lodge Admin',
  'admin',
  true
FROM public.lodges
WHERE slug = 'covenant-4344'
ON CONFLICT (email) DO UPDATE SET
  lodge_id = EXCLUDED.lodge_id,
  full_name = EXCLUDED.full_name,
  role = EXCLUDED.role,
  active = true,
  updated_at = now();

INSERT INTO public.lodge_subscriptions (
  lodge_id,
  plan_code,
  billing_cycle,
  seats,
  amount,
  currency,
  status,
  trial_ends_at
)
SELECT
  id,
  'starter',
  'monthly',
  25,
  99,
  'GBP',
  'trialing',
  now() + interval '14 days'
FROM public.lodges
WHERE slug = 'covenant-4344'
ON CONFLICT (lodge_id) DO UPDATE SET
  plan_code = EXCLUDED.plan_code,
  billing_cycle = EXCLUDED.billing_cycle,
  seats = EXCLUDED.seats,
  amount = EXCLUDED.amount,
  currency = EXCLUDED.currency,
  status = EXCLUDED.status,
  trial_ends_at = EXCLUDED.trial_ends_at,
  updated_at = now();

INSERT INTO public.lodge_dues (
  lodge_id,
  name,
  amount,
  currency,
  billing_period,
  active,
  allow_instalments,
  instalment_count,
  instalment_frequency
)
SELECT
  id,
  'Annual Subscription',
  150,
  'gbp',
  'annual',
  true,
  true,
  12,
  'monthly'
FROM public.lodges
WHERE slug = 'covenant-4344'
AND NOT EXISTS (
  SELECT 1
  FROM public.lodge_dues
  WHERE lodge_dues.lodge_id = lodges.id
  AND lodge_dues.name = 'Annual Subscription'
);

INSERT INTO public.charity_campaigns (
  lodge_id,
  name,
  description,
  target_amount,
  raised_amount,
  status,
  start_date,
  end_date
)
SELECT
  id,
  'MCF Festival 2026',
  'Lodge festival contribution to the Masonic Charitable Foundation.',
  5000,
  3250,
  'active',
  now() - interval '90 days',
  now() + interval '270 days'
FROM public.lodges
WHERE slug = 'covenant-4344'
AND NOT EXISTS (
  SELECT 1
  FROM public.charity_campaigns
  WHERE charity_campaigns.lodge_id = lodges.id
  AND charity_campaigns.name = 'MCF Festival 2026'
);

INSERT INTO public.events (
  lodge_id,
  title,
  slug,
  description,
  event_type,
  event_date,
  event_time,
  location,
  temple_room,
  dress_code,
  enable_rsvp,
  enable_payments,
  enable_dining_rsvp,
  dining_price,
  dining_description,
  enable_charity_donation,
  charity_name,
  charity_description,
  enable_meeting_fee,
  meeting_fee_amount,
  meeting_fee_description,
  published
)
SELECT
  id,
  'Regular Lodge Meeting',
  'regular-lodge-meeting',
  'Regular meeting followed by festive board.',
  'lodge_meeting',
  now() + interval '30 days',
  '18:00',
  'Mark Masons Hall',
  'Temple 1',
  'Dark suit, provincial or lodge tie',
  true,
  true,
  true,
  35,
  'Festive board dining',
  true,
  'MCF Festival 2026',
  'Optional charity donation supporting the lodge festival target.',
  true,
  10,
  'Temple and meeting contribution',
  true
FROM public.lodges
WHERE slug = 'covenant-4344'
AND NOT EXISTS (
  SELECT 1
  FROM public.events
  WHERE events.lodge_id = lodges.id
  AND events.slug = 'regular-lodge-meeting'
);

INSERT INTO public.members (
  lodge_id,
  email,
  full_name,
  phone,
  rank,
  membership_status
)
SELECT
  id,
  'member@example.com',
  'Example Member',
  null,
  'Brother',
  'active'
FROM public.lodges
WHERE slug = 'covenant-4344'
ON CONFLICT (lodge_id, email) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  rank = EXCLUDED.rank,
  membership_status = 'active',
  updated_at = now();
