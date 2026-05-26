-- 054_drop_member_public_photo
--
-- Drop the `members.public_photo_url` column added in 053. The public
-- Officers section deliberately does not show headshots; we only render
-- rung, name, rank, and bio. Removing the column keeps the schema
-- honest about what the product surfaces.

alter table public.members
  drop column if exists public_photo_url;
