"use client";

import { useEffect, useState } from "react";
import {
  CreditCard,
  Download,
  Filter,
  Search,
  Receipt,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Payment {
  id: string;
  date: string;
  description: string;
  amount: number;
  status: "completed" | "pending" | "failed";
  type: "event" | "dues" | "donation";
}

type FilterType = "all" | "event" | "dues" | "donation";

const statusBadge: Record<string, "success" | "warning" | "destructive"> = {
  completed: "success",
  pending: "warning",
  failed: "destructive",
};

const typeLabel: Record<string, string> = {
  event: "Event",
  dues: "Dues",
  donation: "Donation",
};

function TableSkeleton() {
  return (
    <div className="space-y-3 p-6">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 animate-pulse">
          <div className="h-4 w-24 rounded bg-slate-100" />
          <div className="h-4 w-48 rounded bg-slate-100 flex-1" />
          <div className="h-4 w-16 rounded bg-slate-100" />
          <div className="h-4 w-20 rounded bg-slate-100" />
          <div className="h-8 w-8 rounded bg-slate-100" />
        </div>
      ))}
    </div>
  );
}

export default function MemberPaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/member/dashboard");
        if (res.ok) {
          const data = await res.json();
          setPayments(data.payments ?? []);
        }
      } catch {
        /* empty */
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filtered = payments.filter((p) => {
    if (filter !== "all" && p.type !== filter) return false;
    if (search && !p.description.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const filters: { value: FilterType; label: string }[] = [
    { value: "all", label: "All" },
    { value: "event", label: "Events" },
    { value: "dues", label: "Dues" },
    { value: "donation", label: "Donations" },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Payments</h1>
        <p className="text-slate-500 mt-1">View your payment history</p>
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search payments…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-colors"
          />
        </div>
        <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white p-1">
          {filters.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                filter === f.value
                  ? "bg-blue-600 text-white"
                  : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
              }`}
            >
              <Filter className="inline h-3 w-3 mr-1" />
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {loading ? (
          <TableSkeleton />
        ) : filtered.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((payment) => (
                <TableRow key={payment.id}>
                  <TableCell className="font-medium text-slate-600 whitespace-nowrap">
                    {new Date(payment.date).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </TableCell>
                  <TableCell>{payment.description}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{typeLabel[payment.type] ?? payment.type}</Badge>
                  </TableCell>
                  <TableCell className="font-semibold text-slate-900">
                    £{payment.amount.toFixed(2)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusBadge[payment.status] ?? "default"}>
                      {payment.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <a
                      href={`/member/receipts/${payment.type}/${payment.id}`}
                      title="View receipt"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-slate-50 hover:text-slate-700"
                    >
                      <Download className="h-4 w-4" />
                    </a>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-50 mb-4">
              <Receipt className="h-7 w-7 text-slate-300" />
            </div>
            <p className="text-base font-medium text-slate-500">No payments found</p>
            <p className="text-sm text-slate-400 mt-1">
              {filter !== "all"
                ? "Try changing the filter to see more results."
                : "Your payment history will appear here."}
            </p>
          </div>
        )}
      </div>

      {!loading && filtered.length > 0 && (
        <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-6 py-4 shadow-sm">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <CreditCard className="h-4 w-4" />
            <span>
              {filtered.length} payment{filtered.length !== 1 && "s"} &middot; Total:{" "}
              <strong className="text-slate-900">
                £{filtered.reduce((s, p) => s + p.amount, 0).toFixed(2)}
              </strong>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
