-- Platform owner + multi-tenant demo seed.
-- Adds a global super_admin row, 9 additional active lodge tenants, and
-- bulk demo data per tenant. All inserts are idempotent so the migration
-- is safe to rerun.

-- ---------------------------------------------------------------------------
-- 1. Platform owner global super_admin (lodge_id = null acts as cross-lodge)
-- ---------------------------------------------------------------------------

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
ON CONFLICT (email) DO UPDATE SET
  lodge_id = NULL,
  full_name = 'Platform Owner',
  role = 'super_admin',
  active = true,
  updated_at = now();

-- ---------------------------------------------------------------------------
-- 2. Nine additional lodge tenants (covenant-4344 already exists)
-- ---------------------------------------------------------------------------

INSERT INTO public.lodges (
  slug, name, lodge_number, city, country, tagline,
  primary_color, secondary_color, support_email, support_phone, is_active
)
VALUES
  ('westminster-2718', 'Westminster Lodge No. 2718', '2718', 'London', 'United Kingdom',
   'A historic lodge in the heart of Westminster.',
   '#1f2937', '#0ea5e9', 'secretary@westminster2718.example', '020 7946 0001', true),
  ('albion-charity-1235', 'Albion Charity Lodge No. 1235', '1235', 'Manchester', 'United Kingdom',
   'Service, charity, and brotherhood since 1867.',
   '#0f172a', '#16a34a', 'secretary@albioncharity1235.example', '0161 555 0202', true),
  ('cambrian-1875', 'Cambrian Lodge No. 1875', '1875', 'Cardiff', 'United Kingdom',
   'A Welsh lodge with a strong charitable tradition.',
   '#7f1d1d', '#facc15', 'secretary@cambrian1875.example', '029 2018 0303', true),
  ('aurora-borealis-3210', 'Aurora Borealis Lodge No. 3210', '3210', 'Edinburgh', 'United Kingdom',
   'Light, learning, and Scottish hospitality.',
   '#1e3a8a', '#22d3ee', 'secretary@aurora3210.example', '0131 555 0404', true),
  ('saint-georges-4521', 'Saint George''s Lodge No. 4521', '4521', 'Bristol', 'United Kingdom',
   'A friendly lodge in the West Country.',
   '#7c2d12', '#fb923c', 'secretary@stgeorges4521.example', '0117 555 0505', true),
  ('mariners-anchor-2098', 'Mariners'' Anchor Lodge No. 2098', '2098', 'Portsmouth', 'United Kingdom',
   'A lodge with naval heritage and seafaring spirit.',
   '#082f49', '#38bdf8', 'secretary@marinersanchor2098.example', '023 9255 0606', true),
  ('holyrood-1842', 'Holyrood Lodge No. 1842', '1842', 'Glasgow', 'United Kingdom',
   'A Glasgow lodge built on fellowship and service.',
   '#312e81', '#a78bfa', 'secretary@holyrood1842.example', '0141 555 0707', true),
  ('emerald-isle-3987', 'Emerald Isle Lodge No. 3987', '3987', 'Belfast', 'United Kingdom',
   'A welcoming Belfast lodge with Irish heritage.',
   '#064e3b', '#34d399', 'secretary@emeraldisle3987.example', '028 9055 0808', true),
  ('mercia-2456', 'Mercia Lodge No. 2456', '2456', 'Birmingham', 'United Kingdom',
   'A Midlands lodge focused on mentoring and ritual.',
   '#581c87', '#f472b6', 'secretary@mercia2456.example', '0121 555 0909', true)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  lodge_number = EXCLUDED.lodge_number,
  city = EXCLUDED.city,
  country = EXCLUDED.country,
  tagline = EXCLUDED.tagline,
  primary_color = EXCLUDED.primary_color,
  secondary_color = EXCLUDED.secondary_color,
  support_email = EXCLUDED.support_email,
  support_phone = EXCLUDED.support_phone,
  is_active = true,
  updated_at = now();

