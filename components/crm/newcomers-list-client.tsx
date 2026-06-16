"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn, formatDate } from "@/lib/utils";
import {
  Search,
  ArrowRight,
  Phone,
  AlertTriangle,
  CheckSquare,
  Square,
  Clock,
  Mail,
  Calendar,
  FileText,
  CheckCircle2,
  Flag,
  UserCheck,
} from "lucide-react";
import { PROMPT_CLASSES } from "@/lib/newcomers/next-action";

type Newcomer = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  stage: string;
  source: string | null;
  created_at: string;
  updated_at: string;
  stage_changed_at: string;
  converted_at: string | null;
  daysInStage: number;
  daysSinceActivity: number;
  lastActivityType: string | null;
  lastActivityTitle: string | null;
  lastActivityDate: string | null;
  promptLabel: string;
  promptReason: string;
  promptSeverity: "info" | "warn" | "urgent" | "ok";
};

const STAGE_BADGE_LIGHT: Record<string, string> = {
  expression_of_interest: "border-blue-200 bg-blue-50 text-blue-900",
  initial_contact: "border-cyan-200 bg-cyan-50 text-cyan-900",
  service_scheduled: "border-amber-200 bg-amber-50 text-amber-900",
  proposal_mosque: "border-violet-200 bg-violet-50 text-violet-900",
  approved: "border-emerald-200 bg-emerald-50 text-emerald-900",
  welcomed: "border-green-200 bg-green-50 text-green-900",
  declined: "border-red-200 bg-red-50 text-red-900",
  on_hold: "border-slate-200 bg-slate-100 text-slate-800",
};

const ACTIVITY_ICONS: Record<string, typeof FileText> = {
  note: FileText,
  service: Calendar,
  phone_call: Phone,
  email: Mail,
  task: CheckCircle2,
};

const SOURCE_LABELS: Record<string, string> = {
  website: "Website",
  referral: "Referral",
  event: "Event",
  social_media: "Social Media",
};

