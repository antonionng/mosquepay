CREATE INDEX IF NOT EXISTS idx_blog_posts_author_id
  ON public.blog_posts(author_id);

CREATE INDEX IF NOT EXISTS idx_charity_campaigns_lodge_id
  ON public.charity_campaigns(lodge_id);

CREATE INDEX IF NOT EXISTS idx_content_pages_updated_by
  ON public.content_pages(updated_by);

CREATE INDEX IF NOT EXISTS idx_donations_gift_aid_declaration_id
  ON public.donations(gift_aid_declaration_id);

CREATE INDEX IF NOT EXISTS idx_event_guests_lodge_id
  ON public.event_guests(lodge_id);

CREATE INDEX IF NOT EXISTS idx_events_created_by
  ON public.events(created_by);

CREATE INDEX IF NOT EXISTS idx_lead_activities_created_by
  ON public.lead_activities(created_by);

CREATE INDEX IF NOT EXISTS idx_lodge_dues_lodge_id
  ON public.lodge_dues(lodge_id);

CREATE INDEX IF NOT EXISTS idx_member_dues_dues_id
  ON public.member_dues(dues_id);

CREATE INDEX IF NOT EXISTS idx_member_dues_lodge_id
  ON public.member_dues(lodge_id);

CREATE INDEX IF NOT EXISTS idx_member_dues_member_id
  ON public.member_dues(member_id);

CREATE INDEX IF NOT EXISTS idx_member_dues_payment_id
  ON public.member_dues(payment_id);

CREATE INDEX IF NOT EXISTS idx_rsvps_payment_id
  ON public.rsvps(payment_id);