-- Convenience view of the demo set (only used during this migration).
CREATE TEMP TABLE demo_lodge_slugs (slug text PRIMARY KEY);
INSERT INTO demo_lodge_slugs(slug) VALUES
  ('covenant-4344'),
  ('westminster-2718'),
  ('albion-charity-1235'),
  ('cambrian-1875'),
  ('aurora-borealis-3210'),
  ('saint-georges-4521'),
  ('mariners-anchor-2098'),
  ('holyrood-1842'),
  ('emerald-isle-3987'),
  ('mercia-2456');

-- ---------------------------------------------------------------------------
-- 3. Per-lodge baseline rows: site page, subscription, dues, charity, admin
-- ---------------------------------------------------------------------------

INSERT INTO public.lodge_site_pages (
  lodge_id, page_key, page_title, page_description, sections, published
)
SELECT
  l.id,
  'home',
  l.name,
  'Welcome to ' || l.name || '. ' || COALESCE(l.tagline, ''),
  jsonb_build_array(
    jsonb_build_object(
      'id', 'demo-hero', 'type', 'hero',
      'heading', 'Welcome to ' || l.name,
      'body', COALESCE(l.tagline, 'Brotherhood, charity, and timeless tradition.'),
      'cta_label', 'Join us', 'cta_href', '/join',
      'visible', true, 'order', 1,
      'style', jsonb_build_object('primary_color', l.primary_color)
    ),
    jsonb_build_object(
      'id', 'demo-meetings', 'type', 'meeting_details',
      'heading', 'Meetings and gatherings',
      'body', 'Regular meetings, festive boards, and charity events throughout the year.',
      'cta_label', 'View events', 'cta_href', '/events',
      'visible', true, 'order', 2
    ),
    jsonb_build_object(
      'id', 'demo-charity', 'type', 'charity',
      'heading', 'Our charity work',
      'body', 'Supporting local and national causes through giving and volunteering.',
      'cta_label', 'Charity', 'cta_href', '/charity',
      'visible', true, 'order', 3
    ),
    jsonb_build_object(
      'id', 'demo-contact', 'type', 'contact',
      'heading', 'Get in touch',
      'body', 'Reach out to the secretary about visiting or membership.',
      'cta_label', 'Contact', 'cta_href', '/contact',
      'visible', true, 'order', 4
    )
  ),
  true
FROM public.lodges l
JOIN demo_lodge_slugs d ON d.slug = l.slug
ON CONFLICT (lodge_id, page_key) DO UPDATE SET
  page_title = EXCLUDED.page_title,
  page_description = EXCLUDED.page_description,
  sections = EXCLUDED.sections,
  published = true,
  updated_at = now();

INSERT INTO public.lodge_subscriptions (
  lodge_id, plan_code, billing_cycle, seats, amount, currency, status, trial_ends_at, current_period_end
)
SELECT
  l.id,
  CASE (abs(hashtext(l.slug)) % 3)
    WHEN 0 THEN 'starter'
    WHEN 1 THEN 'growth'
    ELSE 'pro'
  END,
  'monthly',
  25 + (abs(hashtext(l.slug)) % 50),
  CASE (abs(hashtext(l.slug)) % 3)
    WHEN 0 THEN 99
    WHEN 1 THEN 199
    ELSE 349
  END,
  'GBP',
  CASE WHEN l.slug = 'covenant-4344' THEN 'trialing' ELSE 'active' END,
  now() + interval '14 days',
  now() + interval '30 days'
FROM public.lodges l
JOIN demo_lodge_slugs d ON d.slug = l.slug
ON CONFLICT (lodge_id) DO UPDATE SET
  plan_code = EXCLUDED.plan_code,
  billing_cycle = EXCLUDED.billing_cycle,
  seats = EXCLUDED.seats,
  amount = EXCLUDED.amount,
  currency = EXCLUDED.currency,
  status = EXCLUDED.status,
  current_period_end = EXCLUDED.current_period_end,
  updated_at = now();

