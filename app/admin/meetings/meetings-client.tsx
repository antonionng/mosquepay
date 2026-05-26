"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useMemo } from "react";
import type { FormEvent } from "react";
import { formatDate, cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Clock,
  MapPin,
  Users,
  Calendar,
  Plus,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  CheckCircle2,
  Copy,
  AlertTriangle,
} from "lucide-react";
import {
  type MeetingReadiness,
  READINESS_CLASSES,
} from "@/lib/meetings/readiness";
import {
  MEETING_TYPES,
  MeetingFormDrawer,
  emptyMeetingForm,
  formatMoneyInput,
  formFromMeeting,
  slugify,
  type MeetingForm,
} from "./meeting-form";

type MeetingEvent = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  event_type: string;
  event_date: string;
  event_time: string | null;
  location: string | null;
  temple_room: string | null;
  dress_code: string | null;
  enable_rsvp: boolean;
  rsvp_deadline: string | null;
  max_attendees: number | null;
  enable_payments: boolean;
  enable_dining_rsvp: boolean;
  dining_price: number | null;
  dining_description: string | null;
  dining_waived_for_all: boolean;
  enable_charity_donation: boolean;
  charity_name: string | null;
  charity_description: string | null;
  enable_meeting_fee: boolean;
  meeting_fee_amount: number | null;
  meeting_fee_description: string | null;
  enable_guest_tickets: boolean;
  guest_ticket_price: number | null;
  guest_ticket_description: string | null;
  published: boolean;
};

type RsvpEntry = {
  id: string;
  user_name: string;
  user_email: string;
  user_phone: string | null;
  status: string;
  attending_ceremony: boolean;
  attending_dining: boolean;
  number_of_guests: number;
  dietary_requirements: string | null;
  special_requests: string | null;
  payment_required: boolean;
  payment_completed: boolean;
};

type View = "list" | "calendar";
type WorkflowTab = "calendar" | "meetings" | "summons" | "rsvps";

type KpiAccent = "blue" | "emerald" | "violet" | "amber";

const kpiAccentIcon: Record<KpiAccent, { wrap: string; icon: string }> = {
  blue: { wrap: "bg-blue-500/10", icon: "text-blue-600" },
  emerald: { wrap: "bg-emerald-500/10", icon: "text-emerald-600" },
  violet: { wrap: "bg-violet-500/10", icon: "text-violet-600" },
  amber: { wrap: "bg-amber-500/10", icon: "text-amber-700" },
};

