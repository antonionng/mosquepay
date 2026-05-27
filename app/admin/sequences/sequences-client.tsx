"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  FileText,
  Pencil,
  Plus,
  ShieldCheck,
  Sparkles,
  Trash2,
  Wand2,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ConfirmActionDialog } from "@/components/ui/confirm-action-dialog";
import { describeSequence } from "@/lib/meetings/sequences";
import { cn } from "@/lib/utils";

type MonthOverride = { week_of_month?: number; day_of_week?: number };
type MonthOverrides = Record<string, MonthOverride>;

type SequenceRecord = {
  id: string;
  name: string;
  description: string | null;
  event_type: string;
  day_of_week: number;
  week_of_month: number;
  months: number[];
  month_overrides: MonthOverrides;
  default_event_time: string | null;
  default_location: string | null;
  default_temple_room: string | null;
  default_dress_code: string | null;
  default_dining_price: number | null;
  default_meeting_fee_amount: number | null;
  default_enable_dining_rsvp: boolean;
  default_enable_meeting_fee: boolean;
  default_enable_charity_donation: boolean;
  default_charity_name: string | null;
  default_enable_raffle_donation: boolean;
  default_raffle_description: string | null;
  default_enable_raffle_wine_pledge: boolean;
  default_raffle_wine_description: string | null;
  summons_lead_weeks: number;
  summons_min_lead_weeks: number;
  auto_draft_summons: boolean;
  active: boolean;
};

type SequenceEvent = {
  id: string;
  title: string;
  slug: string;
  event_date: string;
  summons_status: string;
  summons_auto_drafted_at: string | null;
  summons_approved_at: string | null;
  summons_last_sent_at: string | null;
  published: boolean;
};

type SequenceForm = {
  name: string;
  description: string;
  day_of_week: number;
  week_of_month: number;
  months: number[];
  month_overrides: MonthOverrides;
  default_event_time: string;
  default_location: string;
  default_temple_room: string;
  default_dress_code: string;
  default_dining_price: string;
  default_meeting_fee_amount: string;
  default_enable_dining_rsvp: boolean;
  default_enable_meeting_fee: boolean;
  default_enable_charity_donation: boolean;
  default_charity_name: string;
  default_enable_raffle_donation: boolean;
  default_raffle_description: string;
  default_enable_raffle_wine_pledge: boolean;
  default_raffle_wine_description: string;
  summons_lead_weeks: number;
  summons_min_lead_weeks: number;
  auto_draft_summons: boolean;
};

const DAY_OPTIONS = [
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
  { value: 7, label: "Sunday" },
];

const WEEK_OPTIONS = [
  { value: 1, label: "1st" },
  { value: 2, label: "2nd" },
  { value: 3, label: "3rd" },
  { value: 4, label: "4th" },
  { value: 5, label: "5th" },
  { value: -1, label: "Last" },
];

const MONTH_OPTIONS = [
  { value: 1, label: "Jan" },
  { value: 2, label: "Feb" },
  { value: 3, label: "Mar" },
  { value: 4, label: "Apr" },
  { value: 5, label: "May" },
  { value: 6, label: "Jun" },
  { value: 7, label: "Jul" },
  { value: 8, label: "Aug" },
  { value: 9, label: "Sep" },
  { value: 10, label: "Oct" },
  { value: 11, label: "Nov" },
  { value: 12, label: "Dec" },
];

function defaultForm(): SequenceForm {
  return {
    name: "Regular Meetings",
    description: "",
    day_of_week: 6,
    week_of_month: 3,
    months: [1, 3, 6, 9, 11],
    month_overrides: {},
    default_event_time: "18:00",
    default_location: "Mark Masons' Hall",
    default_temple_room: "",
    default_dress_code: "Dark lounge suit",
    default_dining_price: "",
    default_meeting_fee_amount: "",
    default_enable_dining_rsvp: false,
    default_enable_meeting_fee: false,
    default_enable_charity_donation: false,
    default_charity_name: "",
    default_enable_raffle_donation: false,
    default_raffle_description: "",
    default_enable_raffle_wine_pledge: false,
    default_raffle_wine_description: "Bring a bottle of wine for the evening raffle",
    summons_lead_weeks: 6,
    summons_min_lead_weeks: 4,
    auto_draft_summons: true,
  };
}