-- Lodge admin (secretary) per tenant. Skip covenant-4344 because seed 009
-- already provisions admin@covenantlodge.org.uk for it.
INSERT INTO public.admin_users (
  lodge_id, email, full_name, role, active, permissions
)
SELECT
  l.id,
  'secretary+' || l.slug || '@example.com',
  'Secretary of ' || l.name,
  'secretary',
  true,
  '[]'::jsonb
FROM public.lodges l
JOIN demo_lodge_slugs d ON d.slug = l.slug
WHERE l.slug <> 'covenant-4344'
ON CONFLICT (email) DO UPDATE SET
  lodge_id = EXCLUDED.lodge_id,
  full_name = EXCLUDED.full_name,
  role = EXCLUDED.role,
  active = true,
  updated_at = now();

-- Two dues products per lodge.
INSERT INTO public.lodge_dues (
  lodge_id, name, amount, currency, billing_period, active,
  allow_instalments, instalment_count, instalment_frequency
)
SELECT
  l.id, d.name, d.amount, 'gbp', d.billing_period, true,
  d.allow_instalments, d.instalment_count, d.instalment_frequency
FROM public.lodges l
JOIN demo_lodge_slugs ds ON ds.slug = l.slug
CROSS JOIN (
  VALUES
    ('Annual Subscription', 180.00::numeric, 'annual', true, 12, 'monthly'),
    ('Festival Contribution', 240.00::numeric, 'annual', true, 4, 'quarterly')
) AS d(name, amount, billing_period, allow_instalments, instalment_count, instalment_frequency)
WHERE NOT EXISTS (
  SELECT 1 FROM public.lodge_dues ld
  WHERE ld.lodge_id = l.id AND ld.name = d.name
);

-- Two charity campaigns per lodge.
INSERT INTO public.charity_campaigns (
  lodge_id, name, description, target_amount, raised_amount, status, start_date, end_date
)
SELECT
  l.id, c.name, c.description, c.target_amount, c.raised_amount, c.status,
  now() - interval '90 days', now() + interval '270 days'
FROM public.lodges l
JOIN demo_lodge_slugs ds ON ds.slug = l.slug
CROSS JOIN (
  VALUES
    ('MCF Festival 2026', 'Lodge contribution to the Masonic Charitable Foundation festival.', 6000.00::numeric, 2400.00::numeric, 'active'),
    ('Local Hospice Appeal', 'Support our local hospice and bereavement services.', 4000.00::numeric, 1750.00::numeric, 'active')
) AS c(name, description, target_amount, raised_amount, status)
WHERE NOT EXISTS (
  SELECT 1 FROM public.charity_campaigns cc
  WHERE cc.lodge_id = l.id AND cc.name = c.name
);

-- ---------------------------------------------------------------------------
-- 4. Bulk members (~100 per lodge)
-- ---------------------------------------------------------------------------

