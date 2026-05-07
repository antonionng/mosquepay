-- Demo data for the modules added in migrations 020-024:
-- treasurer (instalments + bank reconciliation), almoner (welfare),
-- communications hub (templates, messages, automations),
-- mentor and progression (signoffs, mentor pairs, ritual roles, officer ladder),
-- and a handful of audit log entries.
--
-- Targets the same 10 demo lodges as migration 020. Idempotent: every insert
-- uses ON CONFLICT or NOT EXISTS guards keyed off stable natural keys.

-- ---------------------------------------------------------------------------
-- Member backfill: birthdays, progression dates and signoff flags.
-- ---------------------------------------------------------------------------

UPDATE public.members m
SET
  date_of_birth = COALESCE(
    m.date_of_birth,
    (DATE '1955-01-01' + ((abs(hashtext(m.email)) % 14600) || ' days')::interval)::date
  ),
  date_of_passing = CASE
    WHEN m.rank IN ('FC', 'MM', 'PM') AND m.date_of_passing IS NULL
      THEN (COALESCE(m.date_of_initiation, CURRENT_DATE - interval '4 years')::date + interval '12 months')::date
    ELSE m.date_of_passing
  END,
  date_of_raising = CASE
    WHEN m.rank IN ('MM', 'PM') AND m.date_of_raising IS NULL
      THEN (COALESCE(m.date_of_initiation, CURRENT_DATE - interval '4 years')::date + interval '24 months')::date
    ELSE m.date_of_raising
  END,
  progression_signed_off_initiation = CASE
    WHEN m.rank IN ('FC', 'MM', 'PM') THEN true
    ELSE m.progression_signed_off_initiation
  END,
  progression_signed_off_passing = CASE
    WHEN m.rank IN ('MM', 'PM') THEN true
    ELSE m.progression_signed_off_passing
  END,
  progression_signed_off_raising = CASE
    WHEN m.rank = 'PM' THEN true
    ELSE m.progression_signed_off_raising
  END
FROM public.lodges l
WHERE l.id = m.lodge_id
  AND l.slug IN ('covenant-4344','westminster-2718','albion-charity-1235','cambrian-1875','aurora-borealis-3210','saint-georges-4521','mariners-anchor-2098','holyrood-1842','emerald-isle-3987','mercia-2456')
  AND m.email LIKE 'm%@' || l.slug || '.demo';

-- ---------------------------------------------------------------------------
-- Treasurer: per-dues instalment rows for the first 10 member_dues per lodge.
-- ---------------------------------------------------------------------------

INSERT INTO public.member_dues_instalments (
  lodge_id, member_dues_id, sequence, due_date, amount, currency, status, paid_at, payment_reference
)
SELECT
  d.lodge_id, d.id, seq.n,
  (date_trunc('year', CURRENT_DATE) + ((seq.n - 1) || ' months')::interval)::date,
  ROUND((d.amount / 12.0)::numeric, 2),
  d.currency,
  CASE
    WHEN d.status = 'paid' THEN 'paid'
    WHEN d.status = 'waived' THEN 'waived'
    WHEN seq.n <= 4 THEN 'paid'
    WHEN seq.n = 5 AND d.status = 'overdue' THEN 'overdue'
    ELSE 'outstanding'
  END,
  CASE
    WHEN d.status = 'paid' OR seq.n <= 4
      THEN now() - ((13 - seq.n) * 25) * interval '1 day'
    ELSE NULL
  END,
  CASE WHEN seq.n <= 4 THEN 'INST-' || lpad(seq.n::text, 2, '0') || '-' || split_part(d.member_email, '@', 1)
       ELSE NULL END
FROM (
  SELECT md.*, row_number() OVER (PARTITION BY md.lodge_id ORDER BY md.created_at, md.id) AS rn
  FROM public.member_dues md
) d
JOIN public.lodges l ON l.id = d.lodge_id
CROSS JOIN generate_series(1, 12) AS seq(n)
WHERE l.slug IN ('covenant-4344','westminster-2718','albion-charity-1235','cambrian-1875','aurora-borealis-3210','saint-georges-4521','mariners-anchor-2098','holyrood-1842','emerald-isle-3987','mercia-2456')
  AND d.rn <= 10
ON CONFLICT (member_dues_id, sequence) DO NOTHING;

