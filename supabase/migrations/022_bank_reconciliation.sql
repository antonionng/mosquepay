-- CSV bank reconciliation: imports + parsed transactions with manual or
-- automatic matches against entries in the treasurer ledger.

CREATE TABLE IF NOT EXISTS public.bank_statement_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lodge_id uuid NOT NULL REFERENCES public.lodges(id) ON DELETE CASCADE,
  filename text NOT NULL,
  account_label text,
  total_rows integer NOT NULL DEFAULT 0,
  matched_rows integer NOT NULL DEFAULT 0,
  imported_by_admin_user_id uuid REFERENCES public.admin_users(id),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bank_statement_imports_lodge
  ON public.bank_statement_imports(lodge_id);

ALTER TABLE public.bank_statement_imports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role bank statement imports"
  ON public.bank_statement_imports;
CREATE POLICY "Service role bank statement imports"
  ON public.bank_statement_imports FOR ALL
  TO service_role USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.bank_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lodge_id uuid NOT NULL REFERENCES public.lodges(id) ON DELETE CASCADE,
  import_id uuid NOT NULL REFERENCES public.bank_statement_imports(id) ON DELETE CASCADE,
  posted_date date NOT NULL,
  description text NOT NULL,
  amount numeric(12, 2) NOT NULL,
  direction text NOT NULL CHECK (direction IN ('credit', 'debit')),
  balance numeric(12, 2),
  reference text,
  status text NOT NULL DEFAULT 'unmatched'
    CHECK (status IN ('unmatched', 'matched', 'ignored')),
  matched_source_type text
    CHECK (matched_source_type IN ('payment', 'dues', 'donation', 'manual')),
  matched_source_id uuid,
  matched_confidence numeric(3, 2),
  matched_by_admin_user_id uuid REFERENCES public.admin_users(id),
  matched_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bank_transactions_lodge
  ON public.bank_transactions(lodge_id);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_status
  ON public.bank_transactions(status);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_posted_date
  ON public.bank_transactions(posted_date);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_match
  ON public.bank_transactions(matched_source_type, matched_source_id);

ALTER TABLE public.bank_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role bank transactions"
  ON public.bank_transactions;
CREATE POLICY "Service role bank transactions"
  ON public.bank_transactions FOR ALL
  TO service_role USING (true) WITH CHECK (true);
