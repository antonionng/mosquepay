-- Migration 060: bundle new declarations into every Gift Aid claim pack.
--
-- Background: when LP sends a per-meeting (or per-period) claim batch to
-- the Relief Chest at UGLE, the Chest currently receives the donations CSV
-- but no copies of the underlying declarations. UGLE has asked for those
-- declarations to be included so the Chest's central records stay
-- complete.
--
-- This migration introduces a permanent linkage between claim batches and
-- the declarations bundled into each pack. Linkage is created at batch
-- creation time (per-meeting close or period close) and never mutated:
-- if a declaration is later revoked, the linkage row stays so the
-- pack-as-sent can always be reconstructed for audit.
--
-- One declaration can appear in multiple batches over time (e.g. its
-- evidence was re-sent because the previous pack went missing); we don't
-- forbid duplicates at the schema level so future operational re-sends
-- are possible without a workaround.

CREATE TABLE IF NOT EXISTS public.gift_aid_claim_declarations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lodge_id uuid NOT NULL REFERENCES public.lodges(id) ON DELETE CASCADE,
  claim_batch_id uuid NOT NULL REFERENCES public.gift_aid_claim_batches(id) ON DELETE CASCADE,
  gift_aid_declaration_id uuid NOT NULL REFERENCES public.gift_aid_declarations(id) ON DELETE CASCADE,
  /**
   * Why this declaration is in this pack. `new_in_window` means the
   * declaration was created since the previous batch and is being sent
   * for the first time. `donor_in_batch` means it backs a donation
   * that is itself in this batch (a useful belt-and-braces inclusion).
   * `manual` is reserved for treasurer-driven re-sends.
   */
  inclusion_reason text NOT NULL DEFAULT 'new_in_window',
  created_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'gift_aid_claim_declarations_inclusion_reason_check'
      AND conrelid = 'public.gift_aid_claim_declarations'::regclass
  ) THEN
    ALTER TABLE public.gift_aid_claim_declarations
      ADD CONSTRAINT gift_aid_claim_declarations_inclusion_reason_check
      CHECK (inclusion_reason IN ('new_in_window', 'donor_in_batch', 'manual'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_gift_aid_claim_declarations_batch
  ON public.gift_aid_claim_declarations(claim_batch_id);
CREATE INDEX IF NOT EXISTS idx_gift_aid_claim_declarations_decl
  ON public.gift_aid_claim_declarations(gift_aid_declaration_id);
CREATE INDEX IF NOT EXISTS idx_gift_aid_claim_declarations_lodge
  ON public.gift_aid_claim_declarations(lodge_id, created_at DESC);

-- Avoid the same declaration being attached to the same batch twice for
-- the same reason. A treasurer can still re-send by inserting with
-- inclusion_reason='manual'.
CREATE UNIQUE INDEX IF NOT EXISTS uq_gift_aid_claim_declarations_batch_decl_reason
  ON public.gift_aid_claim_declarations(claim_batch_id, gift_aid_declaration_id, inclusion_reason);

-- Denormalised count on the batch row so list views can show "X new
-- declarations" without a join.
ALTER TABLE public.gift_aid_claim_batches
  ADD COLUMN IF NOT EXISTS declarations_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pack_generated_at timestamptz,
  ADD COLUMN IF NOT EXISTS pack_generated_by_email text;