INSERT INTO public.members (
  lodge_id, email, full_name, phone, rank, dietary_requirements,
  date_of_initiation, membership_status,
  address_line_1, city, postcode, country,
  royal_arch, honorary, office_title, officer_sort_order, directory_sort_order
)
SELECT
  l.id,
  'm' || g || '@' || l.slug || '.demo',
  CASE (g % 12)
    WHEN 0 THEN 'James'
    WHEN 1 THEN 'William'
    WHEN 2 THEN 'Edward'
    WHEN 3 THEN 'Charles'
    WHEN 4 THEN 'Thomas'
    WHEN 5 THEN 'George'
    WHEN 6 THEN 'Henry'
    WHEN 7 THEN 'Arthur'
    WHEN 8 THEN 'Frederick'
    WHEN 9 THEN 'Albert'
    WHEN 10 THEN 'Robert'
    ELSE 'Samuel'
  END
  || ' '
  || CASE (g % 14)
    WHEN 0 THEN 'Anderson'
    WHEN 1 THEN 'Bennett'
    WHEN 2 THEN 'Carter'
    WHEN 3 THEN 'Davies'
    WHEN 4 THEN 'Ellis'
    WHEN 5 THEN 'Foster'
    WHEN 6 THEN 'Griffiths'
    WHEN 7 THEN 'Hughes'
    WHEN 8 THEN 'Irvine'
    WHEN 9 THEN 'Johnson'
    WHEN 10 THEN 'Knight'
    WHEN 11 THEN 'Lewis'
    WHEN 12 THEN 'Morgan'
    ELSE 'Powell'
  END,
  '07' || lpad(((abs(hashtext(l.slug || g::text))) % 1000000000)::text, 9, '0'),
  CASE (g % 5)
    WHEN 0 THEN 'EA'
    WHEN 1 THEN 'FC'
    WHEN 2 THEN 'MM'
    WHEN 3 THEN 'MM'
    ELSE 'PM'
  END,
  CASE (g % 7) WHEN 0 THEN 'Vegetarian' WHEN 1 THEN 'No nuts' ELSE NULL END,
  (DATE '2010-01-01' + ((abs(hashtext(l.slug || g::text)) % 5475) || ' days')::interval)::date,
  CASE (g % 20)
    WHEN 18 THEN 'suspended'
    WHEN 19 THEN 'resigned'
    ELSE 'active'
  END,
  (g || ' ' ||
    CASE (g % 8)
      WHEN 0 THEN 'High Street'
      WHEN 1 THEN 'Church Lane'
      WHEN 2 THEN 'Park Road'
      WHEN 3 THEN 'Mill Way'
      WHEN 4 THEN 'Castle Street'
      WHEN 5 THEN 'Queens Avenue'
      WHEN 6 THEN 'Bridge Crescent'
      ELSE 'Abbey Close'
    END
  ),
  COALESCE(l.city, 'London'),
  CASE (g % 6)
    WHEN 0 THEN 'SW1A 1AA'
    WHEN 1 THEN 'EC2N 4AE'
    WHEN 2 THEN 'M1 1AA'
    WHEN 3 THEN 'CF10 1AA'
    WHEN 4 THEN 'EH1 1AA'
    ELSE 'B1 1AA'
  END,
  COALESCE(l.country, 'United Kingdom'),
  (g % 9 = 0),
  (g % 25 = 0),
  CASE g
    WHEN 1 THEN 'Worshipful Master'
    WHEN 2 THEN 'Senior Warden'
    WHEN 3 THEN 'Junior Warden'
    WHEN 4 THEN 'Treasurer'
    WHEN 5 THEN 'Secretary'
    WHEN 6 THEN 'Director of Ceremonies'
    WHEN 7 THEN 'Almoner'
    WHEN 8 THEN 'Charity Steward'
    WHEN 9 THEN 'Senior Deacon'
    WHEN 10 THEN 'Junior Deacon'
    ELSE NULL
  END,
  CASE WHEN g <= 10 THEN g ELSE NULL END,
  g
FROM public.lodges l
JOIN demo_lodge_slugs ds ON ds.slug = l.slug
CROSS JOIN generate_series(1, 100) AS t(g)
ON CONFLICT (lodge_id, email) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 5. Bulk events (~20 per lodge), mix of past and future
-- ---------------------------------------------------------------------------

