-- Guest invitations and the lodge guest directory.
--
-- A guest_invitation is a tokenised, shareable link that lets a non-member
-- (typically a visiting brother or a partner/social guest) RSVP and pay for
-- a specific event without needing a portal account. The link is unguessable
-- (sha256 hashed token, mirror of event_summons_access_links) and may have
-- limited uses or an expiry, but defaults to unlimited / no expiry.
--
-- The guests table is a per-lodge directory of people who have ever
-- registered as a guest, deduped on (lodge_id, lower(email)) when an email
-- is present, otherwise by name + mother lodge. This gives the secretary a
-- proper visit history rather than disconnected per-event rows.
--
-- event_guests gains a few columns so a row can be linked back to both the
-- directory entry and the invitation that produced it; the existing per-RSVP
-- behaviour (member-invited party) is preserved.

-- ---------------------------------------------------------------------------
-- events.guest_policy
-- ---------------------------------------------------------------------------
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS guest_policy text NOT NULL DEFAULT 'closed'
    CHECK (guest_policy IN ('blue_table', 'white_table', 'closed'));

COMMENT ON COLUMN public.events.guest_policy IS
  'Who may attend via a guest link: blue_table (Masons only), white_table (open to anyone with the link), closed (no guest links generated).';

-- ---------------------------------------------------------------------------
-- guests directory
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.guests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lodge_id uuid NOT NULL REFERENCES public.lodges(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  email text,
  phone text,
  mother_lodge_name text,
  mother_lodge_number text,
  constitution text,
  rank text,
  dietary_requirements text,
  is_mason boolean NOT NULL DEFAULT true,
  first_seen_event_id uuid REFERENCES public.events(id) ON DELETE SET NULL,
  last_seen_event_id uuid REFERENCES public.events(id) ON DELETE SET NULL,
  visit_count integer NOT NULL DEFAULT 0,
  notes text,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_guests_lodge ON public.guests(lodge_id);
CREATE INDEX IF NOT EXISTS idx_guests_lodge_email
  ON public.guests(lodge_id, lower(email))
  WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_guests_lodge_name
  ON public.guests(lodge_id, lower(full_name));

ALTER TABLE public.guests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role all guests" ON public.guests;
CREATE POLICY "Service role all guests"
  ON public.guests
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- guest_invitations
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.guest_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lodge_id uuid NOT NULL REFERENCES public.lodges(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  inviter_member_id uuid REFERENCES public.members(id) ON DELETE SET NULL,
  inviter_admin_user_id uuid REFERENCES public.admin_users(id) ON DELETE SET NULL,
  recipient_email text,
  recipient_name text,
  token_hash text NOT NULL UNIQUE,
  payer text NOT NULL DEFAULT 'guest'
    CHECK (payer IN ('guest', 'inviter')),
  max_uses integer,
  uses integer NOT NULL DEFAULT 0,
  expires_at timestamptz,
  revoked_at timestamptz,
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON COLUMN public.guest_invitations.inviter_member_id IS
  'Set when a member generated the link from the member portal. NULL for admin-generated, self-sharable links.';
COMMENT ON COLUMN public.guest_invitations.payer IS
  'guest: the person using the link pays at /g/<token>. inviter: the inviting member already paid (or no charge).';
COMMENT ON COLUMN public.guest_invitations.max_uses IS
  'NULL means unlimited. Otherwise the link refuses access once uses >= max_uses.';
COMMENT ON COLUMN public.guest_invitations.expires_at IS
  'NULL means no expiry. Otherwise the link refuses access after this timestamp.';

CREATE INDEX IF NOT EXISTS idx_guest_invitations_lodge
  ON public.guest_invitations(lodge_id);
CREATE INDEX IF NOT EXISTS idx_guest_invitations_event
  ON public.guest_invitations(event_id);
CREATE INDEX IF NOT EXISTS idx_guest_invitations_inviter
  ON public.guest_invitations(inviter_member_id)
  WHERE inviter_member_id IS NOT NULL;

ALTER TABLE public.guest_invitations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role all guest_invitations"
  ON public.guest_invitations;
CREATE POLICY "Service role all guest_invitations"
  ON public.guest_invitations
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- event_guests additions
-- ---------------------------------------------------------------------------
ALTER TABLE public.event_guests
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS guest_id uuid
    REFERENCES public.guests(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS guest_invitation_id uuid
    REFERENCES public.guest_invitations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'member_party'
    CHECK (source IN ('member_party', 'self_invite', 'admin_added')),
  ADD COLUMN IF NOT EXISTS welcome_email_sent_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_event_guests_guest_id
  ON public.event_guests(guest_id)
  WHERE guest_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_event_guests_invitation_id
  ON public.event_guests(guest_invitation_id)
  WHERE guest_invitation_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- rsvps.post_event_email_sent_at
-- ---------------------------------------------------------------------------
ALTER TABLE public.rsvps
  ADD COLUMN IF NOT EXISTS post_event_email_sent_at timestamptz;
