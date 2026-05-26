-- 051_lodges_current_charity_campaign.sql
--
-- Adds public.lodges.current_charity_campaign_id so each lodge can nominate
-- the campaign that the standing-QR "scan and give" stickers + member-portal
-- "tap to donate" card should default to. The Almoner / Charity Steward
-- changes this once a year ("this year we're collecting for the Cornwall
-- Air Ambulance"); the dynamic resolver at /give/<slug>/charity then
-- resolves the no-context donation to that campaign without needing the
-- Treasurer to type a campaign id at the desk.
--
-- We deliberately do NOT enforce campaign.lodge_id = lodge.id at the FK
-- level: ON DELETE SET NULL handles the orphan case cleanly and validating
-- the cross-lodge constraint is the application layer's job (catching it
-- here would require either a check trigger or a composite FK that the
-- charity_campaigns table doesn't currently expose).

alter table public.lodges
  add column if not exists current_charity_campaign_id uuid
    references public.charity_campaigns(id) on delete set null;

comment on column public.lodges.current_charity_campaign_id is
  'Optional FK to the campaign that generic donations / standing-QR scans'
  ' should default to when no explicit campaign id is supplied. Set + cleared'
  ' by the Charity Steward / Almoner from /admin/charity. NULL means the'
  ' lodge has no designated current campaign and the donor will be asked to'
  ' pick one (or the donation lands as a general charity contribution).';

-- Index supports the resolver lookup at /give/<slug>/charity which joins
-- lodges -> charity_campaigns by this id. Keep partial so we don't pay the
-- index-write cost on rows that never set this (the common case).
create index if not exists lodges_current_charity_campaign_id_idx
  on public.lodges (current_charity_campaign_id)
  where current_charity_campaign_id is not null;
