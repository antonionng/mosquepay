"use client";

import { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowDownToLine,
  Banknote,
  CheckCircle2,
  ChevronRight,
  FileSpreadsheet,
  Loader2,
  Mail,
  PlayCircle,
  Repeat,
  Wallet,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MembershipFeesSettings } from "@/components/admin/membership-fees-settings";
import { LodgeFeeDefaultsSettings } from "@/components/admin/lodge-fee-defaults-settings";
import { MasonicYearSettings } from "@/components/admin/masonic-year-settings";
import { NextDuesPanel } from "@/components/admin/next-dues-panel";
import { cn } from "@/lib/utils";

type LedgerEntry = {
  source_id: string;
  source_type: "payment" | "dues" | "donation";
  occurred_at: string;
  contact_email: string | null;
  contact_name: string | null;
  amount: number;
  refund_amount: number;
  currency: string;
  status: string;
  category: string;
  metadata: Record<string, unknown>;
};

type LodgeDues = {
  id: string;
  name: string;
  amount: number;
  currency: string;
  billing_period: string;
  active: boolean;
  allow_instalments: boolean;
  instalment_count: number | null;
  instalment_frequency: string | null;
};

type Instalment = {
  id: string;
  member_dues_id: string;
  sequence: number;
  due_date: string;
  amount: number;
  status: string;
};

const sourceColors: Record<string, "success" | "warning" | "secondary"> = {
  payment: "success",
  dues: "warning",
  donation: "secondary",
};

function ledgerHref(sourceType: string, sourceId: string): string | null {
  if (sourceType === "payment") return `/admin/payments/${sourceId}`;
  if (sourceType === "donation") return `/admin/donations/${sourceId}`;
  if (sourceType === "dues") return `/admin/payments?dues=${sourceId}`;
  return null;
}