-- Mark some dues as having had a reminder sent.
UPDATE public.member_dues d
SET
  reminder_sent_at = COALESCE(d.reminder_sent_at, now() - interval '7 days'),
  reminder_count = GREATEST(d.reminder_count, 1)
FROM public.lodges l
WHERE l.id = d.lodge_id
  AND l.slug IN ('covenant-4344','westminster-2718','albion-charity-1235','cambrian-1875','aurora-borealis-3210','saint-georges-4521','mariners-anchor-2098','holyrood-1842','emerald-isle-3987','mercia-2456')
  AND d.status IN ('outstanding', 'overdue');

-- ---------------------------------------------------------------------------
-- Treasurer: bank statement imports + transactions
-- ---------------------------------------------------------------------------

INSERT INTO public.bank_statement_imports (
  lodge_id, filename, account_label, total_rows, matched_rows, notes
)
SELECT
  l.id,
  'demo-statement-' || s.n || '-' || l.slug || '.csv',
  CASE s.n WHEN 1 THEN 'Lodge Current Account' ELSE 'Charity Account' END,
  15,
  CASE s.n WHEN 1 THEN 9 ELSE 6 END,
  'Seeded demo statement #' || s.n || '.'
FROM public.lodges l
CROSS JOIN generate_series(1, 2) AS s(n)
WHERE l.slug IN ('covenant-4344','westminster-2718','albion-charity-1235','cambrian-1875','aurora-borealis-3210','saint-georges-4521','mariners-anchor-2098','holyrood-1842','emerald-isle-3987','mercia-2456')
  AND NOT EXISTS (
    SELECT 1 FROM public.bank_statement_imports bi
    WHERE bi.lodge_id = l.id
      AND bi.filename = 'demo-statement-' || s.n || '-' || l.slug || '.csv'
  );

INSERT INTO public.bank_transactions (
  lodge_id, import_id, posted_date, description, amount, direction, balance,
  reference, status, matched_source_type, matched_source_id, matched_confidence, matched_at, notes
)
SELECT
  bi.lodge_id, bi.id,
  (CURRENT_DATE - ((30 - r.n) || ' days')::interval)::date,
  CASE (r.n % 5)
    WHEN 0 THEN 'Stripe payout ref ' || lpad(r.n::text, 4, '0')
    WHEN 1 THEN 'BACS subs ' || lpad(r.n::text, 4, '0')
    WHEN 2 THEN 'Donation Charity ' || lpad(r.n::text, 4, '0')
    WHEN 3 THEN 'Hall hire ' || lpad(r.n::text, 4, '0')
    ELSE 'Misc credit ' || lpad(r.n::text, 4, '0')
  END,
  ROUND((50 + (r.n * 17) % 350)::numeric, 2),
  CASE WHEN r.n % 7 = 0 THEN 'debit' ELSE 'credit' END,
  ROUND((1000 + (r.n * 53))::numeric, 2),
  'REF-' || lpad(r.n::text, 5, '0'),
  CASE
    WHEN r.n % 3 = 0 THEN 'matched'
    WHEN r.n % 11 = 0 THEN 'ignored'
    ELSE 'unmatched'
  END,
  CASE WHEN r.n % 3 = 0 THEN 'payment' ELSE NULL END,
  NULL,
  CASE WHEN r.n % 3 = 0 THEN 0.95 ELSE NULL END,
  CASE WHEN r.n % 3 = 0 THEN now() - interval '2 days' ELSE NULL END,
  CASE WHEN r.n % 7 = 0 THEN 'Refund processed' ELSE NULL END
FROM public.bank_statement_imports bi
JOIN public.lodges l ON l.id = bi.lodge_id
CROSS JOIN generate_series(1, 15) AS r(n)
WHERE l.slug IN ('covenant-4344','westminster-2718','albion-charity-1235','cambrian-1875','aurora-borealis-3210','saint-georges-4521','mariners-anchor-2098','holyrood-1842','emerald-isle-3987','mercia-2456')
  AND bi.filename LIKE 'demo-statement-%' || l.slug || '.csv'
  AND NOT EXISTS (
    SELECT 1 FROM public.bank_transactions bt
    WHERE bt.import_id = bi.id
      AND bt.reference = 'REF-' || lpad(r.n::text, 5, '0')
  );

-- ---------------------------------------------------------------------------
-- Almoner: welfare cases, visits, registers, alerts
-- ---------------------------------------------------------------------------

