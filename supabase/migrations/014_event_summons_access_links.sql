CREATE TABLE IF NOT EXISTS public.event_summons_access_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lodge_id uuid NOT NULL REFERENCES public.lodges(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  summons_id uuid REFERENCES public.event_summons(id) ON DELETE SET NULL,
  send_id uuid REFERENCES public.event_summons_sends(id) ON DELETE SET NULL,
  recipient_email text NOT NULL,
  recipient_name text,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz,
  accessed_at timestamptz,
  access_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.event_summons_access_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role all event_summons_access_links"
  ON public.event_summons_access_links
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_event_summons_access_links_lodge_id
  ON public.event_summons_access_links(lodge_id);

CREATE INDEX IF NOT EXISTS idx_event_summons_access_links_event_id
  ON public.event_summons_access_links(event_id);

CREATE INDEX IF NOT EXISTS idx_event_summons_access_links_send_id
  ON public.event_summons_access_links(send_id);

CREATE INDEX IF NOT EXISTS idx_event_summons_access_links_summons_id
  ON public.event_summons_access_links(summons_id);