INSERT INTO public.events (
  lodge_id, title, slug, description, event_type, event_date, event_time,
  location, temple_room, dress_code,
  enable_rsvp, rsvp_deadline, max_attendees,
  enable_payments, enable_dining_rsvp, dining_price, dining_description,
  enable_charity_donation, charity_name, charity_description,
  enable_meeting_fee, meeting_fee_amount, meeting_fee_description,
  enable_guest_tickets, guest_ticket_price, guest_ticket_description,
  published
)
SELECT
  l.id,
  CASE (g % 4)
    WHEN 0 THEN 'Regular Lodge Meeting #' || g
    WHEN 1 THEN 'Festive Board #' || g
    WHEN 2 THEN 'Lodge of Instruction #' || g
    ELSE 'Charity Evening #' || g
  END,
  l.slug || '-event-' || g,
  'Demo seeded event for ' || l.name || ' (#' || g || ').',
  CASE (g % 5)
    WHEN 0 THEN 'lodge_meeting'
    WHEN 1 THEN 'installation'
    WHEN 2 THEN 'lodge_of_instruction'
    WHEN 3 THEN 'committee'
    ELSE 'lodge_meeting'
  END,
  now() + ((g - 8) * 21) * interval '1 day',
  '18:30',
  COALESCE('Mark Masons'' Hall, ' || l.city, 'Mark Masons'' Hall'),
  CASE (g % 3) WHEN 0 THEN 'Temple 1' WHEN 1 THEN 'Temple 2' ELSE 'Grand Temple' END,
  CASE (g % 4) WHEN 0 THEN 'Morning dress' WHEN 1 THEN 'Dark suit' WHEN 2 THEN 'Black tie' ELSE 'Lodge regalia' END,
  true,
  now() + ((g - 8) * 21 - 7) * interval '1 day',
  60 + (g * 3) % 80,
  true,
  true,
  35 + ((g % 5) * 5),
  'Festive board dining',
  (g % 3 = 0),
  CASE (g % 3) WHEN 0 THEN 'MCF Festival 2026' ELSE NULL END,
  CASE (g % 3) WHEN 0 THEN 'Optional charity donation supporting the festival.' ELSE NULL END,
  true,
  10,
  'Temple and meeting contribution',
  (g % 4 = 1),
  CASE (g % 4) WHEN 1 THEN 65 ELSE NULL END,
  CASE (g % 4) WHEN 1 THEN 'Guest banquet ticket' ELSE NULL END,
  true
FROM public.lodges l
JOIN demo_lodge_slugs ds ON ds.slug = l.slug
CROSS JOIN generate_series(1, 20) AS t(g)
ON CONFLICT (lodge_id, slug) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 6. Bulk leads (~40 per lodge), spread across pipeline stages
-- ---------------------------------------------------------------------------

INSERT INTO public.leads (
  lodge_id, first_name, last_name, email, phone, location, source,
  how_heard_about_us, initial_message, stage,
  next_step, next_step_due_date, proposal_date, ballot_date, notes
)
SELECT
  l.id,
  CASE (g % 10)
    WHEN 0 THEN 'Oliver'
    WHEN 1 THEN 'Daniel'
    WHEN 2 THEN 'Joseph'
    WHEN 3 THEN 'Andrew'
    WHEN 4 THEN 'Michael'
    WHEN 5 THEN 'Christopher'
    WHEN 6 THEN 'Patrick'
    WHEN 7 THEN 'Stephen'
    WHEN 8 THEN 'Mark'
    ELSE 'Peter'
  END,
  CASE (g % 11)
    WHEN 0 THEN 'Reynolds'
    WHEN 1 THEN 'Sullivan'
    WHEN 2 THEN 'Walsh'
    WHEN 3 THEN 'Quinn'
    WHEN 4 THEN 'Murray'
    WHEN 5 THEN 'Higgins'
    WHEN 6 THEN 'Doyle'
    WHEN 7 THEN 'Spencer'
    WHEN 8 THEN 'Brennan'
    WHEN 9 THEN 'Fitzgerald'
    ELSE 'Whitaker'
  END,
  'lead' || g || '@' || l.slug || '.demo',
  '07' || lpad(((abs(hashtext(l.slug || g::text || 'lead'))) % 1000000000)::text, 9, '0'),
  COALESCE(l.city, 'London'),
  CASE (g % 5)
    WHEN 0 THEN 'website'
    WHEN 1 THEN 'event'
    WHEN 2 THEN 'referral'
    WHEN 3 THEN 'social_media'
    ELSE 'open_day'
  END,
  CASE (g % 4)
    WHEN 0 THEN 'Friend who is a member'
    WHEN 1 THEN 'Online search'
    WHEN 2 THEN 'Open evening'
    ELSE 'Family connection'
  END,
  'I am interested in learning more about freemasonry and joining ' || l.name || '.',
  CASE (g % 8)
    WHEN 0 THEN 'expression_of_interest'
    WHEN 1 THEN 'initial_contact'
    WHEN 2 THEN 'meeting_scheduled'
    WHEN 3 THEN 'proposal_lodge'
    WHEN 4 THEN 'approved'
    WHEN 5 THEN 'initiated'
    WHEN 6 THEN 'on_hold'
    ELSE 'declined'
  END,
  CASE (g % 8)
    WHEN 0 THEN 'Send welcome email'
    WHEN 1 THEN 'Schedule introductory call'
    WHEN 2 THEN 'Confirm meeting attendance'
    WHEN 3 THEN 'Prepare proposal paperwork'
    WHEN 4 THEN 'Confirm initiation date'
    ELSE 'Follow up'
  END,
  (CURRENT_DATE + ((g % 30) || ' days')::interval)::date,
  CASE WHEN (g % 8) IN (3, 4) THEN (CURRENT_DATE + interval '20 days')::date ELSE NULL END,
  CASE WHEN (g % 8) IN (4) THEN (CURRENT_DATE + interval '60 days')::date ELSE NULL END,
  'Seeded lead for demo data.'