INSERT INTO public.welfare_cases (
  lodge_id, member_id, contact_name, contact_email, contact_phone,
  case_type, severity, status, summary, next_action, next_action_due, opened_at, closed_at
)
SELECT
  m.lodge_id, m.id, m.full_name, m.email, m.phone,
  CASE c.n
    WHEN 1 THEN 'illness'
    WHEN 2 THEN 'bereavement'
    WHEN 3 THEN 'financial'
    WHEN 4 THEN 'isolation'
    ELSE 'general'
  END,
  CASE c.n WHEN 1 THEN 'high' WHEN 2 THEN 'urgent' WHEN 5 THEN 'low' ELSE 'standard' END,
  CASE c.n WHEN 5 THEN 'closed' WHEN 4 THEN 'monitoring' ELSE 'open' END,
  CASE c.n
    WHEN 1 THEN 'Recovering from surgery; needs check-in calls.'
    WHEN 2 THEN 'Recently bereaved; family liaison ongoing.'
    WHEN 3 THEN 'Asked discreetly about dues hardship.'
    WHEN 4 THEN 'Has not attended in three meetings; no contact.'
    ELSE 'Routine pastoral check-in.'
  END,
  CASE c.n
    WHEN 1 THEN 'Phone call within 7 days'
    WHEN 2 THEN 'Visit and offer support'
    WHEN 3 THEN 'Discuss payment plan with treasurer'
    WHEN 4 THEN 'Lodge member to make contact'
    ELSE 'Re-check in 30 days'
  END,
  (CURRENT_DATE + ((c.n * 5) || ' days')::interval)::date,
  now() - ((c.n * 12) || ' days')::interval,
  CASE c.n WHEN 5 THEN now() - interval '5 days' ELSE NULL END
FROM public.members m
JOIN public.lodges l ON l.id = m.lodge_id
CROSS JOIN generate_series(1, 5) AS c(n)
WHERE l.slug IN ('covenant-4344','westminster-2718','albion-charity-1235','cambrian-1875','aurora-borealis-3210','saint-georges-4521','mariners-anchor-2098','holyrood-1842','emerald-isle-3987','mercia-2456')
  AND m.email LIKE 'm%@' || l.slug || '.demo'
  AND m.directory_sort_order = c.n
  AND NOT EXISTS (
    SELECT 1 FROM public.welfare_cases wc
    WHERE wc.lodge_id = m.lodge_id
      AND wc.member_id = m.id
      AND wc.summary = CASE c.n
        WHEN 1 THEN 'Recovering from surgery; needs check-in calls.'
        WHEN 2 THEN 'Recently bereaved; family liaison ongoing.'
        WHEN 3 THEN 'Asked discreetly about dues hardship.'
        WHEN 4 THEN 'Has not attended in three meetings; no contact.'
        ELSE 'Routine pastoral check-in.'
      END
  );

INSERT INTO public.welfare_visits (
  lodge_id, case_id, visited_at, contact_method, outcome, notes, follow_up_due
)
SELECT
  wc.lodge_id, wc.id,
  now() - ((v.n * 7) || ' days')::interval,
  CASE v.n WHEN 1 THEN 'phone' WHEN 2 THEN 'visit' ELSE 'email' END,
  CASE v.n
    WHEN 1 THEN 'Spoke briefly; spirits good.'
    WHEN 2 THEN 'Visited at home; family present.'
    ELSE 'Sent a check-in note.'
  END,
  'Demo welfare visit ' || v.n || '.',
  (CURRENT_DATE + ((v.n * 21) || ' days')::interval)::date
FROM public.welfare_cases wc
JOIN public.lodges l ON l.id = wc.lodge_id
CROSS JOIN generate_series(1, 2) AS v(n)
WHERE l.slug IN ('covenant-4344','westminster-2718','albion-charity-1235','cambrian-1875','aurora-borealis-3210','saint-georges-4521','mariners-anchor-2098','holyrood-1842','emerald-isle-3987','mercia-2456')
  AND NOT EXISTS (
    SELECT 1 FROM public.welfare_visits wv
    WHERE wv.case_id = wc.id
      AND wv.notes = 'Demo welfare visit ' || v.n || '.'
  );

