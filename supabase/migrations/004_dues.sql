CREATE TABLE IF NOT EXISTS lodge_dues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lodge_id UUID NOT NULL REFERENCES lodges(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Annual Subscription',
  amount NUMERIC(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'gbp',
  billing_period TEXT NOT NULL DEFAULT 'annual',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS member_dues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lodge_id UUID NOT NULL REFERENCES lodges(id) ON DELETE CASCADE,
  member_email TEXT NOT NULL,
  member_name TEXT,
  dues_id UUID REFERENCES lodge_dues(id),
  amount NUMERIC(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'gbp',
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'outstanding' CHECK (status IN ('outstanding', 'paid', 'overdue', 'waived')),
  payment_id UUID REFERENCES payments(id),
  stripe_payment_intent_id TEXT,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE lodge_dues ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_dues ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON lodge_dues FOR ALL USING (true);
CREATE POLICY "Service role full access" ON member_dues FOR ALL USING (true);