FROM public.lodges l
JOIN demo_lodge_slugs ds ON ds.slug = l.slug
CROSS JOIN generate_series(1, 40) AS t(g)
WHERE NOT EXISTS (
  SELECT 1 FROM public.leads ld
  WHERE ld.lodge_id = l.id
  AND ld.email = 'lead' || g || '@' || l.slug || '.demo'
);

-- A couple of lead activities per seeded lead.
INSERT INTO public.lead_activities (
  lead_id, lodge_id, activity_type, title, description, completed, created_at
)
SELECT
  ld.id, ld.lodge_id,
  CASE (n % 5)
    WHEN 0 THEN 'note'
    WHEN 1 THEN 'phone_call'
    WHEN 2 THEN 'email'
    WHEN 3 THEN 'meeting'
    ELSE 'task'
  END,
  CASE (n % 5)
    WHEN 0 THEN 'Initial note'
    WHEN 1 THEN 'Phone call'
    WHEN 2 THEN 'Email follow up'
    WHEN 3 THEN 'Introductory meeting'
    ELSE 'Action item'
  END,
  'Demo activity ' || n || ' for ' || ld.first_name || ' ' || ld.last_name || '.',
  (n % 2 = 0),
  now() - (n * 5) * interval '1 day'
FROM public.leads ld
JOIN public.lodges l ON l.id = ld.lodge_id
JOIN demo_lodge_slugs ds ON ds.slug = l.slug
CROSS JOIN generate_series(1, 2) AS t(n)
WHERE ld.email LIKE 'lead%@' || l.slug || '.demo'
AND NOT EXISTS (
  SELECT 1 FROM public.lead_activities la
  WHERE la.lead_id = ld.id
  AND la.title = CASE (n % 5)
    WHEN 0 THEN 'Initial note'
    WHEN 1 THEN 'Phone call'
    WHEN 2 THEN 'Email follow up'
    WHEN 3 THEN 'Introductory meeting'
    ELSE 'Action item'
  END
);

-- ---------------------------------------------------------------------------
-- 7. RSVPs and payments for the first 5 future events of each lodge
-- ---------------------------------------------------------------------------

CREATE TEMP TABLE demo_event_targets AS
SELECT
  e.id AS event_id, e.lodge_id, e.title, e.slug, l.slug AS lodge_slug,
  row_number() OVER (PARTITION BY e.lodge_id ORDER BY e.event_date ASC) AS rn
FROM public.events e
JOIN public.lodges l ON l.id = e.lodge_id
JOIN demo_lodge_slugs ds ON ds.slug = l.slug
WHERE e.event_date >= now()
  AND e.slug LIKE l.slug || '-event-%';

