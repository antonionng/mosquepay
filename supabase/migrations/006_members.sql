-- Members table
CREATE TABLE IF NOT EXISTS members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lodge_id UUID NOT NULL REFERENCES lodges(id) ON DELETE CASCADE,
  auth_user_id UUID,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT,
  rank TEXT,
  dietary_requirements TEXT,
  date_of_initiation DATE,
  initiation_email_sent BOOLEAN NOT NULL DEFAULT false,
  membership_status TEXT NOT NULL DEFAULT 'active'
    CHECK (membership_status IN ('active','suspended','resigned','excluded')),
  stripe_customer_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (lodge_id, email)
);

ALTER TABLE members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON members FOR ALL USING (true);

-- Add member_id FK to member_dues
ALTER TABLE member_dues ADD COLUMN IF NOT EXISTS member_id UUID REFERENCES members(id);
ALTER TABLE member_dues ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;

-- Add instalment settings to lodge_dues
ALTER TABLE lodge_dues ADD COLUMN IF NOT EXISTS allow_instalments BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE lodge_dues ADD COLUMN IF NOT EXISTS instalment_count INT DEFAULT 12;
ALTER TABLE lodge_dues ADD COLUMN IF NOT EXISTS instalment_frequency TEXT DEFAULT 'monthly';