INSERT INTO public.welfare_register_entries (
  lodge_id, member_id, register_type, full_name, relationship,
  contact_email, contact_phone, address, date_of_event, last_contact_at, notes
)
SELECT
  l.id, NULL, e.register_type, e.full_name, e.relationship,
  e.contact_email, e.contact_phone, e.address, e.date_of_event,
  (CURRENT_DATE - ((e.idx * 30) || ' days')::interval)::date,
  'Demo register entry seeded for testing.'
FROM public.lodges l
CROSS JOIN (
  VALUES
    (1, 'widow', 'Mrs Margaret Whitcombe', 'Widow of Bro Whitcombe', 'mwhitcombe@example.com', '07700 900100', '12 Linden Avenue', DATE '2022-04-12'),
    (2, 'bereavement', 'The Hawthorn family', 'Family of Bro Hawthorn', 'hawthorns@example.com', '07700 900200', '7 Mill Close', DATE '2024-09-03'),
    (3, 'family', 'Hilda Pemberton', 'Sister of Bro Pemberton (PM)', 'hilda@example.com', '07700 900300', '88 Castle Street', DATE '2023-12-20'),
    (4, 'widow', 'Mrs Eleanor Sharpe', 'Widow of Bro Sharpe', 'esharpe@example.com', '07700 900400', '4 The Crescent', DATE '2021-06-15')
) AS e(idx, register_type, full_name, relationship, contact_email, contact_phone, address, date_of_event)
WHERE l.slug IN ('covenant-4344','westminster-2718','albion-charity-1235','cambrian-1875','aurora-borealis-3210','saint-georges-4521','mariners-anchor-2098','holyrood-1842','emerald-isle-3987','mercia-2456')
  AND NOT EXISTS (
    SELECT 1 FROM public.welfare_register_entries wre
    WHERE wre.lodge_id = l.id AND wre.full_name = e.full_name
  );

INSERT INTO public.welfare_alerts (
  lodge_id, member_id, alert_type, severity, message, metadata, status
)
SELECT
  m.lodge_id, m.id, a.alert_type, a.severity, a.message,
  a.metadata, a.status
FROM public.members m
JOIN public.lodges l ON l.id = m.lodge_id
CROSS JOIN (
  VALUES
    (1, 'missed_meetings', 'standard', 'Missed last 3 meetings', '{"meetings_missed":3}'::jsonb, 'open'),
    (2, 'overdue_dues',    'high',     'Dues 60 days overdue',  '{"days_overdue":60}'::jsonb, 'open'),
    (3, 'silent',          'low',      'No engagement in 90 days', '{"days_silent":90}'::jsonb, 'snoozed'),
    (4, 'manual',          'standard', 'Note added by Almoner',    '{"note":"Family bereavement"}'::jsonb, 'acknowledged')
) AS a(idx, alert_type, severity, message, metadata, status)
WHERE l.slug IN ('covenant-4344','westminster-2718','albion-charity-1235','cambrian-1875','aurora-borealis-3210','saint-georges-4521','mariners-anchor-2098','holyrood-1842','emerald-isle-3987','mercia-2456')
  AND m.email LIKE 'm%@' || l.slug || '.demo'
  AND m.directory_sort_order = (10 + a.idx)
ON CONFLICT (lodge_id, member_id, alert_type) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Communications hub: per-lodge templates, sample messages, automation flags.
-- ---------------------------------------------------------------------------

INSERT INTO public.message_templates (
  lodge_id, template_key, name, subject, html_body, channel, merge_tags, is_system
)
SELECT
  l.id, t.template_key, t.name, t.subject, t.html_body, t.channel,
  t.merge_tags::text[], false
FROM public.lodges l
CROSS JOIN (
  VALUES
    ('lodge.welcome',        'New member welcome',  'Welcome to {{lodge_name}}', '<p>Hello {{first_name}}, a warm welcome from {{lodge_name}}.</p>',                  'email', '{first_name,lodge_name}'),
    ('lodge.summons',        'Meeting summons',     'Summons for {{event_title}}', '<p>{{event_title}} on {{event_date}}. Please confirm your attendance.</p>',       'email', '{event_title,event_date}'),
    ('lodge.dues.reminder',  'Dues reminder',       'Annual dues reminder',        '<p>Dear {{first_name}}, this is a reminder that your dues are due.</p>',          'email', '{first_name}'),
    ('lodge.birthday',       'Birthday greetings',  'Many happy returns',          '<p>Wishing you a very happy birthday from {{lodge_name}}.</p>',                    'email', '{first_name,lodge_name}'),
    ('lodge.almoner.checkin','Almoner check-in',    'Just checking in',            '<p>Hello {{first_name}}, just checking in. Let us know if there is anything we can do.</p>', 'email', '{first_name}')
) AS t(template_key, name, subject, html_body, channel, merge_tags)
WHERE l.slug IN ('covenant-4344','westminster-2718','albion-charity-1235','cambrian-1875','aurora-borealis-3210','saint-georges-4521','mariners-anchor-2098','holyrood-1842','emerald-isle-3987','mercia-2456')
ON CONFLICT (lodge_id, template_key) DO NOTHING;

