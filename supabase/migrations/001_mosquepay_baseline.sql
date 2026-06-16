-- MosquePay fresh baseline schema
-- This project is a mosque-native product. It intentionally starts from a
-- clean migration history without legacy society-only entities.

create extension if not exists pgcrypto;

create schema if not exists mooov;

create table public.mosques (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  city text,
  country text default 'GB',
  tagline text,
  logo_url text,
  primary_color text default '#0B43B8',
  secondary_color text default '#E0F2FE',
  support_email text,
  support_phone text,
  mosque_number text,
  governing_body text,
  service_schedule text,
  secretary_name text,
  secretary_address text,
  secretary_phone text,
  charity_donation_url text,
  data_protection_notice text,
  newcomer_notice text,
  wifi_details text,
  service_location text,
  service_location_url text,
  accessibility_notes text,
  default_dress_code text,
  is_active boolean not null default true,
  network_id uuid,
  custom_domain text unique,
  custom_domain_verified_at timestamptz,
  custom_domain_verification_token text,
  accepts_self_registration boolean not null default true,
  current_charity_campaign_id uuid,
  gift_aid_default_mode text not null default 'digital' check (gift_aid_default_mode in ('digital','paper','both')),
  hmrc_charity_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.networks (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  contact_email text,
  created_at timestamptz not null default now()
);

alter table public.mosques add constraint mosques_network_id_fkey foreign key (network_id) references public.networks(id) on delete set null;

create table public.admin_users (
  id uuid primary key default gen_random_uuid(),
  mosque_id uuid references public.mosques(id) on delete cascade,
  email text not null,
  name text,
  role text not null default 'admin',
  is_platform_owner boolean not null default false,
  created_at timestamptz not null default now(),
  unique (mosque_id, email)
);

create table public.members (
  id uuid primary key default gen_random_uuid(),
  mosque_id uuid not null references public.mosques(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  email text,
  phone text,
  address text,
  date_of_birth date,
  joined_at date,
  membership_status text not null default 'active' check (membership_status in ('active','inactive','lapsed','pastoral','deceased')),
  membership_title text,
  membership_sort_order integer,
  gift_aid_eligible boolean not null default false,
  giving_method text,
  dietary_notes text,
  accessibility_notes text,
  emergency_contact text,
  pastoral_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.membership_roles (
  id uuid primary key default gen_random_uuid(),
  mosque_id uuid not null references public.mosques(id) on delete cascade,
  role_label text not null,
  description text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.member_membership_roles (
  id uuid primary key default gen_random_uuid(),
  mosque_id uuid not null references public.mosques(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  role_id uuid not null references public.membership_roles(id) on delete cascade,
  starts_on date,
  ends_on date,
  created_at timestamptz not null default now()
);

create table public.giving_years (
  id uuid primary key default gen_random_uuid(),
  mosque_id uuid not null references public.mosques(id) on delete cascade,
  label text not null,
  starts_on date not null,
  ends_on date not null,
  default_annual_amount numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  unique (mosque_id, label)
);

create table public.member_giving (
  id uuid primary key default gen_random_uuid(),
  mosque_id uuid not null references public.mosques(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  giving_year_id uuid references public.giving_years(id) on delete set null,
  amount_due numeric(12,2) not null default 0,
  amount_paid numeric(12,2) not null default 0,
  status text not null default 'pending' check (status in ('pending','part_paid','paid','waived','cancelled')),
  payment_method text,
  due_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.giving_schedules (
  id uuid primary key default gen_random_uuid(),
  mosque_id uuid not null references public.mosques(id) on delete cascade,
  member_id uuid references public.members(id) on delete set null,
  amount numeric(12,2) not null,
  frequency text not null default 'monthly' check (frequency in ('weekly','monthly','quarterly','annual')),
  status text not null default 'active' check (status in ('active','paused','cancelled','failed')),
  mooov_contract_id text,
  next_charge_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  mosque_id uuid not null references public.mosques(id) on delete cascade,
  slug text,
  title text not null,
  type text not null default 'event' check (type in ('jumuah','daily_prayer','special_prayer','committee','event')),
  starts_at timestamptz not null,
  ends_at timestamptz,
  location text,
  description text,
  enable_rsvp boolean not null default true,
  enable_meal_signup boolean not null default false,
  meal_label text default 'Community meal',
  enable_event_fee boolean not null default false,
  event_fee_amount numeric(12,2) not null default 0,
  service_closed_at timestamptz,
  service_closed_by uuid references public.admin_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (mosque_id, slug)
);

create table public.service_sequences (
  id uuid primary key default gen_random_uuid(),
  mosque_id uuid not null references public.mosques(id) on delete cascade,
  name text not null,
  weekday integer not null check (weekday between 0 and 6),
  start_time time not null,
  frequency text not null default 'weekly',
  default_location text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.service_notices (
  id uuid primary key default gen_random_uuid(),
  mosque_id uuid not null references public.mosques(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  subject text not null,
  intro text,
  order_of_service jsonb not null default '[]'::jsonb,
  notices jsonb not null default '[]'::jsonb,
  meal_details jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft','approved','sent')),
  approved_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id)
);

create table public.service_notice_sends (
  id uuid primary key default gen_random_uuid(),
  notice_id uuid not null references public.service_notices(id) on delete cascade,
  member_id uuid references public.members(id) on delete set null,
  email text,
  status text not null default 'queued',
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.service_notice_access_links (
  id uuid primary key default gen_random_uuid(),
  notice_id uuid not null references public.service_notices(id) on delete cascade,
  member_id uuid references public.members(id) on delete cascade,
  token text not null unique,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.guests (
  id uuid primary key default gen_random_uuid(),
  mosque_id uuid not null references public.mosques(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  email text,
  phone text,
  source text default 'newcomer',
  dietary_notes text,
  gift_aid_consent boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.newcomers (
  id uuid primary key default gen_random_uuid(),
  mosque_id uuid not null references public.mosques(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  email text,
  phone text,
  stage text not null default 'enquiry' check (stage in ('enquiry','visited','follow_up','membership_class','member','closed')),
  notes text,
  next_action_at timestamptz,
  converted_member_id uuid references public.members(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.rsvps (
  id uuid primary key default gen_random_uuid(),
  mosque_id uuid not null references public.mosques(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  member_id uuid references public.members(id) on delete cascade,
  guest_id uuid references public.guests(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','yes','no','maybe')),
  attending_meal boolean not null default false,
  notes text,
  created_at timestamptz not null default now()
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  mosque_id uuid not null references public.mosques(id) on delete cascade,
  member_id uuid references public.members(id) on delete set null,
  guest_id uuid references public.guests(id) on delete set null,
  event_id uuid references public.events(id) on delete set null,
  amount numeric(12,2) not null,
  currency text not null default 'GBP',
  status text not null default 'pending',
  payment_method text,
  mooov_payment_id text,
  stripe_payment_intent_id text,
  source text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.donations (
  id uuid primary key default gen_random_uuid(),
  mosque_id uuid not null references public.mosques(id) on delete cascade,
  member_id uuid references public.members(id) on delete set null,
  guest_id uuid references public.guests(id) on delete set null,
  payment_id uuid references public.payments(id) on delete set null,
  amount numeric(12,2) not null,
  fund text default 'general',
  gift_aid boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.charity_campaigns (
  id uuid primary key default gen_random_uuid(),
  mosque_id uuid not null references public.mosques(id) on delete cascade,
  name text not null,
  description text,
  target_amount numeric(12,2),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.mosques add constraint mosques_current_charity_campaign_id_fkey foreign key (current_charity_campaign_id) references public.charity_campaigns(id) on delete set null;

create table public.gift_aid_declarations (
  id uuid primary key default gen_random_uuid(),
  mosque_id uuid not null references public.mosques(id) on delete cascade,
  member_id uuid references public.members(id) on delete cascade,
  guest_id uuid references public.guests(id) on delete cascade,
  donor_name text not null,
  address text,
  postcode text,
  starts_on date not null default current_date,
  ends_on date,
  status text not null default 'active',
  evidence_url text,
  evidence_hash text,
  created_at timestamptz not null default now()
);

create table public.gift_aid_claim_batches (
  id uuid primary key default gen_random_uuid(),
  mosque_id uuid not null references public.mosques(id) on delete cascade,
  claim_reference text,
  status text not null default 'draft',
  total_donation_amount numeric(12,2) not null default 0,
  total_claim_amount numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

create table public.gift_aid_claim_items (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.gift_aid_claim_batches(id) on delete cascade,
  donation_id uuid references public.donations(id) on delete set null,
  declaration_id uuid references public.gift_aid_declarations(id) on delete set null,
  donation_amount numeric(12,2) not null,
  claim_amount numeric(12,2) not null
);

create table public.service_collections (
  id uuid primary key default gen_random_uuid(),
  mosque_id uuid not null references public.mosques(id) on delete cascade,
  event_id uuid references public.events(id) on delete set null,
  cash_amount numeric(12,2) not null default 0,
  card_amount numeric(12,2) not null default 0,
  gasds_eligible_amount numeric(12,2) not null default 0,
  closed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.gasds_claims (
  id uuid primary key default gen_random_uuid(),
  mosque_id uuid not null references public.mosques(id) on delete cascade,
  service_collection_id uuid references public.service_collections(id) on delete set null,
  tax_year text not null,
  eligible_amount numeric(12,2) not null default 0,
  claim_amount numeric(12,2) not null default 0,
  status text not null default 'draft',
  created_at timestamptz not null default now()
);

create table public.pastoral_cases (
  id uuid primary key default gen_random_uuid(),
  mosque_id uuid not null references public.mosques(id) on delete cascade,
  member_id uuid references public.members(id) on delete set null,
  title text not null,
  status text not null default 'open',
  severity text not null default 'low',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.pastoral_visits (
  id uuid primary key default gen_random_uuid(),
  mosque_id uuid not null references public.mosques(id) on delete cascade,
  case_id uuid references public.pastoral_cases(id) on delete cascade,
  member_id uuid references public.members(id) on delete set null,
  visited_at timestamptz not null default now(),
  notes text
);

create table public.pastoral_alerts (
  id uuid primary key default gen_random_uuid(),
  mosque_id uuid not null references public.mosques(id) on delete cascade,
  member_id uuid references public.members(id) on delete cascade,
  alert_type text not null,
  severity text not null default 'medium',
  message text not null,
  status text not null default 'open',
  created_at timestamptz not null default now()
);

create table public.mosque_site_pages (
  id uuid primary key default gen_random_uuid(),
  mosque_id uuid not null references public.mosques(id) on delete cascade,
  slug text not null,
  title text not null,
  sections jsonb not null default '[]'::jsonb,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (mosque_id, slug)
);

create table public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  mosque_id uuid references public.mosques(id) on delete cascade,
  slug text not null,
  title text not null,
  excerpt text,
  body text,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  unique (mosque_id, slug)
);

create table public.message_templates (
  id uuid primary key default gen_random_uuid(),
  mosque_id uuid not null references public.mosques(id) on delete cascade,
  name text not null,
  subject text not null,
  body text not null,
  created_at timestamptz not null default now()
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  mosque_id uuid not null references public.mosques(id) on delete cascade,
  template_id uuid references public.message_templates(id) on delete set null,
  subject text not null,
  body text not null,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  mosque_id uuid references public.mosques(id) on delete cascade,
  actor_admin_id uuid references public.admin_users(id) on delete set null,
  action text not null,
  entity_type text,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.email_log (
  id uuid primary key default gen_random_uuid(),
  mosque_id uuid references public.mosques(id) on delete cascade,
  recipient text not null,
  subject text not null,
  status text not null default 'queued',
  provider_message_id text,
  created_at timestamptz not null default now()
);

create table public.bank_statement_imports (
  id uuid primary key default gen_random_uuid(),
  mosque_id uuid not null references public.mosques(id) on delete cascade,
  filename text not null,
  imported_at timestamptz not null default now()
);

create table public.bank_transactions (
  id uuid primary key default gen_random_uuid(),
  mosque_id uuid not null references public.mosques(id) on delete cascade,
  import_id uuid references public.bank_statement_imports(id) on delete cascade,
  posted_at date not null,
  description text not null,
  amount numeric(12,2) not null,
  matched_payment_id uuid references public.payments(id) on delete set null,
  created_at timestamptz not null default now()
);

create table mooov.mosques (
  id text primary key,
  mosque_id uuid references public.mosques(id) on delete cascade,
  mosque_slug text not null,
  merchant_id text,
  onboarding_status text not null default 'not_started',
  created_at timestamptz not null default now()
);

create table mooov.payment_attempts (
  id uuid primary key default gen_random_uuid(),
  mosque_id uuid references public.mosques(id) on delete cascade,
  mooov_payment_id text unique,
  amount numeric(12,2) not null,
  currency text not null default 'GBP',
  status text not null default 'pending',
  source text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table mooov.mooov_webhook_events (
  id uuid primary key default gen_random_uuid(),
  event_id text not null unique,
  event_type text not null,
  payload jsonb not null,
  received_at timestamptz not null default now()
);

create index on public.members (mosque_id);
create index on public.events (mosque_id, starts_at);
create index on public.payments (mosque_id, created_at);
create index on public.donations (mosque_id, created_at);
create index on public.gift_aid_declarations (mosque_id);
create index on public.pastoral_cases (mosque_id, status);

alter table public.mosques enable row level security;
alter table public.networks enable row level security;
alter table public.admin_users enable row level security;
alter table public.members enable row level security;
alter table public.membership_roles enable row level security;
alter table public.member_membership_roles enable row level security;
alter table public.giving_years enable row level security;
alter table public.member_giving enable row level security;
alter table public.giving_schedules enable row level security;
alter table public.events enable row level security;
alter table public.service_sequences enable row level security;
alter table public.service_notices enable row level security;
alter table public.service_notice_sends enable row level security;
alter table public.service_notice_access_links enable row level security;
alter table public.guests enable row level security;
alter table public.newcomers enable row level security;
alter table public.rsvps enable row level security;
alter table public.payments enable row level security;
alter table public.donations enable row level security;
alter table public.charity_campaigns enable row level security;
alter table public.gift_aid_declarations enable row level security;
alter table public.gift_aid_claim_batches enable row level security;
alter table public.gift_aid_claim_items enable row level security;
alter table public.service_collections enable row level security;
alter table public.gasds_claims enable row level security;
alter table public.pastoral_cases enable row level security;
alter table public.pastoral_visits enable row level security;
alter table public.pastoral_alerts enable row level security;
alter table public.mosque_site_pages enable row level security;
alter table public.blog_posts enable row level security;
alter table public.message_templates enable row level security;
alter table public.messages enable row level security;
alter table public.audit_logs enable row level security;
alter table public.email_log enable row level security;
alter table public.bank_statement_imports enable row level security;
alter table public.bank_transactions enable row level security;
alter table mooov.mosques enable row level security;
alter table mooov.payment_attempts enable row level security;
alter table mooov.mooov_webhook_events enable row level security;

-- Public read policies for public-facing mosque content. Admin/API writes use service-role.
create policy "public can read active mosques" on public.mosques for select using (is_active = true);
create policy "public can read published mosque pages" on public.mosque_site_pages for select using (is_published = true);
create policy "public can read published blog posts" on public.blog_posts for select using (published_at is not null);
create policy "public can read public events" on public.events for select using (true);

do $$
declare
  table_record record;
begin
  for table_record in
    select schemaname, tablename
    from pg_tables
    where schemaname in ('public', 'mooov')
  loop
    execute format(
      'create policy %I on %I.%I for all using (auth.role() = %L) with check (auth.role() = %L)',
      'service_role_manage_' || table_record.tablename,
      table_record.schemaname,
      table_record.tablename,
      'service_role',
      'service_role'
    );
  end loop;
end $$;

insert into public.mosques (slug, name, city, tagline, support_email, service_schedule, service_location, hmrc_charity_reference)
values ('central-jamia-demo', 'Central Jamia Masjid', 'London', 'Donations, Jumu''ah, welfare, and Gift Aid in one place.', 'hello@mosque-pay.com', 'Jumu''ah Fridays at 13:00', 'High Street, London', 'MOSQUEPAY-DEMO');

insert into public.membership_roles (mosque_id, role_label, description, sort_order)
select id, role_label, description, sort_order
from public.mosques
cross join (values
  ('Imam', 'Leads prayers, delivers the khutbah, and provides religious guidance', 10),
  ('Mosque Secretary', 'Governance, announcements, and records', 20),
  ('Treasurer', 'Donations, payments, Gift Aid, and reconciliation', 30),
  ('Welfare Lead', 'Community welfare cases, visits, and follow-up', 40),
  ('Safeguarding Lead', 'Safeguarding contact and escalation', 50),
  ('Trustee', 'Charitable governance and oversight', 60),
  ('Mu''adhin', 'Calls the adhan and supports prayer coordination', 70),
  ('Committee Member', 'Community programmes and practical support', 80)
) as roles(role_label, description, sort_order)
where slug = 'central-jamia-demo';

insert into public.giving_years (mosque_id, label, starts_on, ends_on, default_annual_amount)
select id, '2026/27', date '2026-04-01', date '2027-03-31', 0
from public.mosques
where slug = 'central-jamia-demo';

insert into public.mosque_site_pages (mosque_id, slug, title, sections)
select id, 'home', 'Welcome to Central Jamia Masjid', '[{"type":"hero","heading":"Welcome to Central Jamia Masjid","body":"A demo MosquePay site for Jumu''ah, donations, Zakat & Sadaqah, Gift Aid, and community welfare."}]'::jsonb
from public.mosques
where slug = 'central-jamia-demo';