function formatDateTime(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  return date.toLocaleString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusLabel(status: string) {
  switch (status) {
    case "none":
      return "Not drafted";
    case "draft":
      return "Draft";
    case "approved":
      return "Approved";
    case "sent":
      return "Sent";
    default:
      return status;
  }
}

function statusClass(status: string) {
  switch (status) {
    case "draft":
      return "border-amber-200 bg-amber-50 text-amber-900";
    case "approved":
      return "border-blue-200 bg-blue-50 text-blue-900";
    case "sent":
      return "border-emerald-200 bg-emerald-50 text-emerald-900";
    default:
      return "border-slate-200 bg-slate-50 text-slate-700";
  }
}

export function SequencesClient({
  sequences,
  eventsBySequence,
  databaseConfigured,
}: {
  sequences: SequenceRecord[];
  eventsBySequence: Record<string, SequenceEvent[]>;
  databaseConfigured: boolean;
}) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState<SequenceForm>(defaultForm);
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [generateState, setGenerateState] = useState<{
    open: boolean;
    sequenceId: string | null;
    start: string;
    end: string;
    busy: boolean;
    error: string | null;
    result: { created: number; skipped: number } | null;
  }>(() => {
    const today = new Date();
    return {
      open: false,
      sequenceId: null,
      start: today.toISOString().slice(0, 10),
      end: new Date(today.getFullYear() + 1, today.getMonth(), today.getDate())
        .toISOString()
        .slice(0, 10),
      busy: false,
      error: null,
      result: null,
    };
  });
  const [deleteState, setDeleteState] = useState<{
    open: boolean;
    sequenceId: string | null;
    busy: boolean;
  }>({ open: false, sequenceId: null, busy: false });

  const summary = useMemo(() => {
    const allEvents = Object.values(eventsBySequence).flat();
    const future = allEvents.filter(
      (event) => new Date(event.event_date).getTime() >= Date.now()
    );
    const drafts = future.filter((event) => event.summons_status === "draft").length;
    const approved = future.filter((event) => event.summons_status === "approved").length;
    const sent = future.filter((event) => event.summons_status === "sent").length;
    return {
      sequences: sequences.length,
      activeSequences: sequences.filter((s) => s.active).length,
      futureMeetings: future.length,
      drafts,
      approved,
      sent,
    };
  }, [sequences, eventsBySequence]);

  function toggleMonth(month: number) {
    setCreateForm((current) => {
      const exists = current.months.includes(month);
      const nextMonths = exists
        ? current.months.filter((m) => m !== month)
        : [...current.months, month];
      const nextOverrides = { ...current.month_overrides };
      if (exists) delete nextOverrides[String(month)];
      return {
        ...current,
        months: nextMonths.sort((a, b) => a - b),
        month_overrides: nextOverrides,
      };
    });
  }

  function setMonthOverride(
    month: number,
    field: "week_of_month" | "day_of_week",
    value: number | null
  ) {
    setCreateForm((current) => {
      const key = String(month);
      const existing = current.month_overrides[key] ?? {};
      const next: MonthOverride = { ...existing };
      if (value === null) {
        delete next[field];
      } else {
        next[field] = value;
      }
      const overrides = { ...current.month_overrides };
      if (next.week_of_month === undefined && next.day_of_week === undefined) {
        delete overrides[key];
      } else {
        overrides[key] = next;
      }
      return { ...current, month_overrides: overrides };
    });
  }

  function closeDrawer() {
    setCreateOpen(false);
    setEditingId(null);
    setCreateError(null);
  }

  function openCreate() {
    setEditingId(null);
    setCreateForm(defaultForm());
    setCreateError(null);
    setCreateOpen(true);
  }

  function openEdit(sequence: SequenceRecord) {
    setEditingId(sequence.id);
    setCreateForm({
      name: sequence.name,
      description: sequence.description ?? "",
      day_of_week: sequence.day_of_week,
      week_of_month: sequence.week_of_month,
      months: [...sequence.months].sort((a, b) => a - b),
      month_overrides: { ...(sequence.month_overrides ?? {}) },
      default_event_time: sequence.default_event_time ?? "",
      default_location: sequence.default_location ?? "",
      default_temple_room: sequence.default_temple_room ?? "",
      default_dress_code: sequence.default_dress_code ?? "",
      default_dining_price:
        sequence.default_dining_price !== null
          ? String(sequence.default_dining_price)
          : "",
      default_meeting_fee_amount:
        sequence.default_meeting_fee_amount !== null
          ? String(sequence.default_meeting_fee_amount)
          : "",
      default_enable_dining_rsvp: sequence.default_enable_dining_rsvp,
      default_enable_meeting_fee: sequence.default_enable_meeting_fee,
      default_enable_charity_donation: sequence.default_enable_charity_donation,
      default_charity_name: sequence.default_charity_name ?? "",
      default_enable_raffle_donation: sequence.default_enable_raffle_donation,
      default_raffle_description: sequence.default_raffle_description ?? "",
      default_enable_raffle_wine_pledge: sequence.default_enable_raffle_wine_pledge,
      default_raffle_wine_description:
        sequence.default_raffle_wine_description ??
        "Bring a bottle of wine for the evening raffle",
      summons_lead_weeks: sequence.summons_lead_weeks,
      summons_min_lead_weeks: sequence.summons_min_lead_weeks,
      auto_draft_summons: sequence.auto_draft_summons,
    });
    setCreateError(null);
    setCreateOpen(true);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (createForm.months.length === 0) {
      setCreateError("Pick at least one month.");
      return;
    }
    setCreating(true);
    setCreateError(null);
    const isEdit = editingId !== null;
    const url = isEdit ? `/api/sequences/${editingId}` : "/api/sequences";
    const method = isEdit ? "PATCH" : "POST";
    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...createForm,
          default_dining_price: createForm.default_dining_price || null,
          default_meeting_fee_amount: createForm.default_meeting_fee_amount || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          data.error ??
            (isEdit ? "Could not update sequence." : "Could not create sequence.")
        );
      }
      closeDrawer();
      setCreateForm(defaultForm());
      router.refresh();
    } catch (error) {
      setCreateError(
        error instanceof Error
          ? error.message
          : isEdit
            ? "Could not update sequence."
            : "Could not create sequence."
      );
    } finally {
      setCreating(false);
    }
  }

  async function handleGenerate() {
    if (!generateState.sequenceId) return;
    setGenerateState((current) => ({ ...current, busy: true, error: null }));
    try {
      const res = await fetch(
        `/api/sequences/${generateState.sequenceId}/generate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            start_date: generateState.start,
            end_date: generateState.end,
          }),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error ?? "Could not generate meetings.");
      }
      setGenerateState((current) => ({
        ...current,
        busy: false,
        result: {
          created: Array.isArray(data.created) ? data.created.length : 0,
          skipped: Array.isArray(data.skipped) ? data.skipped.length : 0,
        },
      }));
      router.refresh();
    } catch (error) {
      setGenerateState((current) => ({
        ...current,
        busy: false,
        error:
          error instanceof Error
            ? error.message
            : "Could not generate meetings.",
      }));
    }
  }

  async function handleDelete() {
    if (!deleteState.sequenceId) return;
    setDeleteState((current) => ({ ...current, busy: true }));
    try {
      const res = await fetch(`/api/sequences/${deleteState.sequenceId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Could not delete sequence.");
      }
      setDeleteState({ open: false, sequenceId: null, busy: false });
      router.refresh();
    } catch (error) {
      setDeleteState((current) => ({ ...current, busy: false }));
      window.alert(
        error instanceof Error ? error.message : "Could not delete sequence."
      );
    }
  }

  return (
    <div className="space-y-5 sm:space-y-8">
      <div className="admin-page-head">
        <div>
          <h1 className="admin-page-title">Meeting sequences</h1>
          <p className="admin-page-copy">
            Set the recurring rhythm for your regular meetings (for example,
            third Saturday of January, March, June, September and November).
            Generate the year in one click. Draft summons appear on a schedule.
            Sending always needs a human approval.
          </p>
        </div>
        <Button variant="primary" size="sm" onClick={openCreate}>
          <Plus className="mr-1.5 h-4 w-4" />
          New sequence
        </Button>
      </div>

      {!databaseConfigured ? (
        <Card variant="panel" className="p-6">
          <div className="flex items-start gap-3 text-sm text-dash-text">
            <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-600" />
            <div>
              <p className="font-medium text-dash-text">Database required</p>
              <p className="mt-1 text-dash-muted">
                Sequences are stored per lodge in Supabase. Set the Supabase
                env vars to enable this page.
              </p>
            </div>
          </div>
        </Card>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "Active sequences",
            value: summary.activeSequences,
            hint: `${summary.sequences} total`,
            icon: Sparkles,
            tone: "violet",
          },
          {
            label: "Future meetings linked",
            value: summary.futureMeetings,
            hint: "from sequences",
            icon: Calendar,
            tone: "blue",
          },
          {
            label: "Awaiting approval",
            value: summary.drafts + summary.approved,
            hint: `${summary.drafts} draft, ${summary.approved} approved`,
            icon: FileText,
            tone: "amber",
          },
          {
            label: "Sent",
            value: summary.sent,
            hint: "summons sent",
            icon: ShieldCheck,
            tone: "emerald",
          },
        ].map((kpi) => {
          const Icon = kpi.icon;
          const wrap: Record<string, string> = {
            blue: "bg-blue-500/10 text-blue-600",
            emerald: "bg-emerald-500/10 text-emerald-600",
            violet: "bg-violet-500/10 text-violet-600",
            amber: "bg-amber-500/10 text-amber-700",
          };
          return (
            <Card
              key={kpi.label}
              variant="kpi"
              className="dash-kpi-card h-full rounded-xl p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium uppercase tracking-[0.12em] text-dash-muted">
                    {kpi.label}
                  </p>
                  <p className="mt-2 text-3xl font-semibold tracking-tight text-dash-text">
                    {kpi.value}
                  </p>
                  <p className="mt-2 text-xs text-dash-muted">{kpi.hint}</p>
                </div>
                <div
                  className={cn(
                    "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
                    wrap[kpi.tone]
                  )}
                >
                  <Icon className="h-5 w-5" aria-hidden />
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {sequences.length === 0 ? (
        <Card variant="panel" className="p-10 text-center">
          <Sparkles className="mx-auto h-8 w-8 text-dash-text-faint" />
          <p className="mt-3 text-sm font-medium text-dash-text">
            No sequences yet.
          </p>
          <p className="mt-1 text-sm text-dash-muted">
            Create one to lay out the year. The most common pattern is the
            third Saturday of five months.
          </p>
          <Button className="mt-4" variant="primary" onClick={openCreate}>
            <Plus className="mr-1.5 h-4 w-4" />
            Create your first sequence
          </Button>
        </Card>
      ) : (
        <div className="space-y-4 sm:space-y-6">
          {sequences.map((sequence) => {
            const events = eventsBySequence[sequence.id] ?? [];
            const upcoming = events.filter(
              (event) => new Date(event.event_date).getTime() >= Date.now()
            );
            const past = events.filter(
              (event) => new Date(event.event_date).getTime() < Date.now()
            );
            return (
              <Card key={sequence.id} variant="panel" className="overflow-hidden p-0">
                <div className="dash-panel-header rounded-none border-dash-border bg-dash-surface-subtle">
                  <div className="flex w-full flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="dash-panel-header-title">
                          {sequence.name}
                        </h2>
                        {!sequence.active && (
                          <Badge variant="outline">Paused</Badge>
                        )}
                        {sequence.auto_draft_summons ? (
                          <Badge
                            variant="outline"
                            className="border-violet-200 bg-violet-50 text-violet-900"
                          >
                            Auto-draft
                          </Badge>
                        ) : (
                          <Badge variant="outline">Manual drafts</Badge>
                        )}
                      </div>
                      <p className="dash-panel-header-description">
                        {describeSequence(sequence)}
                        {sequence.default_event_time
                          ? ` at ${sequence.default_event_time}`
                          : ""}
                        {sequence.default_location
                          ? ` · ${sequence.default_location}`
                          : ""}
                      </p>
                      {sequence.description && (
                        <p className="mt-2 text-sm text-dash-text-muted">
                          {sequence.description}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        onClick={() =>
                          setGenerateState((current) => ({
                            ...current,
                            open: true,
                            sequenceId: sequence.id,
                            error: null,
                            result: null,
                          }))
                        }
                      >
                        <Wand2 className="mr-1.5 h-4 w-4" />
                        Generate meetings
                      </Button>
                      <Button
                        type="button"
                        variant="dashboard"
                        size="sm"
                        onClick={() => openEdit(sequence)}
                      >
                        <Pencil className="mr-1.5 h-4 w-4" />
                        Edit
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:bg-red-50 hover:text-red-700"
                        onClick={() =>
                          setDeleteState({
                            open: true,
                            sequenceId: sequence.id,
                            busy: false,
                          })
                        }
                      >
                        <Trash2 className="mr-1.5 h-4 w-4" />
                        Delete
                      </Button>
                    </div>
                  </div>
                </div>
                <div className="grid gap-4 p-5 md:grid-cols-3">
                  <div className="rounded-xl border border-dash-border bg-dash-surface-subtle/40 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-dash-muted">
                      Summons window
                    </p>
                    <p className="mt-2 text-sm text-dash-text">
                      Auto-draft up to{" "}
                      <strong>{sequence.summons_lead_weeks} weeks</strong>{" "}
                      before each meeting.
                    </p>
                    <p className="mt-1 text-xs text-dash-muted">
                      Anything inside {sequence.summons_min_lead_weeks} weeks
                      counts as urgent in the meetings list.
                    </p>
                  </div>
                  <div className="rounded-xl border border-dash-border bg-dash-surface-subtle/40 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-dash-muted">
                      Defaults
                    </p>
                    <p className="mt-2 text-sm text-dash-text">
                      {sequence.default_temple_room
                        ? `${sequence.default_temple_room} · `
                        : ""}
                      {sequence.default_dress_code ?? "No dress code set"}
                    </p>
                    <p className="mt-1 text-xs text-dash-muted">
                      {sequence.default_enable_dining_rsvp
                        ? `Dining £${(sequence.default_dining_price ?? 0).toFixed(2)}`
                        : "Dining off"}
                      {" · "}
                      {sequence.default_enable_meeting_fee
                        ? `Fee £${(sequence.default_meeting_fee_amount ?? 0).toFixed(2)}`
                        : "No fee"}
                    </p>
                  </div>
                  <div className="rounded-xl border border-dash-border bg-dash-surface-subtle/40 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-dash-muted">
                      Approval rule
                    </p>
                    <p className="mt-2 flex items-center gap-2 text-sm text-dash-text">
                      <ShieldCheck className="h-4 w-4 text-emerald-600" />
                      Summons never auto-send.
                    </p>
                    <p className="mt-1 text-xs text-dash-muted">
                      A secretary or master must approve each draft before the
                      send button works.
                    </p>
                  </div>
                </div>

                <div className="space-y-3 border-t border-dash-border p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-dash-text">
                      Upcoming meetings ({upcoming.length})
                    </p>
                    {past.length > 0 && (
                      <p className="text-xs text-dash-muted">
                        {past.length} past
                      </p>
                    )}
                  </div>
                  {upcoming.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-dash-border bg-dash-surface-subtle/40 p-4 text-sm text-dash-muted">
                      No future meetings yet. Use{" "}
                      <strong>Generate meetings</strong> to lay them out.
                    </p>
                  ) : (
                    <ul className="divide-y divide-dash-border rounded-lg border border-dash-border bg-dash-surface">
                      {upcoming.map((event) => (
                        <li
                          key={event.id}
                          className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div>
                            <p className="text-sm font-medium text-dash-text">
                              {event.title}
                            </p>
                            <p className="text-xs text-dash-muted">
                              {formatDateTime(event.event_date)}
                            </p>
                            {event.summons_auto_drafted_at && (
                              <p className="mt-1 flex items-center gap-1 text-xs text-violet-700">
                                <Sparkles className="h-3 w-3" />
                                Drafted{" "}
                                {formatDateTime(event.summons_auto_drafted_at)}
                              </p>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={cn(
                                "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium",
                                statusClass(event.summons_status)
                              )}
                            >
                              {event.summons_status === "sent" ? (
                                <CheckCircle2 className="h-3 w-3" />
                              ) : event.summons_status === "approved" ? (
                                <ShieldCheck className="h-3 w-3" />
                              ) : event.summons_status === "draft" ? (
                                <Clock className="h-3 w-3" />
                              ) : (
                                <XCircle className="h-3 w-3" />
                              )}
                              {statusLabel(event.summons_status)}
                            </span>
                            <Button
                              asChild
                              variant="dashboard"
                              size="sm"
                            >
                              <Link
                                href={`/admin/meetings/${event.id}/summons/edit`}
                              >
                                Open summons
                              </Link>
                            </Button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {createOpen && (
        <div className="admin-drawer-shell fixed inset-0 z-50 flex justify-end">
          <button
            type="button"
            aria-label="Close sequence form"
            className="absolute inset-0 bg-dash-text/20 backdrop-blur-[2px]"
            onClick={closeDrawer}
          />
          <form
            onSubmit={handleSubmit}
            className="admin-drawer-panel relative flex h-full w-full max-w-2xl flex-col overflow-y-auto border-l border-dash-border bg-dash-surface shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-dash-border px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold text-dash-text">
                  {editingId ? "Edit meeting sequence" : "New meeting sequence"}
                </h2>
                <p className="text-sm text-dash-muted">
                  {editingId
                    ? "Update the recipe. Existing generated meetings stay where they are."
                    : "Define the recipe. You can generate the year afterwards."}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={closeDrawer}
              >
                <XCircle className="h-5 w-5" />
              </Button>
            </div>

            <div className="space-y-6 p-6">
              {createError && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                  {createError}
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium text-dash-text">
                  Name
                </label>
                <Input
                  value={createForm.name}
                  required
                  onChange={(event) =>
                    setCreateForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-dash-text">
                  Description
                </label>
                <Textarea
                  rows={2}
                  value={createForm.description}
                  onChange={(event) =>
                    setCreateForm((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-dash-text">
                    Week of month
                  </label>
                  <select
                    className="flex h-11 w-full rounded-xl border border-dash-border bg-dash-surface px-3 py-2 text-sm"
                    value={createForm.week_of_month}
                    onChange={(event) =>
                      setCreateForm((current) => ({
                        ...current,
                        week_of_month: Number(event.target.value),
                      }))
                    }
                  >
                    {WEEK_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-dash-text">
                    Day of week
                  </label>
                  <select
                    className="flex h-11 w-full rounded-xl border border-dash-border bg-dash-surface px-3 py-2 text-sm"
                    value={createForm.day_of_week}
                    onChange={(event) =>
                      setCreateForm((current) => ({
                        ...current,
                        day_of_week: Number(event.target.value),
                      }))
                    }
                  >
                    {DAY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-dash-text">
                  Months ({createForm.months.length})
                </label>
                <div className="flex flex-wrap gap-2">
                  {MONTH_OPTIONS.map((option) => {
                    const selected = createForm.months.includes(option.value);
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => toggleMonth(option.value)}
                        className={cn(
                          "rounded-md border px-3 py-1.5 text-sm transition-colors",
                          selected
                            ? "border-blue-500 bg-blue-50 text-blue-900"
                            : "border-dash-border bg-dash-surface text-dash-muted hover:border-dash-border-strong"
                        )}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
                {createForm.months.length > 0 && (
                  <p className="text-xs text-dash-muted">
                    {describeSequence({
                      day_of_week: createForm.day_of_week,
                      week_of_month: createForm.week_of_month,
                      months: createForm.months,
                      month_overrides: createForm.month_overrides,
                    })}
                  </p>
                )}
              </div>

              {createForm.months.length > 0 && (
                <details className="rounded-xl border border-dash-border bg-dash-surface-subtle/40 p-4">
                  <summary className="cursor-pointer list-none">
                    <span className="text-sm font-medium text-dash-text">
                      Per-month overrides
                    </span>
                    <span className="ml-2 text-xs text-dash-muted">
                      {Object.keys(createForm.month_overrides).length === 0
                        ? "All months use the default above"
                        : `${Object.keys(createForm.month_overrides).length} month${
                            Object.keys(createForm.month_overrides).length === 1
                              ? ""
                              : "s"
                          } differ from the default`}
                    </span>
                  </summary>
                  <p className="mt-2 text-xs text-dash-muted">
                    Use this when a lodge meets on a different week (or
                    weekday) in some months, for example {`"3rd Saturday`} in
                    most months but {`2nd Saturday in June"`}.
                  </p>
                  <div className="mt-3 space-y-2">
                    {createForm.months.map((month) => {
                      const monthLabel =
                        MONTH_OPTIONS.find((m) => m.value === month)?.label ??
                        String(month);
                      const override =
                        createForm.month_overrides[String(month)] ?? {};
                      const weekValue =
                        override.week_of_month !== undefined
                          ? String(override.week_of_month)
                          : "";
                      const dayValue =
                        override.day_of_week !== undefined
                          ? String(override.day_of_week)
                          : "";
                      return (
                        <div
                          key={month}
                          className="grid grid-cols-[4rem_1fr_1fr] items-center gap-2"
                        >
                          <span className="text-sm font-medium text-dash-text">
                            {monthLabel}
                          </span>
                          <select
                            className="flex h-9 w-full rounded-lg border border-dash-border bg-dash-surface px-2 text-sm"
                            value={weekValue}
                            onChange={(event) => {
                              const v = event.target.value;
                              setMonthOverride(
                                month,
                                "week_of_month",
                                v === "" ? null : Number(v)
                              );
                            }}
                          >
                            <option value="">Default week</option>
                            {WEEK_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                          <select
                            className="flex h-9 w-full rounded-lg border border-dash-border bg-dash-surface px-2 text-sm"
                            value={dayValue}
                            onChange={(event) => {
                              const v = event.target.value;
                              setMonthOverride(
                                month,
                                "day_of_week",
                                v === "" ? null : Number(v)
                              );
                            }}
                          >
                            <option value="">Default day</option>
                            {DAY_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      );
                    })}
                  </div>
                </details>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-dash-text">
                    Default time (e.g. 18:00)
                  </label>
                  <Input
                    value={createForm.default_event_time}
                    onChange={(event) =>
                      setCreateForm((current) => ({
                        ...current,
                        default_event_time: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-dash-text">
                    Default location
                  </label>
                  <Input
                    value={createForm.default_location}
                    onChange={(event) =>
                      setCreateForm((current) => ({
                        ...current,
                        default_location: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-dash-text">
                    Default temple room
                  </label>
                  <Input
                    value={createForm.default_temple_room}
                    onChange={(event) =>
                      setCreateForm((current) => ({
                        ...current,
                        default_temple_room: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-dash-text">
                    Default dress code
                  </label>
                  <Input
                    value={createForm.default_dress_code}
                    onChange={(event) =>
                      setCreateForm((current) => ({
                        ...current,
                        default_dress_code: event.target.value,
                      }))
                    }
                  />
                </div>
              </div>

              <div className="space-y-3 rounded-xl border border-dash-border bg-dash-surface-subtle/60 p-4">
                <p className="text-sm font-semibold text-dash-text">
                  Charity, raffle and wine pledge
                </p>
                <p className="text-xs text-dash-muted">
                  Defaults applied when generating meetings. Each meeting can
                  still override these.
                </p>

                <label className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 rounded border-input text-blue-600"
                    checked={createForm.default_enable_charity_donation}
                    onChange={(event) =>
                      setCreateForm((current) => ({
                        ...current,
                        default_enable_charity_donation: event.target.checked,
                      }))
                    }
                  />
                  <span className="text-sm text-dash-text">
                    Offer a charity donation on the summons RSVP.
                  </span>
                </label>
                {createForm.default_enable_charity_donation && (
                  <div className="space-y-2 pl-7">
                    <label className="text-xs font-medium text-dash-muted">
                      Default charity name
                    </label>
                    <Input
                      value={createForm.default_charity_name}
                      placeholder="e.g. Mark Benevolent Fund"
                      onChange={(event) =>
                        setCreateForm((current) => ({
                          ...current,
                          default_charity_name: event.target.value,
                        }))
                      }
                    />
                  </div>
                )}

                <label className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 rounded border-input text-blue-600"
                    checked={createForm.default_enable_raffle_donation}
                    onChange={(event) =>
                      setCreateForm((current) => ({
                        ...current,
                        default_enable_raffle_donation: event.target.checked,
                      }))
                    }
                  />
                  <span className="text-sm text-dash-text">
                    Collect cash contributions for the evening raffle.
                  </span>
                </label>
                {createForm.default_enable_raffle_donation && (
                  <div className="space-y-2 pl-7">
                    <label className="text-xs font-medium text-dash-muted">
                      Raffle description shown on RSVP
                    </label>
                    <Input
                      value={createForm.default_raffle_description}
                      placeholder="Help fund evening raffle prizes"
                      onChange={(event) =>
                        setCreateForm((current) => ({
                          ...current,
                          default_raffle_description: event.target.value,
                        }))
                      }
                    />
                  </div>
                )}

                <label className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 rounded border-input text-blue-600"
                    checked={createForm.default_enable_raffle_wine_pledge}
                    onChange={(event) =>
                      setCreateForm((current) => ({
                        ...current,
                        default_enable_raffle_wine_pledge: event.target.checked,
                      }))
                    }
                  />
                  <span className="text-sm text-dash-text">
                    Let attendees pledge a bottle of wine for the raffle (no
                    payment).
                  </span>
                </label>
                {createForm.default_enable_raffle_wine_pledge && (
                  <div className="space-y-2 pl-7">
                    <label className="text-xs font-medium text-dash-muted">
                      Wine pledge description shown on RSVP
                    </label>
                    <Input
                      value={createForm.default_raffle_wine_description}
                      placeholder="Bring a bottle of wine for the evening raffle"
                      onChange={(event) =>
                        setCreateForm((current) => ({
                          ...current,
                          default_raffle_wine_description: event.target.value,
                        }))
                      }
                    />
                  </div>
                )}
              </div>

              <div className="space-y-3 rounded-xl border border-dash-border bg-dash-surface-subtle/60 p-4">
                <p className="text-sm font-semibold text-dash-text">
                  Summons workflow
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-dash-text">
                      Auto-draft window (weeks)
                    </label>
                    <Input
                      type="number"
                      min={1}
                      max={26}
                      value={createForm.summons_lead_weeks}
                      onChange={(event) =>
                        setCreateForm((current) => ({
                          ...current,
                          summons_lead_weeks: Number(event.target.value || 0),
                        }))
                      }
                    />
                    <p className="text-xs text-dash-muted">
                      Drafts are created up to this many weeks before each
                      meeting.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-dash-text">
                      Urgent threshold (weeks)
                    </label>
                    <Input
                      type="number"
                      min={1}
                      max={26}
                      value={createForm.summons_min_lead_weeks}
                      onChange={(event) =>
                        setCreateForm((current) => ({
                          ...current,
                          summons_min_lead_weeks: Number(
                            event.target.value || 0
                          ),
                        }))
                      }
                    />
                    <p className="text-xs text-dash-muted">
                      Inside this window, missing drafts get flagged as urgent.
                    </p>
                  </div>
                </div>
                <label className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 rounded border-input text-blue-600"
                    checked={createForm.auto_draft_summons}
                    onChange={(event) =>
                      setCreateForm((current) => ({
                        ...current,
                        auto_draft_summons: event.target.checked,
                      }))
                    }
                  />
                  <span className="text-sm text-dash-text">
                    Auto-create draft summons in the window above. Sends still
                    require an explicit Approve action.
                  </span>
                </label>
              </div>
            </div>

            <div className="sticky bottom-0 flex items-center justify-end gap-3 border-t border-dash-border bg-dash-surface px-6 py-4">
              <Button type="button" variant="ghost" onClick={closeDrawer}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={creating}>
                {creating
                  ? editingId
                    ? "Saving..."
                    : "Creating..."
                  : editingId
                    ? "Save changes"
                    : "Create sequence"}
              </Button>
            </div>
          </form>
        </div>
      )}

      {generateState.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Close generate dialog"
            className="absolute inset-0 bg-dash-text/30 backdrop-blur-[2px]"
            onClick={() =>
              !generateState.busy &&
              setGenerateState((current) => ({ ...current, open: false }))
            }
          />
          <div className="relative w-full max-w-md rounded-2xl border border-dash-border bg-dash-surface p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-dash-text">
              Generate meetings from sequence
            </h3>
            <p className="mt-1 text-sm text-dash-muted">
              Creates one event per matching date in the range, linked to this
              sequence. Existing dates are skipped.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-medium text-dash-muted">
                  Start date
                </label>
                <Input
                  type="date"
                  value={generateState.start}
                  onChange={(event) =>
                    setGenerateState((current) => ({
                      ...current,
                      start: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-dash-muted">
                  End date
                </label>
                <Input
                  type="date"
                  value={generateState.end}
                  onChange={(event) =>
                    setGenerateState((current) => ({
                      ...current,
                      end: event.target.value,
                    }))
                  }
                />
              </div>
            </div>
            {generateState.error && (
              <p className="mt-3 text-sm text-red-700">{generateState.error}</p>
            )}
            {generateState.result && (
              <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
                Created {generateState.result.created} meeting
                {generateState.result.created === 1 ? "" : "s"}.{" "}
                {generateState.result.skipped} skipped (already present).
              </p>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                disabled={generateState.busy}
                onClick={() =>
                  setGenerateState((current) => ({ ...current, open: false }))
                }
              >
                Close
              </Button>
              <Button
                type="button"
                variant="primary"
                disabled={generateState.busy}
                onClick={handleGenerate}
              >
                {generateState.busy ? "Generating..." : "Generate"}
              </Button>
            </div>
          </div>
        </div>
      )}

      <ConfirmActionDialog
        open={deleteState.open}
        onOpenChange={(open) =>
          setDeleteState((current) => ({ ...current, open }))
        }
        title="Delete sequence?"
        description="The sequence is removed. Meetings already generated stay in the calendar but lose their sequence link."
        confirmLabel={deleteState.busy ? "Deleting..." : "Delete"}
        loading={deleteState.busy}
        onConfirm={handleDelete}
      />
    </div>
  );
}
