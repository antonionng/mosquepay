-- Plan entitlements, dues Gift Aid, meeting collections, and GASDS foundations.

UPDATE public.lodge_subscriptions
SET plan_code = CASE
  WHEN plan_code IN ('starter', 'single', 'single_lodge') THEN 'lodge_essentials'
  WHEN plan_code IN ('complete', 'pro', 'growth') THEN 'lodge_complete'
  WHEN plan_code IN ('group', 'multi_lodge') THEN 'lodge_group'
  WHEN plan_code = 'province' THEN 'province'
  ELSE 'lodge_essentials'
END;

ALTER TABLE public.lodge_subscriptions
  ADD COLUMN IF NOT EXISTS requested_plan_code text,
  ADD COLUMN IF NOT EXISTS last_upgrade_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS lodge_limit integer;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'lodge_subscriptions_plan_code_check'
      AND conrelid = 'public.lodge_subscriptions'::regclass
  ) THEN
    ALTER TABLE public.lodge_subscriptions
      ADD CONSTRAINT lodge_subscriptions_plan_code_check
      CHECK (
        plan_code IN (
          'lodge_essentials',
          'lodge_complete',
          'lodge_group',
          'province'
        )
      );
  END IF;
END $$;

ALTER TABLE public.lodge_dues
  ADD COLUMN IF NOT EXISTS charitable_amount numeric(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS charitable_label text NOT NULL DEFAULT 'Charitable portion',
  ADD COLUMN IF NOT EXISTS gift_aid_enabled boolean NOT NULL DEFAULT false;

ALTER TABLE public.member_dues
  ADD COLUMN IF NOT EXISTS charitable_amount numeric(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gift_aid_declaration_id uuid REFERENCES public.gift_aid_declarations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS gift_aid_status text NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS gift_aid_eligible_amount numeric(12, 2) NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'member_dues_gift_aid_status_check'
      AND conrelid = 'public.member_dues'::regclass
  ) THEN
    ALTER TABLE public.member_dues
      ADD CONSTRAINT member_dues_gift_aid_status_check
      CHECK (gift_aid_status IN ('unknown', 'eligible', 'declared', 'declined'));
  END IF;
END $$;

ALTER TABLE public.gift_aid_declarations
  ADD COLUMN IF NOT EXISTS declaration_source text NOT NULL DEFAULT 'online_checkout',
  ADD COLUMN IF NOT EXISTS retained_until date,
  ADD COLUMN IF NOT EXISTS revoked_reason text;

ALTER TABLE public.donations
  ADD COLUMN IF NOT EXISTS gift_aid_eligible_amount numeric(12, 2),
  ADD COLUMN IF NOT EXISTS gift_aid_claimed_at timestamptz,
  ADD COLUMN IF NOT EXISTS gift_aid_claim_batch_id uuid,
  ADD COLUMN IF NOT EXISTS gasds_eligible boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS gasds_claimed_at timestamptz,
  ADD COLUMN IF NOT EXISTS tax_year text;

CREATE TABLE IF NOT EXISTS public.gift_aid_claim_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lodge_id uuid NOT NULL REFERENCES public.lodges(id) ON DELETE CASCADE,
  claim_reference text,
  period_start date NOT NULL,
  period_end date NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  donation_count integer NOT NULL DEFAULT 0,
  eligible_amount numeric(12, 2) NOT NULL DEFAULT 0,
  reclaimable_amount numeric(12, 2) NOT NULL DEFAULT 0,
  exported_at timestamptz,
  filed_at timestamptz,
  paid_at timestamptz,
  notes text,
  created_by_email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'gift_aid_claim_batches_status_check'
      AND conrelid = 'public.gift_aid_claim_batches'::regclass
  ) THEN
    ALTER TABLE public.gift_aid_claim_batches
      ADD CONSTRAINT gift_aid_claim_batches_status_check
      CHECK (status IN ('draft', 'exported', 'filed', 'paid'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_gift_aid_claim_batches_lodge
  ON public.gift_aid_claim_batches(lodge_id);
CREATE INDEX IF NOT EXISTS idx_gift_aid_claim_batches_period
  ON public.gift_aid_claim_batches(period_start, period_end);

ALTER TABLE public.gift_aid_claim_batches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all_gift_aid_claim_batches"
  ON public.gift_aid_claim_batches;
CREATE POLICY "service_role_all_gift_aid_claim_batches"
  ON public.gift_aid_claim_batches
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.gift_aid_claim_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lodge_id uuid NOT NULL REFERENCES public.lodges(id) ON DELETE CASCADE,
  claim_batch_id uuid NOT NULL REFERENCES public.gift_aid_claim_batches(id) ON DELETE CASCADE,
  donation_id uuid REFERENCES public.donations(id) ON DELETE SET NULL,
  gift_aid_declaration_id uuid REFERENCES public.gift_aid_declarations(id) ON DELETE SET NULL,
  donor_name text,
  donor_email text,
  donation_date date NOT NULL,
  source text NOT NULL,
  eligible_amount numeric(12, 2) NOT NULL DEFAULT 0,
  reclaimable_amount numeric(12, 2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gift_aid_claim_items_lodge
  ON public.gift_aid_claim_items(lodge_id);
CREATE INDEX IF NOT EXISTS idx_gift_aid_claim_items_batch
  ON public.gift_aid_claim_items(claim_batch_id);
CREATE INDEX IF NOT EXISTS idx_gift_aid_claim_items_donation
  ON public.gift_aid_claim_items(donation_id);

ALTER TABLE public.gift_aid_claim_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all_gift_aid_claim_items"
  ON public.gift_aid_claim_items;
CREATE POLICY "service_role_all_gift_aid_claim_items"
  ON public.gift_aid_claim_items
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'donations_gift_aid_claim_batch_fk'
      AND conrelid = 'public.donations'::regclass
  ) THEN
    ALTER TABLE public.donations
      ADD CONSTRAINT donations_gift_aid_claim_batch_fk
      FOREIGN KEY (gift_aid_claim_batch_id)
      REFERENCES public.gift_aid_claim_batches(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.meeting_collections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lodge_id uuid NOT NULL REFERENCES public.lodges(id) ON DELETE CASCADE,
  event_id uuid REFERENCES public.events(id) ON DELETE SET NULL,
  campaign_id uuid REFERENCES public.charity_campaigns(id) ON DELETE SET NULL,
  collection_date date NOT NULL DEFAULT current_date,
  collection_type text NOT NULL DEFAULT 'festive_board',
  title text NOT NULL DEFAULT 'Meeting collection',
  cash_amount numeric(12, 2) NOT NULL DEFAULT 0,
  card_amount numeric(12, 2) NOT NULL DEFAULT 0,
  donor_linked_amount numeric(12, 2) NOT NULL DEFAULT 0,
  anonymous_cash_amount numeric(12, 2) NOT NULL DEFAULT 0,
  gift_aid_reclaimable_amount numeric(12, 2) NOT NULL DEFAULT 0,
  gasds_eligible_amount numeric(12, 2) NOT NULL DEFAULT 0,
  gasds_tax_year text,
  notes text,
  recorded_by_email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_meeting_collections_lodge
  ON public.meeting_collections(lodge_id);
CREATE INDEX IF NOT EXISTS idx_meeting_collections_event
  ON public.meeting_collections(event_id);
CREATE INDEX IF NOT EXISTS idx_meeting_collections_campaign
  ON public.meeting_collections(campaign_id);
CREATE INDEX IF NOT EXISTS idx_meeting_collections_tax_year
  ON public.meeting_collections(gasds_tax_year);

ALTER TABLE public.meeting_collections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all_meeting_collections"
  ON public.meeting_collections;
CREATE POLICY "service_role_all_meeting_collections"
  ON public.meeting_collections
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.gasds_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lodge_id uuid NOT NULL REFERENCES public.lodges(id) ON DELETE CASCADE,
  tax_year text NOT NULL,
  eligible_cash_amount numeric(12, 2) NOT NULL DEFAULT 0,
  claimed_cash_amount numeric(12, 2) NOT NULL DEFAULT 0,
  reclaimable_amount numeric(12, 2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft',
  exported_at timestamptz,
  filed_at timestamptz,
  paid_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lodge_id, tax_year)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'gasds_claims_status_check'
      AND conrelid = 'public.gasds_claims'::regclass
  ) THEN
    ALTER TABLE public.gasds_claims
      ADD CONSTRAINT gasds_claims_status_check
      CHECK (status IN ('draft', 'exported', 'filed', 'paid'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_gasds_claims_lodge
  ON public.gasds_claims(lodge_id);
CREATE INDEX IF NOT EXISTS idx_gasds_claims_tax_year
  ON public.gasds_claims(tax_year);

ALTER TABLE public.gasds_claims ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all_gasds_claims"
  ON public.gasds_claims;
CREATE POLICY "service_role_all_gasds_claims"
  ON public.gasds_claims
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