INSERT INTO public.messages (
  lodge_id, channel, template_key, subject, body_preview, recipient_email, recipient_name,
  recipient_member_id, audience_label, status, sent_at, metadata
)
SELECT
  m.lodge_id, 'email',
  CASE n.idx WHEN 0 THEN 'lodge.welcome'
             WHEN 1 THEN 'lodge.dues.reminder'
             WHEN 2 THEN 'lodge.birthday'
             ELSE 'lodge.almoner.checkin' END,
  CASE n.idx WHEN 0 THEN 'Welcome to ' || l.name
             WHEN 1 THEN 'Annual dues reminder'
             WHEN 2 THEN 'Many happy returns'
             ELSE 'Just checking in' END,
  'Demo message preview for ' || m.full_name,
  m.email, m.full_name, m.id,
  CASE n.idx WHEN 0 THEN 'New members'
             WHEN 1 THEN 'Outstanding dues'
             WHEN 2 THEN 'Birthdays this month'
             ELSE 'Pastoral check-in' END,
  CASE (m.directory_sort_order + n.idx) % 4
    WHEN 0 THEN 'sent'
    WHEN 1 THEN 'sent'
    WHEN 2 THEN 'queued'
    ELSE 'failed'
  END,
  CASE (m.directory_sort_order + n.idx) % 4
    WHEN 0 THEN now() - interval '1 day'
    WHEN 1 THEN now() - interval '3 days'
    ELSE NULL
  END,
  jsonb_build_object('demo', true, 'index', n.idx)
FROM public.members m
JOIN public.lodges l ON l.id = m.lodge_id
CROSS JOIN generate_series(0, 3) AS n(idx)
WHERE l.slug IN ('covenant-4344','westminster-2718','albion-charity-1235','cambrian-1875','aurora-borealis-3210','saint-georges-4521','mariners-anchor-2098','holyrood-1842','emerald-isle-3987','mercia-2456')
  AND m.email LIKE 'm%@' || l.slug || '.demo'
  AND m.directory_sort_order BETWEEN 1 AND 8
  AND NOT EXISTS (
    SELECT 1 FROM public.messages msg
    WHERE msg.recipient_member_id = m.id
      AND msg.body_preview = 'Demo message preview for ' || m.full_name
      AND (msg.metadata->>'index')::int = n.idx
  );

INSERT INTO public.automation_settings (
  lodge_id, automation_key, enabled, last_run_at, config
)
SELECT
  l.id, k.key, k.enabled, k.last_run, k.config
FROM public.lodges l
CROSS JOIN (
  VALUES
    ('birthday.greeting',  true,  now() - interval '6 hours',  '{"send_at":"08:00"}'::jsonb),
    ('dues.reminder',      true,  now() - interval '5 days',   '{"escalate_after_days":21}'::jsonb),
    ('initiation.anniversary', false, NULL::timestamptz,       '{"channel":"email"}'::jsonb),
    ('almoner.silent_member', true, now() - interval '2 days', '{"silent_days":90}'::jsonb)
) AS k(key, enabled, last_run, config)
WHERE l.slug IN ('covenant-4344','westminster-2718','albion-charity-1235','cambrian-1875','aurora-borealis-3210','saint-georges-4521','mariners-anchor-2098','holyrood-1842','emerald-isle-3987','mercia-2456')
ON CONFLICT (lodge_id, automation_key) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Mentor / progression: signoffs, mentor pairs, mentor contact log.
-- ---------------------------------------------------------------------------

INSERT INTO public.progression_signoffs (
  lodge_id, member_id, degree, signed_off, notes
)
SELECT
  m.lodge_id, m.id, d.degree, true,
  'Signed off (demo)'