export function AdminMeetingsClient({
  meetings,
  rsvpMap,
  readinessMap,
}: {
  meetings: MeetingEvent[];
  rsvpMap: Record<string, RsvpEntry[]>;
  readinessMap: Record<string, MeetingReadiness>;
}) {
  const router = useRouter();
  const [view, setView] = useState<View>("list");
  const [workflowTab, setWorkflowTab] = useState<WorkflowTab>("meetings");
  const [typeFilter, setTypeFilter] = useState("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editingMeetingId, setEditingMeetingId] = useState<string | null>(null);
  const [meetingForm, setMeetingForm] = useState<MeetingForm>(() => emptyMeetingForm());
  const [formError, setFormError] = useState<string | null>(null);
  const [formSaving, setFormSaving] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const filteredMeetings = useMemo(() => {
    if (typeFilter === "all") return meetings;
    return meetings.filter((m) => m.event_type === typeFilter);
  }, [meetings, typeFilter]);

  const upcomingMeetings = filteredMeetings.filter(
    (m) => new Date(m.event_date) >= new Date()
  );
  const pastMeetings = filteredMeetings.filter(
    (m) => new Date(m.event_date) < new Date()
  );

  const calendarDays = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const startOffset = firstDay === 0 ? 6 : firstDay - 1;

    const days: Array<{ date: number; isCurrentMonth: boolean; meetings: MeetingEvent[] }> = [];

    for (let i = 0; i < startOffset; i++) {
      const prevDate = new Date(year, month, -startOffset + i + 1);
      days.push({ date: prevDate.getDate(), isCurrentMonth: false, meetings: [] });
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dayMeetings = meetings.filter((m) => {
        const md = new Date(m.event_date);
        return md.getFullYear() === year && md.getMonth() === month && md.getDate() === d;
      });
      days.push({ date: d, isCurrentMonth: true, meetings: dayMeetings });
    }

    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      days.push({ date: i, isCurrentMonth: false, meetings: [] });
    }

    return days;
  }, [calendarMonth, meetings]);

  const typeLabel = (t: string) =>
    t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  function selectWorkflowTab(tab: WorkflowTab) {
    setWorkflowTab(tab);
    setView(tab === "calendar" ? "calendar" : "list");
  }

  function openNewMeetingForm() {
    setEditingMeetingId(null);
    setFormError(null);
    setFormOpen(true);
    void (async () => {
      const base = emptyMeetingForm();
      try {
        const res = await fetch("/api/settings/lodge-fees");
        if (res.ok) {
          const data = await res.json();
          const fees = data.fees ?? {};
          setMeetingForm({
            ...base,
            enable_meeting_fee: fees.default_member_levy_amount != null,
            meeting_fee_amount: formatMoneyInput(fees.default_member_levy_amount),
            enable_guest_tickets: fees.default_guest_dining_amount != null,
            guest_ticket_price: formatMoneyInput(fees.default_guest_dining_amount),
            enable_dining_rsvp: fees.default_member_dining_amount != null,
            dining_price: formatMoneyInput(fees.default_member_dining_amount),
            enable_payments:
              fees.default_member_levy_amount != null ||
              fees.default_guest_dining_amount != null ||
              fees.default_member_dining_amount != null,
          });
          return;
        }
      } catch {
        /* use empty defaults */
      }
      setMeetingForm(base);
    })();
  }

  function openEditMeetingForm(meeting: MeetingEvent) {
    setEditingMeetingId(meeting.id);
    setMeetingForm(formFromMeeting(meeting));
    setFormError(null);
    setFormOpen(true);
  }

  function updateMeetingForm(updates: Partial<MeetingForm>) {
    setMeetingForm((current) => ({ ...current, ...updates }));
  }

  async function handleMeetingSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormSaving(true);
    setFormError(null);

    const payload = {
      ...meetingForm,
      slug: meetingForm.slug || slugify(meetingForm.title),
      event_time: meetingForm.event_time || null,
      dining_price: meetingForm.dining_price || null,
      meeting_fee_amount: meetingForm.meeting_fee_amount || null,
      guest_ticket_price: meetingForm.guest_ticket_price || null,
      max_attendees: meetingForm.max_attendees || null,
      rsvp_deadline: meetingForm.rsvp_deadline || null,
    };

    try {
      const res = await fetch(
        editingMeetingId ? `/api/events/${editingMeetingId}` : "/api/events",
        {
          method: editingMeetingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to save meeting");
      }
      setFormOpen(false);
      setEditingMeetingId(null);
      router.refresh();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Could not save meeting.");
    } finally {
      setFormSaving(false);
    }
  }

  async function duplicateMeeting(meeting: MeetingEvent) {
    const newDateInput =
      typeof window !== "undefined"
        ? window.prompt(
            `Duplicate "${meeting.title}". Enter the new meeting date (YYYY-MM-DD):`,
            new Date().toISOString().slice(0, 10)
          )
        : null;
    if (!newDateInput) return;
    const baseSlug = meeting.slug.replace(/-\d{4}-\d{2}-\d{2}$/, "");
    const payload = {
      ...formFromMeeting(meeting),
      title: meeting.title,
      slug: `${baseSlug}-${newDateInput}`,
      event_date: newDateInput,
      published: false,
      dining_price: formatMoneyInput(meeting.dining_price),
      meeting_fee_amount: formatMoneyInput(meeting.meeting_fee_amount),
      guest_ticket_price: formatMoneyInput(meeting.guest_ticket_price),
      max_attendees: meeting.max_attendees?.toString() ?? "",
      rsvp_deadline: "",
    };
    try {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        window.alert(data.error ?? "Could not duplicate meeting.");
        return;
      }
      router.refresh();
    } catch (err) {
      console.error("duplicate meeting failed", err);
      window.alert("Could not duplicate meeting.");
    }
  }

  const typeColor: Record<string, string> = {
    regular_meeting: "bg-blue-500",
    lodge_meeting: "bg-blue-500",
    installation: "bg-purple-500",
    lodge_of_instruction: "bg-cyan-500",
    committee: "bg-amber-500",
    emergency: "bg-rose-500",
  };

  const kpis: Array<{
    label: string;
    value: string;
    hint: string;
    icon: typeof Calendar;
    accent: KpiAccent;
  }> = [
    {
      label: "Upcoming",
      value: String(upcomingMeetings.length),
      hint: "meetings scheduled",
      icon: Calendar,
      accent: "blue",
    },
    {
      label: "Past",
      value: String(pastMeetings.length),
      hint: "completed this year",
      icon: CheckCircle2,
      accent: "emerald",
    },
    {
      label: "Next meeting",
      value: upcomingMeetings[0]?.title ?? "None",
      hint: upcomingMeetings[0]
        ? formatDate(upcomingMeetings[0].event_date)
        : "Not scheduled",
      icon: Clock,
      accent: "violet",
    },
    {
      label: "Total this year",
      value: String(meetings.length),
      hint: "across all types",
      icon: CircleDot,
      accent: "amber",
    },
  ];

  return (
    <div className="space-y-8">
      <div className="admin-page-head">
        <div>
          <h1 className="admin-page-title">Meetings</h1>
          <p className="admin-page-copy">
            Calendar, lodge meetings, summons, and attendance in one place.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="dashboard" size="sm">
            <Link href="/admin/sequences">Sequences</Link>
          </Button>
          <Button variant="primary" size="sm" onClick={openNewMeetingForm}>
            <Plus className="mr-1.5 h-4 w-4" />
            New Meeting
          </Button>
        </div>
      </div>

      <Tabs value={workflowTab} onValueChange={(value) => selectWorkflowTab(value as WorkflowTab)}>
        <TabsList>
          <TabsTrigger value="calendar">Calendar</TabsTrigger>
          <TabsTrigger value="meetings">Meetings</TabsTrigger>
          <TabsTrigger value="summons">Summons</TabsTrigger>
          <TabsTrigger value="rsvps">RSVPs</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((k) => {
          const Icon = k.icon;
          const ac = kpiAccentIcon[k.accent];
          const isTitleKpi = k.label === "Next meeting";
          return (
            <Card
              key={k.label}
              variant="kpi"
              className="dash-kpi-card h-full rounded-xl p-5 hover:border-dash-border-strong"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium uppercase tracking-[0.12em] text-dash-muted [.dash-kpi-card_&]:text-dash-muted">
                    {k.label}
                  </p>
                  <p
                    className={cn(
                      "mt-2 font-semibold tracking-tight text-dash-text [.dash-kpi-card_&]:text-dash-text",
                      isTitleKpi ? "line-clamp-2 text-lg" : "text-3xl"
                    )}
                  >
                    {k.value}
                  </p>
                  <p className="mt-2 text-xs text-dash-muted">{k.hint}</p>
                </div>
                <div
                  className={cn(
                    "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
                    ac.wrap
                  )}
                >
                  <Icon className={cn("h-5 w-5", ac.icon)} aria-hidden />
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <div className="dash-filter-bar flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-dash-muted">
            View
          </span>
          <div className="flex items-center gap-1 rounded-xl border border-dash-border bg-dash-surface-subtle p-1">
            <Button
              type="button"
              variant={view === "list" ? "secondary" : "ghost"}
              size="sm"
              className={cn(
                "rounded-lg px-4",
                view === "list"
                  ? "bg-dash-surface text-dash-text shadow-sm"
                  : "text-dash-muted hover:bg-dash-surface hover:text-dash-text"
              )}
              onClick={() => {
                setView("list");
                if (workflowTab === "calendar") setWorkflowTab("meetings");
              }}
            >
              List
            </Button>
            <Button
              type="button"
              variant={view === "calendar" ? "secondary" : "ghost"}
              size="sm"
              className={cn(
                "rounded-lg px-4",
                view === "calendar"
                  ? "bg-dash-surface text-dash-text shadow-sm"
                  : "text-dash-muted hover:bg-dash-surface hover:text-dash-text"
              )}
              onClick={() => selectWorkflowTab("calendar")}
            >
              Calendar
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:min-w-[200px]">
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-dash-muted">
            Type
          </span>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="h-10 flex-1 border-dash-border bg-dash-surface text-dash-text">
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {MEETING_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {typeLabel(t)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {view === "list" && (
        <div className="space-y-6">
          <Card variant="panel" className="space-y-4 overflow-hidden p-0">
            <div className="dash-panel-header rounded-none border-dash-border bg-dash-surface-subtle">
              <div>
                <h2 className="dash-panel-header-title">Meetings list</h2>
                <p className="dash-panel-header-description">
                  Upcoming and past. Click a row to open the meeting record.
                </p>
              </div>
            </div>
            <div className="space-y-3 p-4 md:p-5">
              {filteredMeetings.length === 0 ? (
                <div className="rounded-xl border border-dash-border bg-dash-surface-subtle/50 py-12 text-center">
                  <Calendar className="mx-auto h-8 w-8 text-dash-text-faint" />
                  <p className="mt-3 text-sm text-dash-text-muted">No meetings found.</p>
                </div>
              ) : (
                <>
                  {upcomingMeetings.length > 0 && (
                    <>
                      <p className="px-1 text-xs font-semibold uppercase tracking-wider text-dash-text-muted">
                        Upcoming
                      </p>
                      {upcomingMeetings.map((m) => (
                        <MeetingCard
                          key={m.id}
                          meeting={m}
                          typeColor={typeColor}
                          typeLabel={typeLabel}
                          isSelected={false}
                          onSelect={() =>
                            router.push(`/admin/meetings/${m.id}`)
                          }
                          rsvpCount={(rsvpMap[m.id] ?? []).length}
                          readiness={readinessMap[m.id]}
                          onDuplicate={() => duplicateMeeting(m)}
                        />
                      ))}
                    </>
                  )}
                  {pastMeetings.length > 0 && (
                    <>
                      <p className="mt-4 px-1 text-xs font-semibold uppercase tracking-wider text-dash-text-muted">
                        Past
                      </p>
                      {pastMeetings.map((m) => (
                        <MeetingCard
                          key={m.id}
                          meeting={m}
                          typeColor={typeColor}
                          typeLabel={typeLabel}
                          isSelected={false}
                          onSelect={() =>
                            router.push(`/admin/meetings/${m.id}`)
                          }
                          rsvpCount={(rsvpMap[m.id] ?? []).length}
                          readiness={readinessMap[m.id]}
                          onDuplicate={() => duplicateMeeting(m)}
                          isPast
                        />
                      ))}
                    </>
                  )}
                </>
              )}
            </div>
          </Card>

        </div>
      )}

      {view === "calendar" && (
        <Card variant="panel" className="overflow-hidden p-0">
          <div className="dash-panel-header rounded-none border-dash-border bg-dash-surface-subtle">
            <div>
              <h2 className="dash-panel-header-title">Calendar</h2>
              <p className="dash-panel-header-description">
                Click a meeting chip to open its record.
              </p>
            </div>
          </div>
          <div className="p-5 md:p-6">
            <div className="mb-6 flex items-center justify-between">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-8 w-8 border-dash-border bg-dash-surface text-dash-text-muted hover:bg-dash-surface-subtle hover:text-dash-text"
                onClick={() =>
                  setCalendarMonth(
                    new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1)
                  )
                }
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <h3 className="text-lg font-semibold text-dash-text">
                {calendarMonth.toLocaleDateString("en-GB", {
                  month: "long",
                  year: "numeric",
                })}
              </h3>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-8 w-8 border-dash-border bg-dash-surface text-dash-text-muted hover:bg-dash-surface-subtle hover:text-dash-text"
                onClick={() =>
                  setCalendarMonth(
                    new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1)
                  )
                }
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            <div className="grid grid-cols-7 gap-px">
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                <div
                  key={d}
                  className="pb-3 text-center text-xs font-medium text-dash-text-muted"
                >
                  {d}
                </div>
              ))}
              {calendarDays.map((day, i) => {
                const today = new Date();
                const isToday =
                  day.isCurrentMonth &&
                  day.date === today.getDate() &&
                  calendarMonth.getMonth() === today.getMonth() &&
                  calendarMonth.getFullYear() === today.getFullYear();

                return (
                  <div
                    key={i}
                    className={cn(
                      "min-h-[80px] rounded-lg border p-2 transition-colors",
                      day.isCurrentMonth
                        ? "border-dash-border bg-dash-surface-subtle/40"
                        : "border-transparent bg-transparent"
                    )}
                  >
                    <span
                      className={cn(
                        "text-xs",
                        day.isCurrentMonth ? "text-dash-text-muted" : "text-dash-text-faint/70",
                        isToday && "font-bold text-dash-ring"
                      )}
                    >
                      {day.date}
                    </span>
                    {day.meetings.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => router.push(`/admin/meetings/${m.id}`)}
                        className={cn(
                          "mt-1 w-full cursor-pointer truncate rounded px-1.5 py-0.5 text-left text-[10px] font-medium text-white",
                          typeColor[m.event_type] ?? "bg-slate-500"
                        )}
                      >
                        {m.title}
                      </button>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        </Card>
      )}

      <MeetingFormDrawer
        open={formOpen}
        editing={Boolean(editingMeetingId)}
        form={meetingForm}
        formError={formError}
        formSaving={formSaving}
        typeLabel={typeLabel}
        updateForm={updateMeetingForm}
        onClose={() => setFormOpen(false)}
        onSubmit={handleMeetingSubmit}
      />
    </div>
  );
}

function MeetingCard({
  meeting,
  typeColor,
  typeLabel,
  isSelected,
  onSelect,
  rsvpCount,
  isPast,
  readiness,
  onDuplicate,
}: {
  meeting: MeetingEvent;
  typeColor: Record<string, string>;
  typeLabel: (t: string) => string;
  isSelected: boolean;
  onSelect: () => void;
  rsvpCount: number;
  isPast?: boolean;
  readiness?: MeetingReadiness;
  onDuplicate?: () => void;
}) {
  return (
    <div
      onClick={onSelect}
      className={cn(
        "group flex w-full cursor-pointer flex-col gap-3 rounded-xl border p-4 text-left transition-all sm:flex-row sm:items-center sm:gap-4",
        isSelected
          ? "border-dash-ring/40 bg-dash-ring/5 shadow-sm"
          : "border-dash-border bg-dash-surface hover:border-dash-border-strong hover:shadow-sm",
        isPast && "opacity-70"
      )}
    >
      <div className="flex h-12 w-12 flex-col items-center justify-center rounded-xl bg-dash-surface-subtle">
        <span className="text-[10px] font-medium leading-none text-dash-text-muted">
          {new Date(meeting.event_date).toLocaleDateString("en-GB", { month: "short" })}
        </span>
        <span className="mt-0.5 text-lg font-bold leading-none text-dash-text">
          {new Date(meeting.event_date).getDate()}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-dash-text">{meeting.title}</p>
        <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-dash-text-muted">
          {meeting.location && (
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3" /> {meeting.location}
            </span>
          )}
          {meeting.event_time && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" /> {meeting.event_time}
            </span>
          )}
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {!isPast && readiness && (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium",
              READINESS_CLASSES[readiness.status]
            )}
            title={readiness.issues.map((i) => i.message).join(" • ")}
          >
            {readiness.status === "ready" ? (
              <CheckCircle2 className="h-3 w-3" />
            ) : (
              <AlertTriangle className="h-3 w-3" />
            )}
            {readiness.label}
          </span>
        )}
        <span className="flex items-center gap-1 text-xs text-dash-text-muted">
          <Users className="h-3.5 w-3.5" /> {rsvpCount}
        </span>
        <div className="flex items-center gap-1.5">
          <div
            className={cn("h-2 w-2 rounded-full", typeColor[meeting.event_type] ?? "bg-slate-400")}
          />
          <Badge variant="outline" className="border-dash-border font-normal text-dash-text-muted">
            {typeLabel(meeting.event_type)}
          </Badge>
        </div>
        {onDuplicate && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100"
            aria-label="Duplicate meeting"
            onClick={(e) => {
              e.stopPropagation();
              onDuplicate();
            }}
          >
            <Copy className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}
