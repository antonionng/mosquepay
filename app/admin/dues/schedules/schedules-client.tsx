"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  Filter,
  Repeat,
  Search,
  ShieldAlert,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  getScheduleStatusDisplay,
  STATUS_SORT_PRIORITY,
} from "@/lib/dues/status-display";
import type { DuesSchedule, DuesScheduleStatus } from "@/lib/db/types";

interface MemberLookupEntry {
  id: string;
  full_name: string;
}

interface Props {
  initialSchedules: DuesSchedule[];
  counts: Record<DuesScheduleStatus, number>;
  memberLookup: Record<string, MemberLookupEntry>;
}

const FILTER_TABS: Array<{
  id: "all" | "needs_attention" | DuesScheduleStatus;
  label: string;
}> = [
  { id: "all", label: "All" },
  { id: "needs_attention", label: "Needs attention" },
  { id: "active", label: "Active" },
  { id: "pending", label: "Pending" },
  { id: "completed", label: "Completed" },
  { id: "cancelled", label: "Cancelled" },
];

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const NEEDS_ATTENTION_STATUSES: DuesScheduleStatus[] = [
  "action_required",
  "past_due",
  "paused",
];

export function DuesSchedulesClient({
  initialSchedules,
  counts,
  memberLookup,
}: Props) {
  const [filter, setFilter] = useState<(typeof FILTER_TABS)[number]["id"]>(
    "all"
  );
  const [search, setSearch] = useState("");

  const subscriptionsActive =
    counts.active +
    counts.action_required +
    counts.past_due +
    counts.active_stripe;
  const needsAttention =
    counts.action_required + counts.past_due + counts.paused;

  const filtered = useMemo(() => {
    let list = initialSchedules;
    if (filter === "needs_attention") {
      list = list.filter((s) =>
        (NEEDS_ATTENTION_STATUSES as string[]).includes(s.status)
      );
    } else if (filter !== "all") {
      list = list.filter((s) => s.status === filter);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((s) => {
        if (s.member_email.toLowerCase().includes(q)) return true;
        const member = memberLookup[s.member_email.toLowerCase()];
        if (member?.full_name.toLowerCase().includes(q)) return true;
        return false;
      });
    }
    // Sort: needs-attention first, then created_at desc
    return [...list].sort((a, b) => {
      const pa = STATUS_SORT_PRIORITY[a.status] ?? 99;
      const pb = STATUS_SORT_PRIORITY[b.status] ?? 99;
      if (pa !== pb) return pa - pb;
      return (
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    });
  }, [filter, search, initialSchedules, memberLookup]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryStat
          icon={Repeat}
          label="Active subscriptions"
          value={subscriptionsActive}
          tone="emerald"
        />
        <SummaryStat
          icon={AlertTriangle}
          label="Need attention"
          value={needsAttention}
          tone={needsAttention > 0 ? "amber" : "slate"}
        />
        <SummaryStat
          icon={CheckCircle2}
          label="Completed this year"
          value={counts.completed}
          tone="slate"
        />
        <SummaryStat
          icon={ShieldAlert}
          label="3DS pending"
          value={counts.action_required}
          tone={counts.action_required > 0 ? "amber" : "slate"}
        />
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Filter className="h-4 w-4 text-slate-400" />
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              className={
                filter === tab.id
                  ? "rounded-full bg-slate-900 px-3 py-1 text-xs font-medium text-white"
                  : "rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 hover:border-slate-300 hover:bg-slate-50"
              }
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email"
            className="pl-8 text-sm"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 text-left">Member</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Cadence</th>
              <th className="px-4 py-3 text-left">Next charge</th>
              <th className="px-4 py-3 text-left">Last failure</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-12 text-center text-sm text-slate-500"
                >
                  No subscriptions match these filters.
                </td>
              </tr>
            ) : (
              filtered.map((schedule) => {
                const member =
                  memberLookup[schedule.member_email.toLowerCase()];
                const display = getScheduleStatusDisplay(schedule.status);
                return (
                  <tr
                    key={schedule.id}
                    className="border-t border-slate-100 hover:bg-slate-50/60"
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">
                        {member?.full_name ?? schedule.member_email}
                      </div>
                      {member ? (
                        <div className="text-xs text-slate-500">
                          {schedule.member_email}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={display.badgeVariant}>
                        {display.label}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      <div className="capitalize">{schedule.cadence}</div>
                      <div className="text-xs text-slate-500">
                        {schedule.split_strategy.replace(/_/g, " ")}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {formatDate(schedule.next_charge_at)}
                    </td>
                    <td className="px-4 py-3">
                      {schedule.consecutive_failures > 0 ? (
                        <div className="flex items-center gap-1.5">
                          <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                          <div>
                            <div className="text-xs font-medium text-amber-900">
                              {schedule.consecutive_failures}× failure
                            </div>
                            <div className="font-mono text-[10px] text-slate-500">
                              {schedule.last_failure_code ?? "unknown"}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {member ? (
                        <Link
                          href={`/admin/members/${member.id}`}
                          className="text-xs font-medium text-slate-700 underline-offset-4 hover:text-slate-900 hover:underline"
                        >
                          View member
                        </Link>
                      ) : (
                        <span className="text-xs text-slate-400">
                          No member row
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SummaryStat({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  tone: "emerald" | "amber" | "slate";
}) {
  const colorMap: Record<typeof tone, string> = {
    emerald: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600",
    slate: "bg-slate-100 text-slate-600",
  };
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div
        className={`flex h-9 w-9 items-center justify-center rounded-xl ${colorMap[tone]}`}
      >
        <Icon className="h-4 w-4" />
      </div>
      <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}