FROM public.members m
JOIN public.lodges l ON l.id = m.lodge_id
CROSS JOIN (
  VALUES ('initiation'), ('passing'), ('raising')
) AS d(degree)
WHERE l.slug IN ('covenant-4344','westminster-2718','albion-charity-1235','cambrian-1875','aurora-borealis-3210','saint-georges-4521','mariners-anchor-2098','holyrood-1842','emerald-isle-3987','mercia-2456')
  AND m.email LIKE 'm%@' || l.slug || '.demo'
  AND m.directory_sort_order BETWEEN 11 AND 14
  AND (
    (d.degree = 'initiation' AND m.rank IN ('FC','MM','PM'))
    OR (d.degree = 'passing' AND m.rank IN ('MM','PM'))
    OR (d.degree = 'raising' AND m.rank = 'PM')
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.progression_signoffs ps
    WHERE ps.member_id = m.id AND ps.degree = d.degree
  );

-- Mentor assignments: pair candidate-rank members (EA/FC) with senior members (MM/PM).
INSERT INTO public.mentor_assignments (
  lodge_id, mentor_member_id, mentee_member_id, started_at, notes
)
SELECT
  mentee.lodge_id,
  mentor.id,
  mentee.id,
  CURRENT_DATE - interval '30 days',
  'Demo mentoring pair'
FROM public.members mentee
JOIN public.lodges l ON l.id = mentee.lodge_id
JOIN LATERAL (
  SELECT m2.id
  FROM public.members m2
  WHERE m2.lodge_id = mentee.lodge_id
    AND m2.rank IN ('MM','PM')
    AND m2.email LIKE 'm%@' || l.slug || '.demo'
  ORDER BY m2.directory_sort_order
  OFFSET ((mentee.directory_sort_order * 7) % 30) LIMIT 1
) mentor ON true
WHERE l.slug IN ('covenant-4344','westminster-2718','albion-charity-1235','cambrian-1875','aurora-borealis-3210','saint-georges-4521','mariners-anchor-2098','holyrood-1842','emerald-isle-3987','mercia-2456')
  AND mentee.email LIKE 'm%@' || l.slug || '.demo'
  AND mentee.rank IN ('EA','FC')
  AND mentee.directory_sort_order BETWEEN 1 AND 20
  AND NOT EXISTS (
    SELECT 1 FROM public.mentor_assignments ma
    WHERE ma.mentor_member_id = mentor.id
      AND ma.mentee_member_id = mentee.id
  );

INSERT INTO public.mentor_contact_log (
  lodge_id, assignment_id, mentor_member_id, mentee_member_id,
  contacted_at, contact_method, topic, notes
)
SELECT
  ma.lodge_id, ma.id, ma.mentor_member_id, ma.mentee_member_id,
  now() - ((c.n * 14) || ' days')::interval,
  CASE c.n WHEN 1 THEN 'meeting' ELSE 'phone' END,
  CASE c.n WHEN 1 THEN 'Ritual practice' ELSE 'Catch-up call' END,
  'Demo mentor contact ' || c.n || '.'
FROM public.mentor_assignments ma
JOIN public.lodges l ON l.id = ma.lodge_id
CROSS JOIN generate_series(1, 2) AS c(n)
WHERE l.slug IN ('covenant-4344','westminster-2718','albion-charity-1235','cambrian-1875','aurora-borealis-3210','saint-georges-4521','mariners-anchor-2098','holyrood-1842','emerald-isle-3987','mercia-2456')
  AND ma.notes = 'Demo mentoring pair'
  AND NOT EXISTS (
    SELECT 1 FROM public.mentor_contact_log mcl
    WHERE mcl.assignment_id = ma.id
      AND mcl.notes = 'Demo mentor contact ' || c.n || '.'
  );

-- ---------------------------------------------------------------------------
-- Event ritual roles for the first 3 future events per lodge.
-- ---------------------------------------------------------------------------

