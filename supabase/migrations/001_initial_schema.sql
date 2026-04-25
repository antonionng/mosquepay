-- Covenant Lodge: initial schema (per brief)
-- Run in Supabase SQL editor or via supabase db push

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Admin users (for roles; auth can be Supabase Auth or dummy)
CREATE TABLE IF NOT EXISTS admin_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_user_id UUID UNIQUE,
  email VARCHAR(255) UNIQUE NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'editor',
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_login TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_admin_users_email ON admin_users(email);
CREATE INDEX IF NOT EXISTS idx_admin_users_role ON admin_users(role);
CREATE INDEX IF NOT EXISTS idx_admin_users_auth_user_id ON admin_users(auth_user_id);

-- Leads (recruitment pipeline)
CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  location VARCHAR(255),
  source VARCHAR(100),
  how_heard_about_us TEXT,
  initial_message TEXT,
  stage VARCHAR(50) NOT NULL DEFAULT 'expression_of_interest',
  assigned_to UUID REFERENCES admin_users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  stage_changed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leads_stage ON leads(stage);
CREATE INDEX IF NOT EXISTS idx_leads_assigned_to ON leads(assigned_to);
CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(email);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at DESC);

-- Lead activities (notes, meetings, tasks)
CREATE TABLE IF NOT EXISTS lead_activities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  activity_type VARCHAR(50) NOT NULL,
  title VARCHAR(255),
  description TEXT,
  meeting_date TIMESTAMPTZ,
  attendees TEXT[],
  due_date TIMESTAMPTZ,
  completed BOOLEAN DEFAULT FALSE,
  created_by UUID REFERENCES admin_users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lead_activities_lead_id ON lead_activities(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_activities_type ON lead_activities(activity_type);

-- Events
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE NOT NULL,
  description TEXT,
  event_type VARCHAR(50) NOT NULL,
  event_date TIMESTAMPTZ NOT NULL,
  event_time TIME,
  location VARCHAR(255) DEFAULT 'Mark Masons'' Hall',
  temple_room VARCHAR(100),
  dress_code VARCHAR(100),
  enable_rsvp BOOLEAN DEFAULT TRUE,
  rsvp_deadline TIMESTAMPTZ,
  max_attendees INTEGER,
  enable_payments BOOLEAN DEFAULT FALSE,
  enable_dining_rsvp BOOLEAN DEFAULT FALSE,
  dining_price DECIMAL(10,2),
  dining_description TEXT,
  enable_charity_donation BOOLEAN DEFAULT FALSE,
  charity_name VARCHAR(255),
  charity_description TEXT,
  charity_suggested_amounts JSONB DEFAULT '[10, 20, 50, 100]',
  charity_allow_custom BOOLEAN DEFAULT TRUE,
  enable_raffle_donation BOOLEAN DEFAULT FALSE,
  raffle_description TEXT DEFAULT 'Help fund evening raffle prizes',
  raffle_suggested_amounts JSONB DEFAULT '[5, 10, 20, 50]',
  raffle_allow_custom BOOLEAN DEFAULT TRUE,
  featured_image_url TEXT,
  created_by UUID REFERENCES admin_users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  published BOOLEAN DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_events_event_date ON events(event_date);
CREATE INDEX IF NOT EXISTS idx_events_event_type ON events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_slug ON events(slug);
CREATE INDEX IF NOT EXISTS idx_events_published ON events(published);

-- RSVPs
CREATE TABLE IF NOT EXISTS rsvps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_name VARCHAR(255) NOT NULL,
  user_email VARCHAR(255) NOT NULL,
  user_phone VARCHAR(50),
  attending_ceremony BOOLEAN DEFAULT TRUE,
  attending_dining BOOLEAN DEFAULT FALSE,
  number_of_guests INTEGER DEFAULT 0,
  dietary_requirements TEXT,
  special_requests TEXT,
  payment_required BOOLEAN DEFAULT FALSE,
  payment_completed BOOLEAN DEFAULT FALSE,
  payment_id UUID,
  status VARCHAR(50) DEFAULT 'confirmed',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rsvps_event_id ON rsvps(event_id);
CREATE INDEX IF NOT EXISTS idx_rsvps_user_email ON rsvps(user_email);
CREATE INDEX IF NOT EXISTS idx_rsvps_status ON rsvps(status);

-- Payments (payment_id in rsvps references this after table exists)
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rsvp_id UUID REFERENCES rsvps(id) ON DELETE SET NULL,
  event_id UUID REFERENCES events(id),
  user_email VARCHAR(255) NOT NULL,
  user_name VARCHAR(255),
  stripe_payment_intent_id VARCHAR(255) UNIQUE,
  stripe_charge_id VARCHAR(255),
  stripe_customer_id VARCHAR(255),
  dining_amount DECIMAL(10,2) DEFAULT 0.00,
  charity_amount DECIMAL(10,2) DEFAULT 0.00,
  raffle_amount DECIMAL(10,2) DEFAULT 0.00,
  total_amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'GBP',
  charity_name VARCHAR(255),
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  refund_amount DECIMAL(10,2) DEFAULT 0.00,
  refund_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_payments_rsvp_id ON payments(rsvp_id);
CREATE INDEX IF NOT EXISTS idx_payments_event_id ON payments(event_id);
CREATE INDEX IF NOT EXISTS idx_payments_stripe_pi ON payments(stripe_payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);

ALTER TABLE rsvps ADD CONSTRAINT fk_rsvps_payment FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE SET NULL;

-- Blog posts
CREATE TABLE IF NOT EXISTS blog_posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE NOT NULL,
  excerpt TEXT,
  content TEXT NOT NULL,
  featured_image_url TEXT,
  category VARCHAR(100),
  tags TEXT[],
  meta_description TEXT,
  meta_keywords TEXT,
  author_id UUID REFERENCES admin_users(id),
  author_name VARCHAR(255),
  published BOOLEAN DEFAULT FALSE,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_blog_posts_slug ON blog_posts(slug);
CREATE INDEX IF NOT EXISTS idx_blog_posts_published ON blog_posts(published);
CREATE INDEX IF NOT EXISTS idx_blog_posts_published_at ON blog_posts(published_at DESC NULLS LAST);

-- Content pages (editable static content)
CREATE TABLE IF NOT EXISTS content_pages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  page_key VARCHAR(100) UNIQUE NOT NULL,
  title VARCHAR(255),
  content TEXT,
  updated_by UUID REFERENCES admin_users(id),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_content_pages_page_key ON content_pages(page_key);

-- Settings (key-value)
CREATE TABLE IF NOT EXISTS settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  setting_key VARCHAR(100) UNIQUE NOT NULL,
  setting_value TEXT,
  setting_type VARCHAR(50) DEFAULT 'string',
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_settings_key ON settings(setting_key);

-- RLS: API uses service role to insert leads; anon has no direct access
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role all leads" ON leads FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role only admin_users" ON admin_users FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE lead_activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role only lead_activities" ON lead_activities FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anon read published events" ON events FOR SELECT TO anon USING (published = true);
CREATE POLICY "Service role all events" ON events FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE rsvps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anon insert rsvps" ON rsvps FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Service role all rsvps" ON rsvps FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role only payments" ON payments FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anon read published blog" ON blog_posts FOR SELECT TO anon USING (published = true AND published_at <= NOW());
CREATE POLICY "Service role all blog_posts" ON blog_posts FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE content_pages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anon read content_pages" ON content_pages FOR SELECT TO anon USING (true);
CREATE POLICY "Service role all content_pages" ON content_pages FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anon read public settings" ON settings FOR SELECT TO anon USING (true);
CREATE POLICY "Service role all settings" ON settings FOR ALL TO service_role USING (true) WITH CHECK (true);