INSERT INTO public.rsvps (
  event_id, lodge_id, user_name, user_email, user_phone,
  attending_ceremony, attending_dining, number_of_guests,
  dietary_requirements, payment_required, payment_completed, status
)
SELECT
  dt.event_id, dt.lodge_id,
  'Guest ' || g || ' for ' || dt.title,
  'rsvp' || g || '-' || dt.rn || '@' || dt.lodge_slug || '.demo',
  '07' || lpad(((abs(hashtext(dt.lodge_slug || dt.slug || g::text || 'rsvp'))) % 1000000000)::text, 9, '0'),
  true,
  (g % 3 <> 0),
  (g % 4),
  CASE (g % 6) WHEN 0 THEN 'Vegetarian' WHEN 1 THEN 'Gluten free' ELSE NULL END,
  true,
  (g % 5 <> 0),
  CASE (g % 8) WHEN 7 THEN 'cancelled' ELSE 'confirmed' END
FROM demo_event_targets dt
CROSS JOIN generate_series(1, 6) AS s(g)
WHERE dt.rn <= 5
AND NOT EXISTS (
  SELECT 1 FROM public.rsvps r
  WHERE r.event_id = dt.event_id
  AND r.user_email = 'rsvp' || g || '-' || dt.rn || '@' || dt.lodge_slug || '.demo'
);

INSERT INTO public.payments (
  rsvp_id, event_id, lodge_id, user_email, user_name,
  stripe_payment_intent_id,
  dining_amount, charity_amount, raffle_amount,
  meeting_fee_amount, guest_ticket_amount,
  total_amount, currency, status, completed_at
)
SELECT
  r.id, r.event_id, r.lodge_id, r.user_email, r.user_name,
  'pi_seed_' || replace(t.lodge_slug, '-', '_') || '_' || t.rn || '_' || split_part(r.user_email, '@', 1),
  35.00,
  CASE (abs(hashtext(r.user_email)) % 4) WHEN 0 THEN 10.00 WHEN 1 THEN 20.00 ELSE 0.00 END,
  CASE (abs(hashtext(r.user_email)) % 5) WHEN 0 THEN 5.00 ELSE 0.00 END,
  10.00,
  CASE WHEN r.number_of_guests > 0 THEN r.number_of_guests * 65.00 ELSE 0.00 END,
  35.00 + 10.00
    + CASE (abs(hashtext(r.user_email)) % 4) WHEN 0 THEN 10.00 WHEN 1 THEN 20.00 ELSE 0.00 END
    + CASE (abs(hashtext(r.user_email)) % 5) WHEN 0 THEN 5.00 ELSE 0.00 END
    + CASE WHEN r.number_of_guests > 0 THEN r.number_of_guests * 65.00 ELSE 0.00 END,
  'GBP',
  CASE WHEN r.payment_completed THEN 'succeeded' ELSE 'pending' END,
  CASE WHEN r.payment_completed THEN now() - interval '3 days' ELSE NULL END
