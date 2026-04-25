CREATE TABLE IF NOT EXISTS charity_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lodge_id UUID REFERENCES lodges(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  target_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  raised_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused')),
  start_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  end_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE charity_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON charity_campaigns FOR ALL USING (true);
