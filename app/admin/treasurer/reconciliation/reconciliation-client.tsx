"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowDownToLine,
  CheckCircle2,
  CircleHelp,
  EyeOff,
  Link as LinkIcon,
  Loader2,
  Search,
  Unlink,
  Upload,
} from "lucide-react";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type BankImport = {
  id: string;
  filename: string;
  account_label: string | null;
  total_rows: number;
  matched_rows: number;
  created_at: string;
};

type BankTransaction = {
  id: string;
  import_id: string;
  posted_date: string;
  description: string;
  amount: number;
  direction: "credit" | "debit";
  balance: number | null;
  reference: string | null;
  status: "unmatched" | "matched" | "ignored";
  matched_source_type: string | null;
  matched_source_id: string | null;
  matched_confidence: number | null;
};

type LedgerEntry = {
  source_id: string;
  source_type: "payment" | "dues" | "donation";
  occurred_at: string;
  contact_email: string | null;
  contact_name: string | null;
  amount: number;
  status: string;
  category: string;
};

export function ReconciliationClient({
  imports,
  transactions,
  ledger,
}: {
  imports: BankImport[];
  transactions: BankTransaction[];
  ledger: LedgerEntry[];
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [accountLabel, setAccountLabel] = useState("");
  const [search, setSearch] = useState("");
  const [selectedTx, setSelectedTx] = useState<BankTransaction | null>(null);

  const totals = useMemo(() => {
    const matched = transactions.filter((t) => t.status === "matched");
    const unmatched = transactions.filter((t) => t.status === "unmatched");
    const ignored = transactions.filter((t) => t.status === "ignored");
    return {
      matched: matched.length,
      unmatched: unmatched.length,
      ignored: ignored.length,
      matchedAmount: matched
        .filter((t) => t.direction === "credit")
        .reduce((sum, t) => sum + Number(t.amount), 0),
      unmatchedAmount: unmatched
        .filter((t) => t.direction === "credit")
        .reduce((sum, t) => sum + Number(t.amount), 0),
    };
  }, [transactions]);

  async function handleFile(file: File) {
    setBusy(true);
    setFeedback(null);
    try {
      const text = await file.text();
      const res = await fetch("/api/bank/imports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          csv: text,
          filename: file.name,
          account_label: accountLabel || null,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Import failed.");
      setFeedback(
        `Imported ${body.total_rows} transactions, auto-matched ${body.matched_rows}.`
      );
      router.refresh();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Import failed.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function actOnTx(
    id: string,
    action: "match" | "unmatch" | "ignore",
    payload: Record<string, unknown> = {}
  ) {
    setBusy(true);
    try {
      const res = await fetch(`/api/bank/transactions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...payload }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? "Action failed.");
      }
      setSelectedTx(null);
      router.refresh();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Action failed.");
    } finally {
      setBusy(false);
    }
  }

  const filteredTx = transactions.filter((t) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      t.description.toLowerCase().includes(q) ||
      (t.reference ?? "").toLowerCase().includes(q) ||
      String(t.amount).includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          Bank reconciliation
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Upload a CSV from any UK bank. We auto-match credits against your
          treasurer ledger and surface anything unmatched for review.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Kpi
          label="Matched"
          value={`${totals.matched} · £${totals.matchedAmount.toFixed(2)}`}
          color="emerald"
          icon={CheckCircle2}
        />
        <Kpi
          label="Unmatched credits"
          value={`${transactions.filter((t) => t.status === "unmatched" && t.direction === "credit").length} · £${totals.unmatchedAmount.toFixed(2)}`}
          color={totals.unmatchedAmount > 0 ? "amber" : "slate"}
          icon={AlertCircle}
        />
        <Kpi
          label="Ignored"
          value={String(totals.ignored)}
          color="slate"
          icon={EyeOff}
        />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFile(file);
            }}
            className="hidden"
          />
          <input
            type="text"
            value={accountLabel}
            onChange={(e) => setAccountLabel(e.target.value)}
            placeholder="Account label (e.g. Lodge Current Account)"
            className="h-10 flex-1 min-w-[240px] rounded-xl border border-slate-200 bg-white px-3 text-sm"
          />
          <Button onClick={() => fileRef.current?.click()} disabled={busy}>
            {busy ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-2 h-4 w-4" />
            )}
            Import statement CSV
          </Button>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Supports common UK bank exports (Barclays, HSBC, Lloyds, NatWest,
          Santander, Monzo, Starling, Revolut, Tide, and generic exports).
        </p>
        {feedback && (
          <p className="mt-3 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-900">
            {feedback}
          </p>
        )}
      </div>

      <Tabs defaultValue="transactions">
        <TabsList>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="imports">Imports</TabsTrigger>
        </TabsList>

        <TabsContent value="transactions" className="space-y-3">
          <div className="relative max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search description, reference, amount"
              className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm"
            />
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-32" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTx.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-sm text-slate-500">
                      No transactions imported yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTx.slice(0, 200).map((tx) => (
                    <TableRow key={tx.id}>
                      <TableCell className="whitespace-nowrap text-sm">
                        {new Date(tx.posted_date).toLocaleDateString("en-GB")}
                      </TableCell>
                      <TableCell>
                        <p className="font-medium text-slate-900">
                          {tx.description}
                        </p>
                        {tx.reference && (
                          <p className="text-xs text-slate-500">
                            ref: {tx.reference}
                          </p>
                        )}
                      </TableCell>
                      <TableCell
                        className={`text-right font-semibold tabular-nums ${
                          tx.direction === "credit"
                            ? "text-emerald-700"
                            : "text-slate-700"
                        }`}
                      >
                        {tx.direction === "credit" ? "+" : "−"}£{Number(tx.amount).toFixed(2)}
                      </TableCell>
                      <TableCell>
                        {tx.status === "matched" ? (
                          <Badge variant="success">
                            Matched
                            {tx.matched_confidence != null && (
                              <span className="ml-1 text-[10px] opacity-75">
                                {Math.round((tx.matched_confidence ?? 0) * 100)}%
                              </span>
                            )}
                          </Badge>
                        ) : tx.status === "ignored" ? (
                          <Badge variant="secondary">Ignored</Badge>
                        ) : (
                          <Badge variant="warning">Unmatched</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          {tx.status !== "matched" && tx.direction === "credit" && (
                            <Button
                              size="icon-sm"
                              variant="ghost"
                              onClick={() => setSelectedTx(tx)}
                              title="Match"
                            >
                              <LinkIcon className="h-4 w-4 text-emerald-600" />
                            </Button>
                          )}
                          {tx.status === "matched" && (
                            <Button
                              size="icon-sm"
                              variant="ghost"
                              onClick={() => actOnTx(tx.id, "unmatch")}
                              title="Unmatch"
                            >
                              <Unlink className="h-4 w-4 text-amber-600" />
                            </Button>
                          )}
                          {tx.status !== "ignored" && (
                            <Button
                              size="icon-sm"
                              variant="ghost"
                              onClick={() => actOnTx(tx.id, "ignore")}
                              title="Ignore"
                            >
                              <EyeOff className="h-4 w-4 text-slate-400" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="imports">
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Imported</TableHead>
                  <TableHead>File</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead className="text-right">Rows</TableHead>
                  <TableHead className="text-right">Matched</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {imports.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-sm text-slate-500">
                      No statements imported yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  imports.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="whitespace-nowrap text-sm text-slate-600">
                        {new Date(row.created_at).toLocaleDateString("en-GB")}
                      </TableCell>
                      <TableCell className="text-sm text-slate-900">
                        {row.filename}
                      </TableCell>
                      <TableCell className="text-sm text-slate-500">
                        {row.account_label ?? "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.total_rows}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.matched_rows} / {row.total_rows}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      {selectedTx && (
        <MatchDialog
          tx={selectedTx}
          ledger={ledger}
          onClose={() => setSelectedTx(null)}
          onMatch={(payload) => actOnTx(selectedTx.id, "match", payload)}
        />
      )}
    </div>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  color: "emerald" | "amber" | "slate";
}) {
  const colors = {
    emerald: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600",
    slate: "bg-slate-100 text-slate-600",
  };
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${colors[color]}`}>
        <Icon className="h-4 w-4" />
      </div>
      <p className="mt-3 text-lg font-semibold text-slate-900">{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}

function MatchDialog({
  tx,
  ledger,
  onClose,
  onMatch,
}: {
  tx: BankTransaction;
  ledger: LedgerEntry[];
  onClose: () => void;
  onMatch: (payload: Record<string, unknown>) => void;
}) {
  const [search, setSearch] = useState("");

  const candidates = useMemo(() => {
    const txDate = new Date(tx.posted_date).getTime();
    return ledger
      .filter((entry) => {
        if (Math.abs(Number(entry.amount) - tx.amount) > 0.01) return false;
        const entryDate = new Date(entry.occurred_at).getTime();
        return Math.abs(txDate - entryDate) / (1000 * 60 * 60 * 24) <= 60;
      })
      .filter((entry) => {
        if (!search) return true;
        const q = search.toLowerCase();
        return (
          (entry.contact_name ?? "").toLowerCase().includes(q) ||
          (entry.contact_email ?? "").toLowerCase().includes(q)
        );
      })
      .slice(0, 25);
  }, [ledger, search, tx]);

  return (
    <div className="admin-modal-backdrop">
      <div className="admin-modal-panel-md p-0 sm:p-0">
        <div className="border-b border-slate-200 p-5">
          <h3 className="text-base font-semibold text-slate-900">
            Match transaction
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            {tx.description} · £{Number(tx.amount).toFixed(2)} on{" "}
            {new Date(tx.posted_date).toLocaleDateString("en-GB")}
          </p>
        </div>
        <div className="space-y-3 p-5">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search ledger entries by name or email"
            className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm"
          />
          <div className="max-h-72 space-y-2 overflow-y-auto">
            {candidates.length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-200 p-4 text-center text-xs text-slate-500">
                <CircleHelp className="mx-auto mb-2 h-4 w-4 text-slate-400" />
                No ledger entries match this amount and date window. Use the
                manual option below to flag this transaction as accounted for
                without linking to a record.
              </p>
            ) : (
              candidates.map((entry) => (
                <button
                  key={`${entry.source_type}-${entry.source_id}`}
                  type="button"
                  onClick={() =>
                    onMatch({
                      source_type: entry.source_type,
                      source_id: entry.source_id,
                    })
                  }
                  className="flex w-full items-start gap-3 rounded-xl border border-slate-200 p-3 text-left hover:border-emerald-200 hover:bg-emerald-50"
                >
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-900">
                      {entry.contact_name ?? entry.contact_email ?? "Unknown"}
                    </p>
                    <p className="text-xs text-slate-500">
                      {entry.source_type} · {entry.category} ·{" "}
                      {new Date(entry.occurred_at).toLocaleDateString("en-GB")}
                    </p>
                  </div>
                  <span className="text-sm font-semibold tabular-nums text-emerald-700">
                    £{Number(entry.amount).toFixed(2)}
                  </span>
                </button>
              ))
            )}
          </div>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => onMatch({ source_type: "manual" })}
          >
            <ArrowDownToLine className="mr-2 h-4 w-4" /> Flag as accounted for (no link)
          </Button>
        </div>
        <div className="border-t border-slate-200 p-4 text-right">
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
