-- Restrict broad "full access" policies to the service role.
-- Public writes should go through Next.js API routes, not direct anon table access.

DROP POLICY IF EXISTS "Service role full access" ON public.charity_campaigns;
CREATE POLICY "Service role all charity_campaigns"
  ON public.charity_campaigns
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access" ON public.lodge_dues;
CREATE POLICY "Service role all lodge_dues"
  ON public.lodge_dues
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access" ON public.member_dues;
CREATE POLICY "Service role all member_dues"
  ON public.member_dues
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access" ON public.members;
CREATE POLICY "Service role all members"
  ON public.members
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon insert rsvps" ON public.rsvps;