export function NewcomersListClient({
  newcomers: initialNewcomers,
  stageLabels,
  stages,
}: {
  newcomers: Newcomer[];
  stageLabels: Record<string, string>;
  stages: string[];
}) {
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [attentionFilter, setAttentionFilter] = useState("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkStage, setBulkStage] = useState("");

  const filteredNewcomers = useMemo(() => {
    return initialNewcomers.filter((newcomer) => {
      const matchesSearch =
        search === "" ||
        `${newcomer.first_name} ${newcomer.last_name} ${newcomer.email}`
          .toLowerCase()
          .includes(search.toLowerCase());
      const matchesStage =
        stageFilter === "all" || newcomer.stage === stageFilter;
      const matchesSource =
        sourceFilter === "all" || newcomer.source === sourceFilter;
      const matchesAttention =
        attentionFilter === "all" ||
        (attentionFilter === "needs_attention" &&
          (newcomer.promptSeverity === "warn" || newcomer.promptSeverity === "urgent")) ||
        (attentionFilter === "converted" && Boolean(newcomer.converted_at));
      return matchesSearch && matchesStage && matchesSource && matchesAttention;
    });
  }, [initialNewcomers, search, stageFilter, sourceFilter, attentionFilter]);

  const allSelected =
    filteredNewcomers.length > 0 &&
    filteredNewcomers.every((l) => selected.has(l.id));

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filteredNewcomers.map((l) => l.id)));
    }
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleBulkStageChange() {
    if (!bulkStage || selected.size === 0) return;
    const ids = Array.from(selected);
    await Promise.all(
      ids.map((id) =>
        fetch(`/api/newcomers/mosque/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ stage: bulkStage }),
        })
      )
    );
    setSelected(new Set());
    setBulkStage("");
    window.location.reload();
  }

  const sources = Array.from(
    new Set(initialNewcomers.map((l) => l.source).filter(Boolean))
  ) as string[];

  return (
    <Card variant="panel" className="overflow-hidden p-0">
      <div className="dash-panel-header rounded-none border-dash-border bg-dash-surface-subtle">
        <div>
          <h2 className="dash-panel-header-title">All newcomers</h2>
          <p className="dash-panel-header-description">
            Search, filter, and bulk-update pipeline stages. Row highlights flag ageing activity.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary" className="tabular-nums">
            {filteredNewcomers.length} shown
          </Badge>
          <Badge variant="outline" className="border-dash-border bg-dash-surface tabular-nums">
            {initialNewcomers.length} total
          </Badge>
        </div>
      </div>

      <CardContent className="space-y-4 border-t border-dash-border bg-dash-surface p-5 pt-5">
        <div className="dash-filter-bar">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-dash-faint" />
            <Input
              variant="dashboard"
              placeholder="Search newcomers..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={stageFilter} onValueChange={setStageFilter}>
            <SelectTrigger variant="dashboard" className="w-full sm:w-48">
              <SelectValue placeholder="All stages" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All stages</SelectItem>
              {stages.map((s) => (
                <SelectItem key={s} value={s}>
                  {stageLabels[s] ?? s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sourceFilter} onValueChange={setSourceFilter}>
            <SelectTrigger variant="dashboard" className="w-full sm:w-40">
              <SelectValue placeholder="All sources" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sources</SelectItem>
              {sources.map((s) => (
                <SelectItem key={s} value={s}>
                  {SOURCE_LABELS[s] ?? s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={attentionFilter} onValueChange={setAttentionFilter}>
            <SelectTrigger variant="dashboard" className="w-full sm:w-40">
              <SelectValue placeholder="All newcomers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All newcomers</SelectItem>
              <SelectItem value="needs_attention">Needs attention</SelectItem>
              <SelectItem value="converted">Converted to member</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {selected.size > 0 && (
          <div className="flex flex-col gap-3 rounded-xl border border-blue-200 bg-blue-50/90 px-4 py-3 sm:flex-row sm:items-center">
            <span className="text-sm font-medium text-blue-900">
              {selected.size} selected
            </span>
            <Select value={bulkStage} onValueChange={setBulkStage}>
              <SelectTrigger variant="dashboard" className="w-full sm:w-48">
                <SelectValue placeholder="Move to stage..." />
              </SelectTrigger>
              <SelectContent>
                {stages.map((s) => (
                  <SelectItem key={s} value={s}>
                    {stageLabels[s] ?? s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={!bulkStage}
                onClick={handleBulkStageChange}
              >
                Apply
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelected(new Set())}
                className="text-slate-600 hover:text-slate-900"
              >
                Clear
              </Button>
            </div>
          </div>
        )}
      </CardContent>

      <div className="border-t border-dash-border bg-dash-surface p-0">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-10">
                <button
                  type="button"
                  onClick={toggleAll}
                  className="flex h-5 w-5 items-center justify-center text-slate-500 hover:text-slate-900"
                  aria-label={allSelected ? "Deselect all" : "Select all"}
                >
                  {allSelected ? (
                    <CheckSquare className="h-4 w-4" />
                  ) : (
                    <Square className="h-4 w-4" />
                  )}
                </button>
              </TableHead>
              <TableHead>Newcomer</TableHead>
              <TableHead>Stage</TableHead>
              <TableHead>Next action</TableHead>
              <TableHead className="hidden lg:table-cell">Source</TableHead>
              <TableHead className="hidden md:table-cell">Last activity</TableHead>
              <TableHead className="hidden lg:table-cell">Days in stage</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredNewcomers.map((newcomer) => {
              const isStale = newcomer.daysSinceActivity >= 14;
              const isWarning =
                newcomer.daysSinceActivity >= 7 && newcomer.daysSinceActivity < 14;
              const ActivityIcon = newcomer.lastActivityType
                ? ACTIVITY_ICONS[newcomer.lastActivityType] ?? FileText
                : null;

              return (
                <TableRow
                  key={newcomer.id}
                  className={cn(
                    "group",
                    isStale && "border-l-2 border-l-red-400 bg-red-50/40",
                    isWarning && !isStale && "border-l-2 border-l-amber-400 bg-amber-50/30"
                  )}
                >
                  <TableCell>
                    <button
                      type="button"
                      onClick={() => toggleOne(newcomer.id)}
                      className="flex h-5 w-5 items-center justify-center text-slate-400 hover:text-slate-900"
                      aria-label={
                        selected.has(newcomer.id) ? "Deselect row" : "Select row"
                      }
                    >
                      {selected.has(newcomer.id) ? (
                        <CheckSquare className="h-4 w-4 text-blue-600" />
                      ) : (
                        <Square className="h-4 w-4" />
                      )}
                    </button>
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/admin/newcomers/mosque/${newcomer.id}`}
                      className="group/link"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500/15 to-violet-500/15 text-xs font-semibold text-blue-800">
                          {newcomer.first_name[0]}
                          {newcomer.last_name[0]}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-slate-900 group-hover/link:text-blue-700 transition-colors">
                            {newcomer.first_name} {newcomer.last_name}
                          </p>
                          <p className="truncate text-xs text-slate-500">
                            {newcomer.email}
                          </p>
                        </div>
                      </div>
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={cn(
                        "font-medium",
                        STAGE_BADGE_LIGHT[newcomer.stage] ??
                          "border-slate-200 bg-slate-50 text-slate-800"
                      )}
                    >
                      {stageLabels[newcomer.stage] ?? newcomer.stage}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div
                      className={cn(
                        "inline-flex flex-col gap-0.5 rounded-lg border px-2.5 py-1.5 text-xs",
                        PROMPT_CLASSES[newcomer.promptSeverity]
                      )}
                    >
                      <span className="flex items-center gap-1.5 font-medium">
                        {newcomer.converted_at ? (
                          <UserCheck className="h-3 w-3" />
                        ) : (
                          <Flag className="h-3 w-3" />
                        )}
                        {newcomer.promptLabel}
                      </span>
                      <span className="text-[10px] opacity-80">
                        {newcomer.promptReason}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="hidden text-slate-600 lg:table-cell">
                    {SOURCE_LABELS[newcomer.source ?? ""] ?? newcomer.source ?? "Not recorded"}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {newcomer.lastActivityDate ? (
                      <div className="flex items-center gap-2 text-slate-600">
                        {ActivityIcon && (
                          <ActivityIcon className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                        )}
                        <div className="min-w-0">
                          <p className="truncate text-xs font-medium text-slate-800">
                            {newcomer.lastActivityTitle}
                          </p>
                          <p className="text-xs text-slate-500">
                            {formatDate(newcomer.lastActivityDate)}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">No activity</span>
                    )}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-slate-400" />
                      <span
                        className={cn(
                          "text-xs tabular-nums",
                          isStale
                            ? "font-semibold text-red-700"
                            : isWarning
                            ? "font-medium text-amber-700"
                            : "text-slate-600"
                        )}
                      >
                        {newcomer.daysInStage}d
                      </span>
                      {isStale && (
                        <AlertTriangle className="h-3 w-3 text-red-600" />
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <Link href={`/admin/newcomers/mosque/${newcomer.id}`}>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-slate-500 hover:text-slate-900"
                          aria-label="Open newcomer"
                        >
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Button>
                      </Link>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        {filteredNewcomers.length === 0 && (
          <div className="admin-empty border-t border-dash-border text-slate-500">
            {search || stageFilter !== "all" || sourceFilter !== "all"
              ? "No newcomers match your filters."
              : "No newcomers yet."}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-dash-border bg-dash-surface-subtle px-5 py-3">
        <span className="text-xs text-dash-muted">
          Showing {filteredNewcomers.length} of {initialNewcomers.length} newcomers
        </span>
        <Link
          href="/admin/newcomers/kanban"
          className="ml-auto text-xs font-medium text-dash-ring hover:underline"
        >
          Open pipeline board
        </Link>
      </div>
    </Card>
  );
}
