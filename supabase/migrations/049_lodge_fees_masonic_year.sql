-- Lodge fee defaults, per-person overrides, guest categories, masonic year.

CREATE TABLE IF NOT EXISTS public.lodge_fee_defaults (
  lodge_id uuid PRIMARY KEY REFERENCES public.lodges(id) ON DELETE CASCADE,
  default_member_levy_amount numeric(10, 2),
  default_member_dining_amount numeric(10, 2),
  default_guest_dining_amount numeric(10, 2),
  currency text NOT NULL DEFAULT 'gbp',
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.lodge_fee_defaults ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role all lodge fee defaults" ON public.lodge_fee_defaults;
CREATE POLICY "Service role all lodge fee defaults"
  ON public.lodge_fee_defaults FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS member_levy_amount numeric(10, 2),
  ADD COLUMN IF NOT EXISTS member_dining_amount numeric(10, 2),
  ADD COLUMN IF NOT EXISTS levy_waived boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS dining_waived boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS fee_use_custom boolean NOT NULL DEFAULT false;

ALTER TABLE public.guests
  ADD COLUMN IF NOT EXISTS guest_category text NOT NULL DEFAULT 'guest'
    CHECK (guest_category IN ('guest', 'honorary_guest')),
  ADD COLUMN IF NOT EXISTS guest_dining_amount numeric(10, 2),
  ADD COLUMN IF NOT EXISTS dining_waived boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.lodge_masonic_years (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lodge_id uuid NOT NULL REFERENCES public.lodges(id) ON DELETE CASCADE,
  label text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  annual_dues_amount numeric(10, 2),
  is_current boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_date > start_date)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_lodge_masonic_years_one_current
  ON public.lodge_masonic_years(lodge_id)
  WHERE is_current = true;

CREATE INDEX IF NOT EXISTS idx_lodge_masonic_years_lodge
  ON public.lodge_masonic_years(lodge_id);

ALTER TABLE public.lodge_masonic_years ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role all lodge masonic years" ON public.lodge_masonic_years;
CREATE POLICY "Service role all lodge masonic years"
  ON public.lodge_masonic_years FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

ALTER TABLE public.member_dues
  ADD COLUMN IF NOT EXISTS is_pro_rata boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS full_year_amount numeric(10, 2);

ALTER TABLE public.event_summons
  ADD COLUMN IF NOT EXISTS include_honorary_guests boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS recipient_snapshot jsonb;
