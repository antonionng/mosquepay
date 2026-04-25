-- Multi-tenant SaaS foundation + Gift Aid domain
-- Additive migration for lodge tenancy, website content, subscription billing, donations, and Gift Aid.

CREATE TABLE IF NOT EXISTS lodges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug VARCHAR(120) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  city VARCHAR(120),
  country VARCHAR(120),
  tagline TEXT,
  logo_url TEXT,
  primary_color VARCHAR(20),
  secondary_color VARCHAR(20),
  support_email VARCHAR(255),
  support_phone VARCHAR(50),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lodges_slug ON lodges(slug);
CREATE INDEX IF NOT EXISTS idx_lodges_active ON lodges(is_active);

CREATE TABLE IF NOT EXISTS lodge_site_pages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lodge_id UUID NOT NULL REFERENCES lodges(id) ON DELETE CASCADE,
  page_key VARCHAR(120) NOT NULL DEFAULT 'home',
  page_title VARCHAR(255) NOT NULL,
  page_description TEXT,
  sections JSONB NOT NULL DEFAULT '[]'::jsonb,
  published BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (lodge_id, page_key)
);

CREATE INDEX IF NOT EXISTS idx_lodge_site_pages_lodge_id ON lodge_site_pages(lodge_id);

ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS lodge_id UUID REFERENCES lodges(id);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS lodge_id UUID REFERENCES lodges(id);
ALTER TABLE lead_activities ADD COLUMN IF NOT EXISTS lodge_id UUID REFERENCES lodges(id);
ALTER TABLE events ADD COLUMN IF NOT EXISTS lodge_id UUID REFERENCES lodges(id);
ALTER TABLE rsvps ADD COLUMN IF NOT EXISTS lodge_id UUID REFERENCES lodges(id);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS lodge_id UUID REFERENCES lodges(id);
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS lodge_id UUID REFERENCES lodges(id);
ALTER TABLE content_pages ADD COLUMN IF NOT EXISTS lodge_id UUID REFERENCES lodges(id);
ALTER TABLE settings ADD COLUMN IF NOT EXISTS lodge_id UUID REFERENCES lodges(id);

CREATE INDEX IF NOT EXISTS idx_admin_users_lodge_id ON admin_users(lodge_id);
CREATE INDEX IF NOT EXISTS idx_leads_lodge_id ON leads(lodge_id);
CREATE INDEX IF NOT EXISTS idx_lead_activities_lodge_id ON lead_activities(lodge_id);
CREATE INDEX IF NOT EXISTS idx_events_lodge_id ON events(lodge_id);
CREATE INDEX IF NOT EXISTS idx_rsvps_lodge_id ON rsvps(lodge_id);
CREATE INDEX IF NOT EXISTS idx_payments_lodge_id ON payments(lodge_id);
CREATE INDEX IF NOT EXISTS idx_blog_posts_lodge_id ON blog_posts(lodge_id);
CREATE INDEX IF NOT EXISTS idx_content_pages_lodge_id ON content_pages(lodge_id);
CREATE INDEX IF NOT EXISTS idx_settings_lodge_id ON settings(lodge_id);

DROP INDEX IF EXISTS idx_events_slug;
CREATE UNIQUE INDEX IF NOT EXISTS idx_events_lodge_slug_unique ON events(lodge_id, slug);

DROP INDEX IF EXISTS idx_blog_posts_slug;
CREATE UNIQUE INDEX IF NOT EXISTS idx_blog_posts_lodge_slug_unique ON blog_posts(lodge_id, slug);

CREATE TABLE IF NOT EXISTS donations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lodge_id UUID NOT NULL REFERENCES lodges(id) ON DELETE CASCADE,
  event_id UUID REFERENCES events(id) ON DELETE SET NULL,
  payment_id UUID REFERENCES payments(id) ON DELETE SET NULL,
  donor_name VARCHAR(255),
  donor_email VARCHAR(255) NOT NULL,
  amount DECIMAL(10,2) NOT NULL CHECK (amount >= 0),
  currency VARCHAR(3) NOT NULL DEFAULT 'GBP',
  source VARCHAR(80) NOT NULL DEFAULT 'event',
  status VARCHAR(50) NOT NULL DEFAULT 'succeeded',
  gift_aid_declaration_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_donations_lodge_id ON donations(lodge_id);
CREATE INDEX IF NOT EXISTS idx_donations_event_id ON donations(event_id);
CREATE INDEX IF NOT EXISTS idx_donations_payment_id ON donations(payment_id);
CREATE INDEX IF NOT EXISTS idx_donations_donor_email ON donations(donor_email);

CREATE TABLE IF NOT EXISTS gift_aid_declarations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lodge_id UUID NOT NULL REFERENCES lodges(id) ON DELETE CASCADE,
  donor_name VARCHAR(255) NOT NULL,
  donor_email VARCHAR(255) NOT NULL,
  donor_address_line_1 TEXT,
  donor_address_line_2 TEXT,
  donor_city VARCHAR(120),
  donor_postcode VARCHAR(30),
  donor_country VARCHAR(120) DEFAULT 'United Kingdom',
  declaration_text TEXT NOT NULL,
  declaration_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
  confirmation_method VARCHAR(50) NOT NULL DEFAULT 'checkout_checkbox',
  hmrc_eligible BOOLEAN NOT NULL DEFAULT TRUE,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gift_aid_declarations_lodge_id ON gift_aid_declarations(lodge_id);
CREATE INDEX IF NOT EXISTS idx_gift_aid_declarations_donor_email ON gift_aid_declarations(donor_email);

ALTER TABLE donations
  ADD CONSTRAINT donations_gift_aid_declaration_fk
  FOREIGN KEY (gift_aid_declaration_id) REFERENCES gift_aid_declarations(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS lodge_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lodge_id UUID NOT NULL REFERENCES lodges(id) ON DELETE CASCADE,
  stripe_customer_id VARCHAR(255),
  stripe_subscription_id VARCHAR(255),
  plan_code VARCHAR(100) NOT NULL DEFAULT 'starter',
  billing_cycle VARCHAR(20) NOT NULL DEFAULT 'monthly',
  seats INTEGER NOT NULL DEFAULT 1,
  amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  currency VARCHAR(3) NOT NULL DEFAULT 'GBP',
  status VARCHAR(50) NOT NULL DEFAULT 'trialing',
  trial_ends_at TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (lodge_id)
);

CREATE INDEX IF NOT EXISTS idx_lodge_subscriptions_status ON lodge_subscriptions(status);

ALTER TABLE lodges ENABLE ROW LEVEL SECURITY;
ALTER TABLE lodge_site_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE donations ENABLE ROW LEVEL SECURITY;
ALTER TABLE gift_aid_declarations ENABLE ROW LEVEL SECURITY;
ALTER TABLE lodge_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role all lodges" ON lodges FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role all lodge site pages" ON lodge_site_pages FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role all donations" ON donations FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role all gift aid declarations" ON gift_aid_declarations FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role all lodge subscriptions" ON lodge_subscriptions FOR ALL TO service_role USING (true) WITH CHECK (true);

