CREATE TABLE IF NOT EXISTS public.event_summons_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lodge_id uuid NOT NULL REFERENCES public.lodges(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  summons_id uuid REFERENCES public.event_summons(id) ON DELETE SET NULL,
  sent_by text,
  recipient_count integer NOT NULL DEFAULT 0,
  sent_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  failures jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.event_summons_sends ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role all event_summons_sends"
  ON public.event_summons_sends
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_event_summons_sends_lodge_id
  ON public.event_summons_sends(lodge_id);

CREATE INDEX IF NOT EXISTS idx_event_summons_sends_event_id
  ON public.event_summons_sends(event_id);

CREATE INDEX IF NOT EXISTS idx_event_summons_sends_created_at
  ON public.event_summons_sends(created_at DESC);
