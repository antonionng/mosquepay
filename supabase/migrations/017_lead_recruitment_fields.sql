-- Lead recruitment governance fields and conversion tracking.
-- Adds fields for proposer/seconder, next step, ballot/proposal dates,
-- consent, candidate notes, and links to converted member.

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS proposer_member_id uuid REFERENCES public.members(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS proposer_name text,
  ADD COLUMN IF NOT EXISTS seconder_member_id uuid REFERENCES public.members(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS seconder_name text,
  ADD COLUMN IF NOT EXISTS next_step text,
  ADD COLUMN IF NOT EXISTS next_step_due_date date,
  ADD COLUMN IF NOT EXISTS proposal_date date,
  ADD COLUMN IF NOT EXISTS ballot_date date,
  ADD COLUMN IF NOT EXISTS interview_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS consent_given_at timestamptz,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS converted_member_id uuid REFERENCES public.members(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS converted_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_leads_proposer_member_id
  ON public.leads(proposer_member_id);

CREATE INDEX IF NOT EXISTS idx_leads_seconder_member_id
  ON public.leads(seconder_member_id);

CREATE INDEX IF NOT EXISTS idx_leads_converted_member_id
  ON public.leads(converted_member_id);

CREATE INDEX IF NOT EXISTS idx_leads_next_step_due_date
  ON public.leads(next_step_due_date)
  WHERE next_step_due_date IS NOT NULL;
