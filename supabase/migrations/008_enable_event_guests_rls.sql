ALTER TABLE public.event_guests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role all event_guests"
  ON public.event_guests
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
