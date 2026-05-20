-- Adds the bits the full guest CRUD + invite-from-directory experience needs.
-- Idempotent so it's safe to re-run alongside 036_guest_invitations.sql.

-- ---------------------------------------------------------------------------
-- guest_invitations.guest_id
--
-- When an admin invites a guest who is already in the directory we want to
-- link the invitation back to that directory entry so we can show "invited 3
-- times, attended 2" stats and so the webhook does not have to redupe by
-- email/name a second time.
-- ---------------------------------------------------------------------------
ALTER TABLE public.guest_invitations
  ADD COLUMN IF NOT EXISTS guest_id uuid
    REFERENCES public.guests(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_guest_invitations_guest_id
  ON public.guest_invitations(guest_id)
  WHERE guest_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- guests.visitor_token_hash
--
-- A stable, unguessable per-guest token. The cleartext lives in the post-event
-- email and any direct invitation we send. When opened it powers /visitor/[token]
-- so a known guest can see their visit history, upcoming confirmed events, and
-- update their dietary without needing an account.
-- ---------------------------------------------------------------------------
ALTER TABLE public.guests
  ADD COLUMN IF NOT EXISTS visitor_token_hash text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_guests_visitor_token_hash
  ON public.guests(visitor_token_hash)
  WHERE visitor_token_hash IS NOT NULL;

COMMENT ON COLUMN public.guests.visitor_token_hash IS
  'sha256 hash of the per-guest visitor portal token. The cleartext is only ever stored in outbound emails.';
