"use client";

import { useState, useMemo } from "react";
import { formatDate, cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  ChevronLeft,
  ChevronRight,
  CircleDot,
  CheckCircle2,
  XCircle,
} from "lucide-react";

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
  published: boolean;
};

type RsvpEntry = {
  id: string;
  user_name: string;
  user_email: string;
  status: string;
};

type View = "list" | "calendar";

const MEETING_TYPES = [
  "regular_meeting",
  "lodge_meeting",
  "installation",
  "lodge_of_instruction",
  "committee",
  "emergency",
];

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
}: {
  meetings: MeetingEvent[];
  rsvpMap: Record<string, RsvpEntry[]>;
}) {
  const [view, setView] = useState<View>("list");
  const [typeFilter, setTypeFilter] = useState("all");
  const [selectedMeeting, setSelectedMeeting] = useState<string | null>(null);
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

  const selectedEvent = selectedMeeting
    ? meetings.find((m) => m.id === selectedMeeting)
    : null;
  const selectedRsvps = selectedMeeting ? (rsvpMap[selectedMeeting] ?? []) : [];

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
        : "—",
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
            Lodge meetings, installation ceremonies, and committee sessions.
          </p>
        </div>
      </div>

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
              onClick={() => setView("list")}
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
              onClick={() => setView("calendar")}
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
        <div className="grid gap-6 xl:grid-cols-3">
          <Card variant="panel" className="xl:col-span-2 space-y-4 overflow-hidden p-0">
            <div className="dash-panel-header rounded-none border-dash-border bg-dash-surface-subtle">
              <div>
                <h2 className="dash-panel-header-title">Meetings list</h2>
                <p className="dash-panel-header-description">
                  Upcoming and past — select a row for attendance.
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
                          isSelected={selectedMeeting === m.id}
                          onSelect={() =>
                            setSelectedMeeting(selectedMeeting === m.id ? null : m.id)
                          }
                          rsvpCount={(rsvpMap[m.id] ?? []).length}
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
                          isSelected={selectedMeeting === m.id}
                          onSelect={() =>
                            setSelectedMeeting(selectedMeeting === m.id ? null : m.id)
                          }
                          rsvpCount={(rsvpMap[m.id] ?? []).length}
                          isPast
                        />
                      ))}
                    </>
                  )}
                </>
              )}
            </div>
          </Card>

          <div>
            {selectedEvent ? (
              <Card variant="panel" className="sticky top-6 overflow-hidden p-0">
                <div className="dash-panel-header rounded-none border-dash-border bg-dash-surface-subtle">
                  <div>
                    <h2 className="dash-panel-header-title line-clamp-2">{selectedEvent.title}</h2>
                    <p className="dash-panel-header-description">
                      {formatDate(selectedEvent.event_date)}
                    </p>
                  </div>
                </div>
                <div className="space-y-4 p-5">
                  {selectedEvent.location && (
                    <div className="flex items-center gap-2 text-sm text-dash-text-muted">
                      <MapPin className="h-4 w-4 text-dash-text-faint" /> {selectedEvent.location}
                    </div>
                  )}
                  {selectedEvent.event_time && (
                    <div className="flex items-center gap-2 text-sm text-dash-text-muted">
                      <Clock className="h-4 w-4 text-dash-text-faint" /> {selectedEvent.event_time}
                    </div>
                  )}
                  {selectedEvent.dress_code && (
                    <div className="flex items-center gap-2 text-sm text-dash-text-muted">
                      <CircleDot className="h-4 w-4 text-dash-text-faint" />{" "}
                      {selectedEvent.dress_code}
                    </div>
                  )}

                  <div>
                    <h3 className="mb-3 text-sm font-medium text-dash-text">
                      Attendance ({selectedRsvps.length})
                    </h3>
                    {selectedRsvps.length === 0 ? (
                      <p className="text-xs text-dash-text-muted">No RSVPs yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {selectedRsvps.map((r) => (
                          <div
                            key={r.id}
                            className="flex items-center justify-between rounded-lg border border-dash-border bg-dash-surface-subtle/60 px-3 py-2"
                          >
                            <div>
                              <p className="text-sm text-dash-text">{r.user_name}</p>
                              <p className="text-xs text-dash-text-muted">{r.user_email}</p>
                            </div>
                            {r.status === "confirmed" ? (
                              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                            ) : (
                              <XCircle className="h-4 w-4 text-dash-text-faint" />
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            ) : (
              <Card variant="panel" className="overflow-hidden p-0">
                <div className="dash-panel-header rounded-none border-dash-border bg-dash-surface-subtle">
                  <div>
                    <h2 className="dash-panel-header-title">Attendance</h2>
                    <p className="dash-panel-header-description">
                      Select a meeting from the list.
                    </p>
                  </div>
                </div>
                <div className="p-8 text-center">
                  <Users className="mx-auto h-8 w-8 text-dash-text-faint" />
                  <p className="mt-3 text-sm text-dash-text-muted">
                    Select a meeting to view attendance.
                  </p>
                </div>
              </Card>
            )}
          </div>
        </div>
      )}

      {view === "calendar" && (
        <Card variant="panel" className="overflow-hidden p-0">
          <div className="dash-panel-header rounded-none border-dash-border bg-dash-surface-subtle">
            <div>
              <h2 className="dash-panel-header-title">Calendar</h2>
              <p className="dash-panel-header-description">
                Click a meeting chip to jump to list view.
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
                        onClick={() => {
                          setSelectedMeeting(m.id);
                          setView("list");
                        }}
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
}: {
  meeting: MeetingEvent;
  typeColor: Record<string, string>;
  typeLabel: (t: string) => string;
  isSelected: boolean;
  onSelect: () => void;
  rsvpCount: number;
  isPast?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex w-full items-center gap-4 rounded-xl border p-4 text-left transition-all",
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
      <div className="flex shrink-0 items-center gap-3">
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
      </div>
    </button>
  );
}
