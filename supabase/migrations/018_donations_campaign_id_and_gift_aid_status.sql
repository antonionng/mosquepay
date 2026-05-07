-- Link donations to a charity campaign and capture donor gift-aid intent at point of donation.

ALTER TABLE public.donations
  ADD COLUMN IF NOT EXISTS campaign_id uuid REFERENCES public.charity_campaigns(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS gift_aid_status text NOT NULL DEFAULT 'unknown'
    CHECK (gift_aid_status IN ('unknown', 'eligible', 'declared', 'declined'));

CREATE INDEX IF NOT EXISTS idx_donations_campaign_id
  ON public.donations(campaign_id);

CREATE INDEX IF NOT EXISTS idx_donations_event_id
  ON public.donations(event_id);