FROM public.rsvps r
JOIN demo_event_targets t ON t.event_id = r.event_id
WHERE r.user_email LIKE 'rsvp%@' || t.lodge_slug || '.demo'
ON CONFLICT (stripe_payment_intent_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 8. Donations linked to charity campaigns
-- ---------------------------------------------------------------------------

INSERT INTO public.donations (
  lodge_id, donor_name, donor_email, amount, currency, source, status,
  campaign_id, gift_aid_status, created_at
)
SELECT
  l.id,
  'Donor ' || g || ' of ' || l.name,
  'donor' || g || '@' || l.slug || '.demo',
  (10 + (g % 9) * 5)::numeric(10, 2),
  'GBP',
  CASE (g % 3) WHEN 0 THEN 'event' WHEN 1 THEN 'campaign' ELSE 'standalone' END,
  CASE (g % 9) WHEN 8 THEN 'pending' ELSE 'succeeded' END,
  (
    SELECT cc.id FROM public.charity_campaigns cc
    WHERE cc.lodge_id = l.id
    ORDER BY cc.name
    LIMIT 1 OFFSET (g % 2)
  ),
  CASE (g % 4)
    WHEN 0 THEN 'declared'
    WHEN 1 THEN 'eligible'
    WHEN 2 THEN 'declined'
    ELSE 'unknown'
  END,
  now() - (g * 4) * interval '1 day'
FROM public.lodges l
JOIN demo_lodge_slugs ds ON ds.slug = l.slug
CROSS JOIN generate_series(1, 30) AS t(g)
WHERE NOT EXISTS (
  SELECT 1 FROM public.donations dn
  WHERE dn.lodge_id = l.id
  AND dn.donor_email = 'donor' || g || '@' || l.slug || '.demo'
);

-- ---------------------------------------------------------------------------
-- 9. Member dues (outstanding + paid mix) for first ~30 members per lodge
-- ---------------------------------------------------------------------------

INSERT INTO public.member_dues (
  lodge_id, member_email, member_name, member_id, dues_id, amount, currency,
  period_start, period_end, status, paid_at
)
SELECT
  m.lodge_id, m.email, m.full_name, m.id, ld.id, ld.amount, ld.currency,
  date_trunc('year', CURRENT_DATE)::date,
  (date_trunc('year', CURRENT_DATE) + interval '1 year - 1 day')::date,
  CASE
    WHEN (m.directory_sort_order % 5) = 0 THEN 'paid'
    WHEN (m.directory_sort_order % 7) = 0 THEN 'overdue'
    WHEN (m.directory_sort_order % 11) = 0 THEN 'waived'
    ELSE 'outstanding'
  END,
  CASE
    WHEN (m.directory_sort_order % 5) = 0 THEN now() - interval '20 days'
    ELSE NULL
  END
FROM public.members m
JOIN public.lodges l ON l.id = m.lodge_id
JOIN demo_lodge_slugs ds ON ds.slug = l.slug
JOIN LATERAL (
  SELECT id, amount, currency
  FROM public.lodge_dues
  WHERE lodge_id = m.lodge_id
  ORDER BY name
  LIMIT 1
) ld ON true
WHERE m.email LIKE 'm%@' || l.slug || '.demo'
AND m.directory_sort_order <= 30
AND NOT EXISTS (
  SELECT 1 FROM public.member_dues md
  WHERE md.member_id = m.id
  AND md.period_start = date_trunc('year', CURRENT_DATE)::date
);

-- ---------------------------------------------------------------------------
-- 10. Event summons for the first 3 future events per lodge
-- ---------------------------------------------------------------------------

INSERT INTO public.event_summons (
  lodge_id, event_id, issue_date, agenda_items, menu_items, dining_time, notices, include_member_directory
)
SELECT
  t.lodge_id, t.event_id, CURRENT_DATE,
  '[
    "To open the Lodge.",
    "To submit for confirmation the circulated Minutes of the last regular meeting.",
    "To receive correspondence and apologies.",
    "To conduct the business of the Lodge.",
    "To receive the Almoner''s report.",
    "To receive the Charity Steward''s report.",
    "Risings.",
    "To close the Lodge."
  ]'::jsonb,
  '[
    "Smoked salmon mousse",
    "Roast beef with seasonal vegetables",
    "Apple crumble with custard",
    "Coffee, tea, and petits fours"
  ]'::jsonb,
  '7.30 pm',
  '[
    "Subscription cheques should be made payable to the lodge and sent direct to the Treasurer.",
    "Brethren wishing to donate to lodge charities should contact the Charity Steward."
  ]'::jsonb,
  true
FROM demo_event_targets t
WHERE t.rn <= 3
ON CONFLICT (lodge_id, event_id) DO UPDATE SET
  agenda_items = EXCLUDED.agenda_items,
  menu_items = EXCLUDED.menu_items,
  dining_time = EXCLUDED.dining_time,
  notices = EXCLUDED.notices,
  include_member_directory = true,
  updated_at = now();

DROP TABLE IF EXISTS demo_event_targets;
DROP TABLE IF EXISTS demo_lodge_slugs;