function downloadCsv(filename: string, rows: Array<Record<string, unknown>>) {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(
      headers
        .map((h) => {
          const value = row[h];
          if (value == null) return "";
          const s = String(value).replaceAll('"', '""');
          return /[",\n]/.test(s) ? `"${s}"` : s;
        })
        .join(",")
    );
  }
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

type ScheduleCounts = {
  pending: number;
  active: number;
  action_required: number;
  past_due: number;
  paused: number;
  cancelled: number;
  completed: number;
  active_stripe: number;
};

export function TreasurerClient({
  ledger,
  lodgeDues,
  activeMembers,
  outstandingInstalments,
  scheduleCounts,
}: {
  ledger: LedgerEntry[];
  lodgeDues: LodgeDues[];
  activeMembers: number;
  outstandingInstalments: Instalment[];
  scheduleCounts: ScheduleCounts;
}) {
  const router = useRouter();
  const [busyAction, setBusyAction] = useState<"run" | "remind" | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("ledger");
  const [outstandingOpen, setOutstandingOpen] = useState(false);
  const [bulkForm, setBulkForm] = useState(() => {
    const now = new Date();
    const yearStart = new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10);
    const yearEnd = new Date(now.getFullYear(), 11, 31).toISOString().slice(0, 10);
    return {
      dues_id: lodgeDues[0]?.id ?? "",
      period_start: yearStart,
      period_end: yearEnd,
      amount: lodgeDues[0]?.amount ?? 0,
      instalment_count: lodgeDues[0]?.instalment_count ?? 1,
      instalment_frequency:
        (lodgeDues[0]?.instalment_frequency as
          | "monthly"
          | "quarterly"
          | "annually") ?? "monthly",
    };
  });

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/settings/masonic-year");
        if (!res.ok) return;
        const data = await res.json();
        if (data.current) {
          setBulkForm((f) => ({
            ...f,
            period_start: data.current.start_date?.slice(0, 10) ?? f.period_start,
            period_end: data.current.end_date?.slice(0, 10) ?? f.period_end,
            amount: data.current.annual_dues_amount ?? f.amount,
          }));
        }
      } catch {
        /* keep defaults */
      }
    })();
  }, []);

  const totals = useMemo(() => {
    let inflow = 0;
    let refunds = 0;
    let outstandingDues = 0;
    let donations = 0;
    let payments = 0;
    for (const row of ledger) {
      if (row.source_type === "dues") {
        if (row.status !== "paid" && row.status !== "waived") {
          outstandingDues += Number(row.amount);
          continue;
        }
      }
      const amount = Number(row.amount);
      if (row.status === "completed" || row.status === "paid" || row.status === "succeeded") {
        inflow += amount;
        if (row.source_type === "payment") payments += amount;
        if (row.source_type === "donation") donations += amount;
      }
      refunds += Number(row.refund_amount ?? 0);
    }
    return {
      inflow: Math.round(inflow * 100) / 100,
      refunds: Math.round(refunds * 100) / 100,
      outstandingDues: Math.round(outstandingDues * 100) / 100,
      donations: Math.round(donations * 100) / 100,
      payments: Math.round(payments * 100) / 100,
    };
  }, [ledger]);

  async function runBulkDues() {
    setBusyAction("run");
    setFeedback(null);
    try {
      const res = await fetch("/api/dues/bulk-run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bulkForm),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Bulk dues run failed.");
      setFeedback(
        `Created ${body.created.length} dues records. ${body.skipped.length} skipped (already billed).`
      );
      router.refresh();
    } catch (error) {
      setFeedback(
        error instanceof Error ? error.message : "Bulk dues run failed."
      );
    } finally {
      setBusyAction(null);
    }
  }

  async function sendReminders() {
    setBusyAction("remind");
    setFeedback(null);
    try {
      const res = await fetch("/api/dues/reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not send reminders.");
      setFeedback(`Sent ${body.sent} reminders. ${body.failures.length} failed.`);
      router.refresh();
    } catch (error) {
      setFeedback(
        error instanceof Error ? error.message : "Could not send reminders."
      );
    } finally {
      setBusyAction(null);
    }
  }

  const overdueInstalments = outstandingInstalments.filter(
    (i) => new Date(i.due_date) < new Date()
  );

  const outstandingByContact = useMemo(() => {
    const map = new Map<
      string,
      {
        key: string;
        name: string | null;
        email: string | null;
        total: number;
        count: number;
        oldest: string | null;
        items: Array<{
          source_id: string;
          amount: number;
          status: string;
          occurred_at: string;
        }>;
      }
    >();
    for (const row of ledger) {
      if (row.source_type !== "dues") continue;
      if (row.status === "paid" || row.status === "waived") continue;
      const key = (row.contact_email ?? row.contact_name ?? row.source_id).toLowerCase();
      const entry = map.get(key) ?? {
        key,
        name: row.contact_name,
        email: row.contact_email,
        total: 0,
        count: 0,
        oldest: null as string | null,
        items: [] as Array<{
          source_id: string;
          amount: number;
          status: string;
          occurred_at: string;
        }>,
      };
      entry.total += Number(row.amount);
      entry.count += 1;
      entry.items.push({
        source_id: row.source_id,
        amount: Number(row.amount),
        status: row.status,
        occurred_at: row.occurred_at,
      });
      if (!entry.oldest || row.occurred_at < entry.oldest) {
        entry.oldest = row.occurred_at;
      }
      map.set(key, entry);
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [ledger]);

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Treasurer</h1>
          <p className="mt-1 text-sm text-slate-500">
            Single ledger across payments, dues, and donations. Run bulk dues, send
            reminders, and reconcile from one place.
          </p>
        </div>
        <Link href="/admin/treasurer/reconciliation">
          <Button variant="outline">
            <FileSpreadsheet className="mr-2 h-4 w-4" /> Bank reconciliation
          </Button>
        </Link>
      </div>

      {(() => {
        const subscriptionsActive =
          scheduleCounts.active +
          scheduleCounts.action_required +
          scheduleCounts.past_due +
          scheduleCounts.active_stripe;
        const subscriptionsAttention =
          scheduleCounts.action_required +
          scheduleCounts.past_due +
          scheduleCounts.paused;
        return (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Kpi
              icon={Banknote}
              label="Inflow"
              value={`£${totals.inflow.toFixed(2)}`}
              color="emerald"
            />
            <Kpi
              icon={Wallet}
              label="Outstanding dues"
              value={`£${totals.outstandingDues.toFixed(2)}`}
              color="amber"
              onClick={
                outstandingByContact.length > 0
                  ? () => setOutstandingOpen(true)
                  : undefined
              }
              hint={
                outstandingByContact.length > 0
                  ? `${outstandingByContact.length} ${
                      outstandingByContact.length === 1 ? "member" : "members"
                    }`
                  : undefined
              }
            />
            <Kpi
              icon={CheckCircle2}
              label="Active members"
              value={String(activeMembers)}
              color="blue"
            />
            <Kpi
              icon={Repeat}
              label="Monthly subscriptions"
              value={String(subscriptionsActive)}
              color={subscriptionsAttention > 0 ? "amber" : "blue"}
              hint={
                subscriptionsAttention > 0
                  ? `${subscriptionsAttention} need attention`
                  : subscriptionsActive > 0
                    ? "All healthy"
                    : undefined
              }
              link="/admin/dues/schedules"
            />
            <Kpi
              icon={AlertTriangle}
              label="Overdue instalments"
              value={String(overdueInstalments.length)}
              color={overdueInstalments.length > 0 ? "red" : "slate"}
              onClick={
                overdueInstalments.length > 0
                  ? () => setActiveTab("instalments")
                  : undefined
              }
              hint={overdueInstalments.length > 0 ? "View list" : undefined}
            />
          </div>
        );
      })()}

      {feedback && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          {feedback}
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="ledger">Ledger</TabsTrigger>
          <TabsTrigger value="next-dues">Next dues</TabsTrigger>
          <TabsTrigger value="fees">Membership fees</TabsTrigger>
          <TabsTrigger value="meeting-fees">Meeting & dining</TabsTrigger>
          <TabsTrigger value="masonic-year">Masonic year</TabsTrigger>
          <TabsTrigger value="dues-run">Bulk dues run</TabsTrigger>
          <TabsTrigger value="instalments">Instalments</TabsTrigger>
        </TabsList>

        <TabsContent value="ledger" className="space-y-3">
          <div className="flex items-center justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                downloadCsv(
                  `treasurer-ledger-${new Date().toISOString().slice(0, 10)}.csv`,
                  ledger.map((row) => ({
                    occurred_at: row.occurred_at,
                    source_type: row.source_type,
                    category: row.category,
                    contact_name: row.contact_name ?? "",
                    contact_email: row.contact_email ?? "",
                    amount: row.amount,
                    refund_amount: row.refund_amount,
                    status: row.status,
                  }))
                )
              }
            >
              <ArrowDownToLine className="mr-2 h-4 w-4" /> Export CSV
            </Button>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ledger.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-sm text-slate-500">
                      No ledger entries yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  ledger.slice(0, 200).map((row) => {
                    const href = ledgerHref(row.source_type, row.source_id);
                    const isWaived = row.status === "waived";
                    const waiverReason =
                      isWaived && typeof row.metadata?.waiver_reason === "string"
                        ? (row.metadata.waiver_reason as string)
                        : null;
                    return (
                      <TableRow
                        key={`${row.source_type}-${row.source_id}`}
                        className={cn(
                          href && "cursor-pointer hover:bg-slate-50",
                          isWaived && "bg-slate-50/40 text-slate-500"
                        )}
                        onClick={
                          href ? () => router.push(href) : undefined
                        }
                      >
                        <TableCell className="whitespace-nowrap text-sm text-slate-600">
                          {new Date(row.occurred_at).toLocaleDateString("en-GB", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </TableCell>
                        <TableCell>
                          <Badge variant={sourceColors[row.source_type] ?? "secondary"}>
                            {row.source_type}
                          </Badge>
                          <span className="ml-2 text-xs text-slate-400">
                            {row.category}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm">
                          <p className={cn(
                            "font-medium text-slate-900",
                            isWaived && "text-slate-500"
                          )}>
                            {row.contact_name ?? "—"}
                          </p>
                          <p className="text-xs text-slate-500">
                            {row.contact_email ?? ""}
                          </p>
                          {waiverReason && (
                            <p className="mt-0.5 text-xs italic text-slate-400">
                              Waived: {waiverReason}
                            </p>
                          )}
                        </TableCell>
                        <TableCell className={cn(
                          "text-right font-semibold tabular-nums",
                          isWaived && "line-through decoration-slate-300"
                        )}>
                          £{Number(row.amount).toFixed(2)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="capitalize">
                            {row.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
          {ledger.length > 200 && (
            <p className="text-xs text-slate-400">
              Showing the most recent 200 entries. Export CSV to see everything.
            </p>
          )}
        </TabsContent>

        <TabsContent value="next-dues" className="space-y-4">
          <NextDuesPanel />
        </TabsContent>

        <TabsContent value="fees" className="space-y-4">
          <MembershipFeesSettings />
        </TabsContent>

        <TabsContent value="meeting-fees" className="space-y-4">
          <LodgeFeeDefaultsSettings />
        </TabsContent>

        <TabsContent value="masonic-year" className="space-y-4">
          <MasonicYearSettings />
        </TabsContent>

        <TabsContent value="dues-run" className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900">
              Generate annual dues
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Creates an outstanding dues record (and optional instalment schedule)
              for every active member who is not yet billed for the period.
            </p>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Dues template">
                <select
                  value={bulkForm.dues_id}
                  onChange={(e) =>
                    setBulkForm((f) => ({ ...f, dues_id: e.target.value }))
                  }
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                >
                  <option value="">No template (use amount below)</option>
                  {lodgeDues.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} (£{Number(d.amount).toFixed(2)} {d.billing_period})
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Amount per member (£)">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={bulkForm.amount}
                  onChange={(e) =>
                    setBulkForm((f) => ({ ...f, amount: Number(e.target.value) }))
                  }
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </Field>
              <Field label="Period start">
                <input
                  type="date"
                  value={bulkForm.period_start}
                  onChange={(e) =>
                    setBulkForm((f) => ({ ...f, period_start: e.target.value }))
                  }
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </Field>
              <Field label="Period end">
                <input
                  type="date"
                  value={bulkForm.period_end}
                  onChange={(e) =>
                    setBulkForm((f) => ({ ...f, period_end: e.target.value }))
                  }
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </Field>
              <Field label="Instalments">
                <input
                  type="number"
                  min={1}
                  max={24}
                  value={bulkForm.instalment_count}
                  onChange={(e) =>
                    setBulkForm((f) => ({
                      ...f,
                      instalment_count: Math.max(1, Number(e.target.value) || 1),
                    }))
                  }
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </Field>
              <Field label="Frequency">
                <select
                  value={bulkForm.instalment_frequency}
                  onChange={(e) =>
                    setBulkForm((f) => ({
                      ...f,
                      instalment_frequency: e.target.value as
                        | "monthly"
                        | "quarterly"
                        | "annually",
                    }))
                  }
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                >
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="annually">Annually</option>
                </select>
              </Field>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <Button onClick={runBulkDues} disabled={busyAction !== null}>
                {busyAction === "run" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <PlayCircle className="mr-2 h-4 w-4" />
                )}
                Run bulk dues
              </Button>
              <Button
                variant="outline"
                onClick={sendReminders}
                disabled={busyAction !== null}
              >
                {busyAction === "remind" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Mail className="mr-2 h-4 w-4" />
                )}
                Send dues reminders
              </Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="instalments">
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Due date</TableHead>
                  <TableHead>Sequence</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {outstandingInstalments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-8 text-center text-sm text-slate-500">
                      No outstanding instalments.
                    </TableCell>
                  </TableRow>
                ) : (
                  outstandingInstalments.slice(0, 100).map((row) => {
                    const overdue = new Date(row.due_date) < new Date();
                    return (
                      <TableRow key={row.id}>
                        <TableCell className="whitespace-nowrap text-sm">
                          {new Date(row.due_date).toLocaleDateString("en-GB")}
                          {overdue && (
                            <span className="ml-2 text-[10px] font-semibold uppercase tracking-wider text-red-600">
                              overdue
                            </span>
                          )}
                        </TableCell>
                        <TableCell>{row.sequence}</TableCell>
                        <TableCell className="text-right font-semibold tabular-nums">
                          £{Number(row.amount).toFixed(2)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={overdue ? "destructive" : "secondary"}
                            className="capitalize"
                          >
                            {overdue ? "overdue" : row.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={outstandingOpen} onOpenChange={setOutstandingOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Outstanding dues</DialogTitle>
            <DialogDescription>
              £{totals.outstandingDues.toFixed(2)} across{" "}
              {outstandingByContact.length}{" "}
              {outstandingByContact.length === 1 ? "member" : "members"}. Click a
              row to view their dues.
            </DialogDescription>
          </DialogHeader>

          <div className="-mx-1 max-h-[60vh] overflow-y-auto rounded-xl border border-slate-200">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead className="text-right">Records</TableHead>
                  <TableHead className="text-right">Total owed</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {outstandingByContact.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="py-8 text-center text-sm text-slate-500"
                    >
                      No outstanding dues. All caught up.
                    </TableCell>
                  </TableRow>
                ) : (
                  outstandingByContact.map((entry) => {
                    const firstSource = entry.items[0]?.source_id;
                    const href = firstSource
                      ? `/admin/payments?dues=${firstSource}`
                      : null;
                    return (
                      <TableRow
                        key={entry.key}
                        className={cn(
                          href && "cursor-pointer hover:bg-slate-50"
                        )}
                        onClick={
                          href
                            ? () => {
                                setOutstandingOpen(false);
                                router.push(href);
                              }
                            : undefined
                        }
                      >
                        <TableCell className="text-sm">
                          <p className="font-medium text-slate-900">
                            {entry.name ?? "—"}
                          </p>
                          {entry.email && (
                            <p className="text-xs text-slate-500">
                              {entry.email}
                            </p>
                          )}
                        </TableCell>
                        <TableCell className="text-right text-sm text-slate-600 tabular-nums">
                          {entry.count}
                        </TableCell>
                        <TableCell className="text-right font-semibold tabular-nums text-amber-700">
                          £{entry.total.toFixed(2)}
                        </TableCell>
                        <TableCell className="w-8 text-slate-400">
                          {href && <ChevronRight className="h-4 w-4" />}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={sendReminders}
              disabled={busyAction !== null || outstandingByContact.length === 0}
            >
              {busyAction === "remind" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Mail className="mr-2 h-4 w-4" />
              )}
              Send dues reminders
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-xs font-medium text-slate-600">
      <span className="mb-1 block">{label}</span>
      {children}
    </label>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  color,
  onClick,
  hint,
  link,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  color: "emerald" | "amber" | "blue" | "red" | "slate";
  onClick?: () => void;
  hint?: string;
  link?: string;
}) {
  const colorMap = {
    emerald: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600",
    blue: "bg-blue-50 text-blue-600",
    red: "bg-red-50 text-red-600",
    slate: "bg-slate-100 text-slate-600",
  };
  const interactive = typeof onClick === "function" || typeof link === "string";
  const content = (
    <>
      <div className="flex items-start justify-between">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-xl ${colorMap[color]}`}
        >
          <Icon className="h-5 w-5" />
        </div>
        {interactive && (
          <ChevronRight className="h-4 w-4 text-slate-300 transition-colors group-hover:text-slate-500" />
        )}
      </div>
      <p className="mt-3 text-2xl font-bold text-slate-900">{value}</p>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-slate-500">{label}</p>
        {hint && (
          <p className="text-[11px] font-medium text-slate-400">{hint}</p>
        )}
      </div>
    </>
  );
  if (typeof link === "string") {
    return (
      <Link
        href={link}
        className="group rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
      >
        {content}
      </Link>
    );
  }
  if (interactive) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="group rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
      >
        {content}
      </button>
    );
  }
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      {content}
    </div>
  );
}
