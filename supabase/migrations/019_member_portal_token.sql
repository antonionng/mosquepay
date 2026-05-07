-- Per-member opaque token used for personal calendar feeds and digital
-- membership card verification URLs. Backfilled to a random UUID for any
-- existing members.

ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS portal_token uuid NOT NULL DEFAULT gen_random_uuid();

CREATE UNIQUE INDEX IF NOT EXISTS idx_members_portal_token
  ON public.members(portal_token);
