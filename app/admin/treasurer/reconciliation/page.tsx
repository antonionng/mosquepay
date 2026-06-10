import * as db from "@/lib/db";
import { getAdminReadContext } from "@/lib/admin/read-context";
import { ReconciliationClient } from "./reconciliation-client";
import { EmptyState } from "@/components/ui/empty-state";
import { Banknote } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function BankReconciliationPage() {
  const ctx = await getAdminReadContext();
  if (ctx.mode !== "database" || !ctx.churchId) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <div className="admin-page-head">
          <div>
            <h1 className="admin-page-title">Bank Reconciliation</h1>
            <p className="admin-page-copy">
              Import statements and match bank transactions to payments, giving, and donations.
            </p>
          </div>
        </div>
        <EmptyState
          icon={Banknote}
          title="Reconciliation needs a database"
          description="Connect Supabase and choose a church to import statements and reconcile bank lines."
        />
      </div>
    );
  }
  const churchId = ctx.churchId;

  const [imports, transactions, ledger] = await Promise.all([
    db.listBankImports(churchId),
    db.listBankTransactions(churchId),
    db.getTreasurerLedger(churchId),
  ]);

  return (
    <ReconciliationClient
      imports={JSON.parse(JSON.stringify(imports))}
      transactions={JSON.parse(JSON.stringify(transactions))}
      ledger={JSON.parse(JSON.stringify(ledger))}
    />
  );
}
