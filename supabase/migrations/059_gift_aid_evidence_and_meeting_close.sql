-- Migration 059: Gift Aid evidence backbone + per-meeting close workflow.
--
-- Builds on migrations 002 (gift_aid_declarations) and 031 (claim batches,
-- meeting_collections, GASDS) to make declarations audit-grade for HMRC and
-- to give treasurers a one-button "close meeting and send Gift Aid" flow.
--
-- Goals:
--   1. Treat paper and digital declarations as first-class peers, both
--      carrying tamper-evident evidence: hashed PDF/scan in private storage
--      plus an append-only event stream that no service role can mutate.
--   2. Let an admin (e.g. a treasurer holding wet-ink slips) attach paper
--      evidence to a declaration with chain-of-custody fields.
--   3. Wire Relief Chest delivery to per-meeting close: each meeting can
--      have its own claim batch with the meeting date as the period.
--
-- Compatible with the existing `revoked_at` flag (no hard deletes) and the
-- existing `retained_until` retention field added in 031.

-- ---------------------------------------------------------------------------
-- 1. Evidence columns on gift_aid_declarations
-- ---------------------------------------------------------------------------

ALTER TABLE public.gift_aid_declarations
  ADD COLUMN IF NOT EXISTS evidence_source text NOT NULL DEFAULT 'digital',
  ADD COLUMN IF NOT EXISTS evidence_storage_bucket text,
  ADD COLUMN IF NOT EXISTS evidence_storage_path text,
  ADD COLUMN IF NOT EXISTS evidence_sha256 text,
  ADD COLUMN IF NOT EXISTS evidence_size_bytes integer,
  ADD COLUMN IF NOT EXISTS evidence_mime_type text,
  ADD COLUMN IF NOT EXISTS evidence_uploaded_at timestamptz,
  ADD COLUMN IF NOT EXISTS evidence_uploaded_by_email text,
  ADD COLUMN IF NOT EXISTS paper_received_date date,
  ADD COLUMN IF NOT EXISTS paper_filing_reference text,
  ADD COLUMN IF NOT EXISTS digital_signature_ip inet,
  ADD COLUMN IF NOT EXISTS digital_signature_user_agent text,
  ADD COLUMN IF NOT EXISTS digital_declaration_text_snapshot text,
  ADD COLUMN IF NOT EXISTS member_id uuid REFERENCES public.members(id) ON DELETE SET NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'gift_aid_declarations_evidence_source_check'
      AND conrelid = 'public.gift_aid_declarations'::regclass
  ) THEN
    ALTER TABLE public.gift_aid_declarations
      ADD CONSTRAINT gift_aid_declarations_evidence_source_check
      CHECK (evidence_source IN ('digital', 'paper', 'verbal', 'import_legacy'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_gift_aid_declarations_member_id
  ON public.gift_aid_declarations(member_id);
CREATE INDEX IF NOT EXISTS idx_gift_aid_declarations_evidence_source
  ON public.gift_aid_declarations(lodge_id, evidence_source);

-- ---------------------------------------------------------------------------
-- 2. Append-only declaration event log
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.gift_aid_declaration_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lodge_id uuid NOT NULL REFERENCES public.lodges(id) ON DELETE CASCADE,
  declaration_id uuid NOT NULL REFERENCES public.gift_aid_declarations(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  actor_kind text NOT NULL,
  actor_email text,
  actor_ip inet,
  actor_user_agent text,
  before_state jsonb,
  after_state jsonb,
  evidence_sha256 text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'gift_aid_declaration_events_event_type_check'
      AND conrelid = 'public.gift_aid_declaration_events'::regclass
  ) THEN
    ALTER TABLE public.gift_aid_declaration_events
      ADD CONSTRAINT gift_aid_declaration_events_event_type_check
      CHECK (event_type IN (
        'created_digital',
        'created_paper',
        'evidence_uploaded',
        'evidence_replaced',
        'evidence_downloaded',
        'address_updated',
        'revoked',
        'reinstated',
        'imported',
        'printed_pdf'
      ));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'gift_aid_declaration_events_actor_kind_check'
      AND conrelid = 'public.gift_aid_declaration_events'::regclass
  ) THEN
    ALTER TABLE public.gift_aid_declaration_events
      ADD CONSTRAINT gift_aid_declaration_events_actor_kind_check
      CHECK (actor_kind IN ('member', 'admin', 'platform', 'system'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_gift_aid_declaration_events_declaration
  ON public.gift_aid_declaration_events(declaration_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gift_aid_declaration_events_lodge
  ON public.gift_aid_declaration_events(lodge_id, created_at DESC);

ALTER TABLE public.gift_aid_declaration_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all_gift_aid_declaration_events"
  ON public.gift_aid_declaration_events;
-- Insert + select only. No update or delete grants for service_role so the
-- audit trail cannot be silently rewritten. Schema owner (migrations) can
-- still change structure, which is correct.
CREATE POLICY "service_role_insert_gift_aid_declaration_events"
  ON public.gift_aid_declaration_events
  FOR INSERT
  TO service_role
  WITH CHECK (true);
CREATE POLICY "service_role_select_gift_aid_declaration_events"
  ON public.gift_aid_declaration_events
  FOR SELECT
  TO service_role
  USING (true);

REVOKE UPDATE, DELETE ON public.gift_aid_declaration_events FROM service_role;
REVOKE UPDATE, DELETE ON public.gift_aid_declaration_events FROM authenticated;
REVOKE UPDATE, DELETE ON public.gift_aid_declaration_events FROM anon;

-- A trigger as belt-and-braces in case a future migration accidentally
-- regrants UPDATE/DELETE. Forbidding the verbs at the row level means the
-- event log is append-only no matter which role holds the connection.
CREATE OR REPLACE FUNCTION public.forbid_gift_aid_declaration_event_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'gift_aid_declaration_events is append-only';
END;
$$;

DROP TRIGGER IF EXISTS forbid_gift_aid_declaration_event_update
  ON public.gift_aid_declaration_events;
CREATE TRIGGER forbid_gift_aid_declaration_event_update
  BEFORE UPDATE ON public.gift_aid_declaration_events
  FOR EACH ROW EXECUTE FUNCTION public.forbid_gift_aid_declaration_event_mutation();

DROP TRIGGER IF EXISTS forbid_gift_aid_declaration_event_delete
  ON public.gift_aid_declaration_events;
CREATE TRIGGER forbid_gift_aid_declaration_event_delete
  BEFORE DELETE ON public.gift_aid_declaration_events
  FOR EACH ROW EXECUTE FUNCTION public.forbid_gift_aid_declaration_event_mutation();

-- ---------------------------------------------------------------------------
-- 3. Lodge-level Gift Aid + Relief Chest configuration
-- ---------------------------------------------------------------------------

ALTER TABLE public.lodges
  ADD COLUMN IF NOT EXISTS gift_aid_default_mode text NOT NULL DEFAULT 'both',
  ADD COLUMN IF NOT EXISTS relief_chest_email text,
  ADD COLUMN IF NOT EXISTS relief_chest_charity_number text,
  ADD COLUMN IF NOT EXISTS hmrc_charity_reference text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'lodges_gift_aid_default_mode_check'
      AND conrelid = 'public.lodges'::regclass
  ) THEN
    ALTER TABLE public.lodges
      ADD CONSTRAINT lodges_gift_aid_default_mode_check
      CHECK (gift_aid_default_mode IN ('digital', 'paper', 'both'));
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 4. Member-level prompt bookkeeping (so the portal banner can dismiss)
-- ---------------------------------------------------------------------------

ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS gift_aid_prompted_at timestamptz,
  ADD COLUMN IF NOT EXISTS gift_aid_consent_status text NOT NULL DEFAULT 'unknown';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'members_gift_aid_consent_status_check'
      AND conrelid = 'public.members'::regclass
  ) THEN
    ALTER TABLE public.members
      ADD CONSTRAINT members_gift_aid_consent_status_check
      CHECK (gift_aid_consent_status IN ('unknown', 'declared', 'declined'));
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 5. Per-meeting close: tie meeting_collections + events to claim batches
-- ---------------------------------------------------------------------------

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS meeting_closed_at timestamptz,
  ADD COLUMN IF NOT EXISTS meeting_closed_by_email text,
  ADD COLUMN IF NOT EXISTS meeting_close_notes text;

ALTER TABLE public.meeting_collections
  ADD COLUMN IF NOT EXISTS gift_aid_claim_batch_id uuid
    REFERENCES public.gift_aid_claim_batches(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS relief_chest_delivered_at timestamptz,
  ADD COLUMN IF NOT EXISTS relief_chest_delivered_to text;

CREATE INDEX IF NOT EXISTS idx_meeting_collections_claim_batch
  ON public.meeting_collections(gift_aid_claim_batch_id);

-- ---------------------------------------------------------------------------
-- 6. Backfill: existing declarations are digital by default (matches the
--    historical donate-form flow which only ever produced digital records).
-- ---------------------------------------------------------------------------

UPDATE public.gift_aid_declarations
SET evidence_source = 'digital'
WHERE evidence_source IS NULL;