WITH future_events AS (
  SELECT
    e.id AS event_id, e.lodge_id, l.slug AS lodge_slug,
    row_number() OVER (PARTITION BY e.lodge_id ORDER BY e.event_date ASC) AS rn
  FROM public.events e
  JOIN public.lodges l ON l.id = e.lodge_id
  WHERE e.event_date >= now()
    AND e.slug LIKE l.slug || '-event-%'
    AND l.slug IN ('covenant-4344','westminster-2718','albion-charity-1235','cambrian-1875','aurora-borealis-3210','saint-georges-4521','mariners-anchor-2098','holyrood-1842','emerald-isle-3987','mercia-2456')
)
INSERT INTO public.event_ritual_roles (
  lodge_id, event_id, role_title, member_id, sort_order
)
SELECT
  fe.lodge_id, fe.event_id, role.role_title,
  (
    SELECT m.id FROM public.members m
    WHERE m.lodge_id = fe.lodge_id
      AND m.email LIKE 'm%@' || fe.lodge_slug || '.demo'
      AND m.directory_sort_order = role.sort_order
    LIMIT 1
  ),
  role.sort_order
FROM future_events fe
CROSS JOIN (
  VALUES
    ('Worshipful Master', 1),
    ('Senior Warden', 2),
    ('Junior Warden', 3),
    ('Senior Deacon', 9),
    ('Junior Deacon', 10),
    ('Director of Ceremonies', 6)
) AS role(role_title, sort_order)
WHERE fe.rn <= 3
ON CONFLICT (event_id, role_title) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Officer ladder per lodge (succession plan), keyed to existing officer members.
-- ---------------------------------------------------------------------------

INSERT INTO public.officer_ladder (
  lodge_id, rung_label, sort_order, current_member_id, successor_member_id, notes
)
SELECT
  l.id, rung.rung_label, rung.sort_order,
  (
    SELECT m.id FROM public.members m
    WHERE m.lodge_id = l.id
      AND m.email LIKE 'm%@' || l.slug || '.demo'
      AND m.directory_sort_order = rung.current_idx
    LIMIT 1
  ),
  (
    SELECT m.id FROM public.members m
    WHERE m.lodge_id = l.id
      AND m.email LIKE 'm%@' || l.slug || '.demo'
      AND m.directory_sort_order = rung.successor_idx
    LIMIT 1
  ),
  'Seeded for demo'
FROM public.lodges l
CROSS JOIN (
  VALUES
    ('Worshipful Master', 1, 1, 2),
    ('Immediate Past Master', 2, 13, 1),
    ('Senior Warden', 3, 2, 3),
    ('Junior Warden', 4, 3, 9),
    ('Senior Deacon', 5, 9, 10),
    ('Junior Deacon', 6, 10, 12),
    ('Inner Guard', 7, 11, 12),
    ('Tyler', 8, 13, 14)
) AS rung(rung_label, sort_order, current_idx, successor_idx)
WHERE l.slug IN ('covenant-4344','westminster-2718','albion-charity-1235','cambrian-1875','aurora-borealis-3210','saint-georges-4521','mariners-anchor-2098','holyrood-1842','emerald-isle-3987','mercia-2456')
ON CONFLICT (lodge_id, rung_label) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Audit logs: a few demo entries per lodge for the audit page.
-- ---------------------------------------------------------------------------

INSERT INTO public.audit_logs (
  lodge_id, actor_email, actor_role, action, entity_type, entity_id, summary, metadata, created_at
)
SELECT
  l.id, 'ag@experrt.com', 'super_admin', a.action, a.entity_type,
  NULL, a.summary, a.metadata, now() - ((a.idx * 6) || ' hours')::interval
FROM public.lodges l
CROSS JOIN (
  VALUES
    (1, 'updated', 'lodge',          'Updated lodge branding',                  '{"field":"primary_color"}'::jsonb),
    (2, 'created', 'event',          'Created new lodge meeting',              '{"event_type":"lodge_meeting"}'::jsonb),
    (3, 'invited', 'admin_user',     'Invited treasurer',                       '{"role":"treasurer"}'::jsonb),
    (4, 'sent',    'message',        'Sent dues reminders',                     '{"recipients":12}'::jsonb),
    (5, 'matched', 'bank_transaction','Matched bank transaction to payment',    '{"confidence":0.95}'::jsonb)
) AS a(idx, action, entity_type, summary, metadata)
WHERE l.slug IN ('covenant-4344','westminster-2718','albion-charity-1235','cambrian-1875','aurora-borealis-3210','saint-georges-4521','mariners-anchor-2098','holyrood-1842','emerald-isle-3987','mercia-2456')
  AND NOT EXISTS (
    SELECT 1 FROM public.audit_logs al
    WHERE al.lodge_id = l.id
      AND al.summary = a.summary
  );
