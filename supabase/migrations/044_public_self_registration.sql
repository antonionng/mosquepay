-- Public self-registration for guests.
--
-- Lets a lodge expose a public URL (e.g. /visit/<lodge-slug>) where a
-- visiting brother or social guest can self-register without a per-event
-- invitation. The resulting guests row is identical to one created by the
-- existing per-event flow, except `source = 'self_register'` so the lodge
-- secretary can tell at a glance how each entry arrived in the directory.

-- ---------------------------------------------------------------------------
-- lodges.accepts_self_registration
--
-- Master switch. Off by default; the secretary must opt in from the admin
-- guests directory before the /visit/<slug> page is reachable.
-- ---------------------------------------------------------------------------
ALTER TABLE public.lodges
  ADD COLUMN IF NOT EXISTS accepts_self_registration boolean NOT NULL
    DEFAULT false;

COMMENT ON COLUMN public.lodges.accepts_self_registration IS
  'When true, the public /visit/<lodge_slug> page is reachable so anyone can self-register into the guest directory and book into open events.';

-- ---------------------------------------------------------------------------
-- guests.source
--
-- Tracks where the directory entry came from so admins can audit growth:
--   admin              -> created manually in admin UI
--   member_invite      -> created when a member generated an invite link
--   self_invite_event  -> created when somebody used a per-event invite link
--   self_register      -> created via the new public self-registration page
-- ---------------------------------------------------------------------------
ALTER TABLE public.guests
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'admin';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'guests'
      AND constraint_name = 'guests_source_check'
  ) THEN
    ALTER TABLE public.guests
      ADD CONSTRAINT guests_source_check
      CHECK (source IN (
        'admin',
        'member_invite',
        'self_invite_event',
        'self_register'
      ));
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- guests.email_confirmed_at
--
-- Reserved for a future email-confirm gate before a self-registered guest
-- may complete a paid booking. The column is added now so the application
-- layer can begin writing to it without a follow-up migration.
-- ---------------------------------------------------------------------------
ALTER TABLE public.guests
  ADD COLUMN IF NOT EXISTS email_confirmed_at timestamptz;

-- ---------------------------------------------------------------------------
-- event_guests.source: extend the enum to include 'self_register'
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_name text;
BEGIN
  SELECT cc.conname INTO v_name
  FROM pg_constraint cc
  JOIN pg_class c ON c.oid = cc.conrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname = 'event_guests'
    AND cc.contype = 'c'
    AND pg_get_constraintdef(cc.oid) ILIKE '%source%'
  LIMIT 1;

  IF v_name IS NOT NULL THEN
    EXECUTE format(
      'ALTER TABLE public.event_guests DROP CONSTRAINT %I',
      v_name
    );
  END IF;
END $$;

ALTER TABLE public.event_guests
  ADD CONSTRAINT event_guests_source_check
  CHECK (source IN (
    'member_party',
    'self_invite',
    'admin_added',
    'self_register'
  ));
