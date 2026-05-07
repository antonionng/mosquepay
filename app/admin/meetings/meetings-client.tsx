"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useMemo } from "react";
import type { FormEvent } from "react";
import { formatDate, cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  Pencil,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  CheckCircle2,
  XCircle,
  Copy,
  Download,
  AlertTriangle,
  ArrowLeft,
  ArrowRight as ArrowRightIcon,
} from "lucide-react";
import {
  type MeetingReadiness,
  READINESS_CLASSES,
} from "@/lib/meetings/readiness";

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

const MEETING_TYPES = [
  "regular_meeting",
  "lodge_meeting",
  "installation",
  "lodge_of_instruction",
  "committee",
  "emergency",
];

type MeetingForm = {
  title: string;
  slug: string;
  description: string;
  event_type: string;
  event_date: string;
  event_time: string;
  location: string;
  temple_room: string;
  dress_code: string;
  enable_rsvp: boolean;
  rsvp_deadline: string;
  max_attendees: string;
  enable_payments: boolean;
  enable_dining_rsvp: boolean;
  dining_price: string;
  dining_description: string;
  enable_charity_donation: boolean;
  charity_name: string;
  charity_description: string;
  enable_meeting_fee: boolean;
  meeting_fee_amount: string;
  meeting_fee_description: string;
  enable_guest_tickets: boolean;
  guest_ticket_price: string;
  guest_ticket_description: string;
  published: boolean;
};

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function dateInput(value: string | null) {
  return value ? new Date(value).toISOString().slice(0, 10) : "";
}

function emptyMeetingForm(): MeetingForm {
  return {
    title: "",
    slug: "",
    description: "",
    event_type: "lodge_meeting",
    event_date: "",
    event_time: "",
    location: "Mark Masons' Hall",
    temple_room: "",
    dress_code: "",
    enable_rsvp: true,
    rsvp_deadline: "",
    max_attendees: "",
    enable_payments: false,
    enable_dining_rsvp: false,
    dining_price: "",
    dining_description: "",
    enable_charity_donation: false,
    charity_name: "",
    charity_description: "",
    enable_meeting_fee: false,
    meeting_fee_amount: "",
    meeting_fee_description: "",
    enable_guest_tickets: false,
    guest_ticket_price: "",
    guest_ticket_description: "",
    published: true,
  };
}

function formFromMeeting(meeting: MeetingEvent): MeetingForm {
  return {
    title: meeting.title,
    slug: meeting.slug,
    description: meeting.description ?? "",
    event_type: meeting.event_type,
    event_date: dateInput(meeting.event_date),
    event_time: meeting.event_time ?? "",
    location: meeting.location ?? "",
    temple_room: meeting.temple_room ?? "",
    dress_code: meeting.dress_code ?? "",
    enable_rsvp: meeting.enable_rsvp,
    rsvp_deadline: dateInput(meeting.rsvp_deadline),
    max_attendees: meeting.max_attendees?.toString() ?? "",
    enable_payments: meeting.enable_payments,
    enable_dining_rsvp: meeting.enable_dining_rsvp,
    dining_price: meeting.dining_price?.toString() ?? "",
    dining_description: meeting.dining_description ?? "",
    enable_charity_donation: meeting.enable_charity_donation,
    charity_name: meeting.charity_name ?? "",
    charity_description: meeting.charity_description ?? "",
    enable_meeting_fee: meeting.enable_meeting_fee,
    meeting_fee_amount: meeting.meeting_fee_amount?.toString() ?? "",
    meeting_fee_description: meeting.meeting_fee_description ?? "",
    enable_guest_tickets: meeting.enable_guest_tickets,
    guest_ticket_price: meeting.guest_ticket_price?.toString() ?? "",
    guest_ticket_description: meeting.guest_ticket_description ?? "",
    published: meeting.published,
  };
}

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
  const [selectedMeeting, setSelectedMeeting] = useState<string | null>(null);
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

  const selectedEvent = selectedMeeting
    ? meetings.find((m) => m.id === selectedMeeting)
    : null;
  const selectedRsvps = selectedMeeting ? (rsvpMap[selectedMeeting] ?? []) : [];
  const diningCount = selectedRsvps.filter((r) => r.attending_dining).length;
  const guestCount = selectedRsvps.reduce((sum, r) => sum + r.number_of_guests, 0);
  const unpaidCount = selectedRsvps.filter(
    (r) => r.payment_required && !r.payment_completed
  ).length;
  const dietaryCount = selectedRsvps.filter((r) => r.dietary_requirements).length;

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
    setMeetingForm(emptyMeetingForm());
    setFormError(null);
    setFormOpen(true);
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

  function downloadCsv(filename: string, headers: string[], rows: string[][]) {
    const csv = [headers, ...rows]
      .map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
      )
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  function exportSelectedRsvps() {
    if (!selectedEvent) return;
    const headers = [
      "Name",
      "Email",
      "Phone",
      "Status",
      "Ceremony",
      "Dining",
      "Guests",
      "Dietary",
      "Requests",
      "Payment",
    ];
    const rows = selectedRsvps.map((rsvp) => [
      rsvp.user_name,
      rsvp.user_email,
      rsvp.user_phone ?? "",
      rsvp.status,
      rsvp.attending_ceremony ? "yes" : "no",
      rsvp.attending_dining ? "yes" : "no",
      String(rsvp.number_of_guests),
      rsvp.dietary_requirements ?? "",
      rsvp.special_requests ?? "",
      rsvp.payment_required
        ? rsvp.payment_completed
          ? "paid"
          : "unpaid"
        : "not required",
    ]);
    downloadCsv(`${selectedEvent.slug}-rsvps.csv`, headers, rows);
  }

  function exportDiningList() {
    if (!selectedEvent) return;
    const dining = selectedRsvps.filter((r) => r.attending_dining);
    downloadCsv(
      `${selectedEvent.slug}-dining-list.csv`,
      ["Name", "Guests", "Dietary", "Requests", "Payment"],
      dining.map((r) => [
        r.user_name,
        String(r.number_of_guests),
        r.dietary_requirements ?? "",
        r.special_requests ?? "",
        r.payment_required
          ? r.payment_completed
            ? "paid"
            : "unpaid"
          : "n/a",
      ])
    );
  }

  function exportApologies() {
    if (!selectedEvent) return;
    const apologies = selectedRsvps.filter(
      (r) => !r.attending_ceremony && r.status !== "cancelled"
    );
    downloadCsv(
      `${selectedEvent.slug}-apologies.csv`,
      ["Name", "Email", "Phone", "Note"],
      apologies.map((r) => [
        r.user_name,
        r.user_email,
        r.user_phone ?? "",
        r.special_requests ?? "",
      ])
    );
  }

  function exportAttendance() {
    if (!selectedEvent) return;
    const attending = selectedRsvps.filter(
      (r) => r.attending_ceremony && r.status !== "cancelled"
    );
    downloadCsv(
      `${selectedEvent.slug}-attendance.csv`,
      ["Name", "Email", "Dining", "Guests", "Payment"],
      attending.map((r) => [
        r.user_name,
        r.user_email,
        r.attending_dining ? "yes" : "no",
        String(r.number_of_guests),
        r.payment_required
          ? r.payment_completed
            ? "paid"
            : "unpaid"
          : "n/a",
      ])
    );
  }

  function exportUnpaid() {
    if (!selectedEvent) return;
    const unpaid = selectedRsvps.filter(
      (r) => r.payment_required && !r.payment_completed
    );
    downloadCsv(
      `${selectedEvent.slug}-unpaid.csv`,
      ["Name", "Email", "Phone", "Status"],
      unpaid.map((r) => [
        r.user_name,
        r.user_email,
        r.user_phone ?? "",
        r.status,
      ])
    );
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
      dining_price: meeting.dining_price?.toString() ?? "",
      meeting_fee_amount: meeting.meeting_fee_amount?.toString() ?? "",
      guest_ticket_price: meeting.guest_ticket_price?.toString() ?? "",
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
        <Button variant="primary" size="sm" onClick={openNewMeetingForm}>
          <Plus className="mr-1.5 h-4 w-4" />
          New Meeting
        </Button>
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
        <div className="grid gap-6 xl:grid-cols-3">
          <Card variant="panel" className="xl:col-span-2 space-y-4 overflow-hidden p-0">
            <div className="dash-panel-header rounded-none border-dash-border bg-dash-surface-subtle">
              <div>
                <h2 className="dash-panel-header-title">Meetings list</h2>
                <p className="dash-panel-header-description">
                  Upcoming and past. Select a row for attendance.
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
                          isSelected={selectedMeeting === m.id}
                          onSelect={() =>
                            setSelectedMeeting(selectedMeeting === m.id ? null : m.id)
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

                  {readinessMap[selectedEvent.id] && (
                    <div
                      className={cn(
                        "rounded-xl border px-3 py-2.5 text-sm",
                        READINESS_CLASSES[readinessMap[selectedEvent.id].status]
                      )}
                    >
                      <p className="flex items-center gap-2 font-medium">
                        {readinessMap[selectedEvent.id].status === "ready" ? (
                          <CheckCircle2 className="h-4 w-4" />
                        ) : (
                          <AlertTriangle className="h-4 w-4" />
                        )}
                        Meeting readiness:{" "}
                        {readinessMap[selectedEvent.id].label}
                      </p>
                      {readinessMap[selectedEvent.id].issues.length > 0 && (
                        <ul className="mt-2 space-y-0.5 text-xs">
                          {readinessMap[selectedEvent.id].issues.map((i) => (
                            <li key={i.key}>• {i.message}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}

                  {workflowTab !== "summons" && (
                    <Button
                      type="button"
                      variant="dashboard"
                      className="w-full"
                      onClick={() => openEditMeetingForm(selectedEvent)}
                    >
                      <Pencil className="mr-2 h-4 w-4" />
                      Edit meeting
                    </Button>
                  )}

                  <Button asChild variant="primary" className="w-full">
                    <Link href={`/admin/meetings/${selectedEvent.id}/summons/edit`}>
                      Edit summons
                    </Link>
                  </Button>

                  <Button asChild variant="dashboard" className="w-full">
                    <Link href={`/admin/meetings/${selectedEvent.id}/summons`}>
                      Open summons
                    </Link>
                  </Button>

                  <Button
                    type="button"
                    variant="dashboard"
                    className="w-full"
                    onClick={() => duplicateMeeting(selectedEvent)}
                  >
                    <Copy className="mr-2 h-4 w-4" />
                    Duplicate meeting
                  </Button>

                  <div className="rounded-xl border border-dash-border bg-dash-surface-subtle p-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-dash-muted">
                      Generated lists
                    </p>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="justify-start"
                        onClick={exportAttendance}
                        disabled={selectedRsvps.length === 0}
                      >
                        <Download className="mr-1.5 h-3.5 w-3.5" /> Attendance
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="justify-start"
                        onClick={exportDiningList}
                        disabled={selectedRsvps.length === 0}
                      >
                        <Download className="mr-1.5 h-3.5 w-3.5" /> Dining
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="justify-start"
                        onClick={exportApologies}
                        disabled={selectedRsvps.length === 0}
                      >
                        <Download className="mr-1.5 h-3.5 w-3.5" /> Apologies
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="justify-start"
                        onClick={exportUnpaid}
                        disabled={selectedRsvps.length === 0}
                      >
                        <Download className="mr-1.5 h-3.5 w-3.5" /> Unpaid
                      </Button>
                    </div>
                  </div>

                  <div>
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <h3 className="text-sm font-medium text-dash-text">
                        Attendance ({selectedRsvps.length})
                      </h3>
                      <Button
                        type="button"
                        variant="dashboard"
                        size="sm"
                        onClick={exportSelectedRsvps}
                        disabled={selectedRsvps.length === 0}
                      >
                        Export CSV
                      </Button>
                    </div>
                    <div className="mb-4 grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-lg border border-dash-border bg-dash-surface-subtle px-3 py-2">
                        <p className="text-dash-muted">Dining</p>
                        <p className="font-semibold text-dash-text">{diningCount}</p>
                      </div>
                      <div className="rounded-lg border border-dash-border bg-dash-surface-subtle px-3 py-2">
                        <p className="text-dash-muted">Guests</p>
                        <p className="font-semibold text-dash-text">{guestCount}</p>
                      </div>
                      <div className="rounded-lg border border-dash-border bg-dash-surface-subtle px-3 py-2">
                        <p className="text-dash-muted">Dietary</p>
                        <p className="font-semibold text-dash-text">{dietaryCount}</p>
                      </div>
                      <div className="rounded-lg border border-dash-border bg-dash-surface-subtle px-3 py-2">
                        <p className="text-dash-muted">Unpaid</p>
                        <p className="font-semibold text-dash-text">{unpaidCount}</p>
                      </div>
                    </div>
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
                              <p className="mt-1 text-xs text-dash-text-muted">
                                {r.attending_dining ? "Dining" : "No dining"}
                                {r.number_of_guests > 0
                                  ? `, ${r.number_of_guests} guest${r.number_of_guests === 1 ? "" : "s"}`
                                  : ""}
                                {r.dietary_requirements
                                  ? `, Dietary: ${r.dietary_requirements}`
                                  : ""}
                              </p>
                              {r.special_requests && (
                                <p className="mt-1 text-xs text-dash-text-muted">
                                  Request: {r.special_requests}
                                </p>
                              )}
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              {r.status === "confirmed" ? (
                                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                              ) : (
                                <XCircle className="h-4 w-4 text-dash-text-faint" />
                              )}
                              {r.payment_required && (
                                <span
                                  className={cn(
                                    "rounded-full px-2 py-0.5 text-[10px] font-medium",
                                    r.payment_completed
                                      ? "bg-emerald-50 text-emerald-700"
                                      : "bg-amber-50 text-amber-700"
                                  )}
                                >
                                  {r.payment_completed ? "Paid" : "Unpaid"}
                                </span>
                              )}
                            </div>
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

const WIZARD_STEPS = [
  { id: "basics", label: "Basics" },
  { id: "rsvp", label: "RSVP & dining" },
  { id: "payments", label: "Payments & charity" },
  { id: "publish", label: "Review & publish" },
] as const;

type WizardStepId = (typeof WIZARD_STEPS)[number]["id"];

function MeetingFormDrawer({
  open,
  editing,
  form,
  formError,
  formSaving,
  typeLabel,
  updateForm,
  onClose,
  onSubmit,
}: {
  open: boolean;
  editing: boolean;
  form: MeetingForm;
  formError: string | null;
  formSaving: boolean;
  typeLabel: (type: string) => string;
  updateForm: (updates: Partial<MeetingForm>) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const [step, setStep] = useState<WizardStepId>("basics");
  if (!open) return null;
  const currentIndex = WIZARD_STEPS.findIndex((s) => s.id === step);
  const isLast = currentIndex === WIZARD_STEPS.length - 1;
  const isFirst = currentIndex === 0;
  const basicsValid = Boolean(form.title.trim()) && Boolean(form.event_date);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Close meeting form"
        className="absolute inset-0 bg-dash-text/20 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div className="relative flex h-full w-full max-w-2xl flex-col border-l border-dash-border bg-dash-surface shadow-xl">
        <div className="flex items-center justify-between border-b border-dash-border px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-dash-text">
              {editing ? "Edit Meeting" : "New Meeting"}
            </h2>
            <p className="text-sm text-dash-muted">
              Step {currentIndex + 1} of {WIZARD_STEPS.length}:{" "}
              {WIZARD_STEPS[currentIndex].label}
            </p>
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={onClose}>
            <XCircle className="h-5 w-5" />
          </Button>
        </div>

        <div className="flex items-center gap-1 border-b border-dash-border bg-dash-surface-subtle px-6 py-3">
          {WIZARD_STEPS.map((s, i) => {
            const done = i < currentIndex;
            const active = i === currentIndex;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setStep(s.id)}
                className={cn(
                  "flex flex-1 items-center justify-center gap-2 rounded-md px-2 py-1 text-xs font-medium transition-colors",
                  active && "bg-dash-surface text-dash-text shadow-sm",
                  done && "text-dash-text",
                  !active && !done && "text-dash-muted hover:text-dash-text"
                )}
              >
                <span
                  className={cn(
                    "flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold",
                    active
                      ? "bg-blue-600 text-white"
                      : done
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-slate-200 text-slate-500"
                  )}
                >
                  {done ? "✓" : i + 1}
                </span>
                <span className="hidden sm:inline">{s.label}</span>
              </button>
            );
          })}
        </div>

        <form onSubmit={onSubmit} className="flex-1 space-y-6 overflow-y-auto p-6">
          {formError && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {formError}
            </div>
          )}

          <section
            className={cn("space-y-4", step !== "basics" && "hidden")}
          >
            <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-dash-muted">
              Meeting Details
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <label className="text-sm font-medium text-dash-text" htmlFor="meeting-title">
                  Title
                </label>
                <Input
                  id="meeting-title"
                  required
                  value={form.title}
                  onChange={(event) =>
                    updateForm({
                      title: event.target.value,
                      slug:
                        form.slug === slugify(form.title)
                          ? slugify(event.target.value)
                          : form.slug,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-dash-text" htmlFor="meeting-slug">
                  URL slug
                </label>
                <Input
                  id="meeting-slug"
                  required
                  value={form.slug}
                  onChange={(event) => updateForm({ slug: slugify(event.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-dash-text" htmlFor="meeting-type">
                  Type
                </label>
                <select
                  id="meeting-type"
                  className="flex h-11 w-full rounded-xl border border-dash-border bg-dash-surface px-3 py-2 text-sm"
                  value={form.event_type}
                  onChange={(event) => updateForm({ event_type: event.target.value })}
                >
                  {MEETING_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {typeLabel(type)}
                    </option>
                  ))}
                </select>
              </div>
              <Input
                type="date"
                required
                value={form.event_date}
                onChange={(event) => updateForm({ event_date: event.target.value })}
              />
              <Input
                placeholder="Time, e.g. 6.00 pm"
                value={form.event_time}
                onChange={(event) => updateForm({ event_time: event.target.value })}
              />
              <Input
                placeholder="Location"
                value={form.location}
                onChange={(event) => updateForm({ location: event.target.value })}
              />
              <Input
                placeholder="Temple room"
                value={form.temple_room}
                onChange={(event) => updateForm({ temple_room: event.target.value })}
              />
              <Input
                placeholder="Dress code"
                value={form.dress_code}
                onChange={(event) => updateForm({ dress_code: event.target.value })}
              />
              <Textarea
                rows={4}
                placeholder="Meeting description"
                value={form.description}
                onChange={(event) => updateForm({ description: event.target.value })}
                className="sm:col-span-2"
              />
            </div>
          </section>

          <section
            className={cn(
              "space-y-4 rounded-xl border border-dash-border bg-dash-surface-subtle p-4",
              step !== "rsvp" && "hidden"
            )}
          >
            <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-dash-muted">
              RSVP and Dining
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex items-center gap-2 text-sm text-dash-text">
                <input
                  type="checkbox"
                  checked={form.enable_rsvp}
                  onChange={(event) => updateForm({ enable_rsvp: event.target.checked })}
                />
                Enable RSVP
              </label>
              <label className="flex items-center gap-2 text-sm text-dash-text">
                <input
                  type="checkbox"
                  checked={form.enable_dining_rsvp}
                  onChange={(event) =>
                    updateForm({ enable_dining_rsvp: event.target.checked })
                  }
                />
                Enable dining
              </label>
              <Input
                type="date"
                value={form.rsvp_deadline}
                onChange={(event) => updateForm({ rsvp_deadline: event.target.value })}
              />
              <Input
                type="number"
                min="0"
                placeholder="Max attendees"
                value={form.max_attendees}
                onChange={(event) => updateForm({ max_attendees: event.target.value })}
              />
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="Dining price"
                value={form.dining_price}
                onChange={(event) => updateForm({ dining_price: event.target.value })}
              />
              <Input
                placeholder="Dining description"
                value={form.dining_description}
                onChange={(event) =>
                  updateForm({ dining_description: event.target.value })
                }
              />
            </div>
          </section>

          <section
            className={cn(
              "space-y-4 rounded-xl border border-dash-border bg-dash-surface-subtle p-4",
              step !== "payments" && "hidden"
            )}
          >
            <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-dash-muted">
              Payments and Charity
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex items-center gap-2 text-sm text-dash-text">
                <input
                  type="checkbox"
                  checked={form.enable_payments}
                  onChange={(event) => updateForm({ enable_payments: event.target.checked })}
                />
                Enable payments
              </label>
              <label className="flex items-center gap-2 text-sm text-dash-text">
                <input
                  type="checkbox"
                  checked={form.enable_meeting_fee}
                  onChange={(event) => updateForm({ enable_meeting_fee: event.target.checked })}
                />
                Meeting fee
              </label>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="Meeting fee amount"
                value={form.meeting_fee_amount}
                onChange={(event) => updateForm({ meeting_fee_amount: event.target.value })}
              />
              <Input
                placeholder="Meeting fee description"
                value={form.meeting_fee_description}
                onChange={(event) =>
                  updateForm({ meeting_fee_description: event.target.value })
                }
              />
              <label className="flex items-center gap-2 text-sm text-dash-text">
                <input
                  type="checkbox"
                  checked={form.enable_charity_donation}
                  onChange={(event) =>
                    updateForm({ enable_charity_donation: event.target.checked })
                  }
                />
                Charity donation
              </label>
              <Input
                placeholder="Charity name"
                value={form.charity_name}
                onChange={(event) => updateForm({ charity_name: event.target.value })}
              />
              <Textarea
                rows={2}
                placeholder="Charity description"
                value={form.charity_description}
                onChange={(event) =>
                  updateForm({ charity_description: event.target.value })
                }
                className="sm:col-span-2"
              />
              <label className="flex items-center gap-2 text-sm text-dash-text">
                <input
                  type="checkbox"
                  checked={form.enable_guest_tickets}
                  onChange={(event) =>
                    updateForm({ enable_guest_tickets: event.target.checked })
                  }
                />
                Guest tickets
              </label>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="Guest ticket price"
                value={form.guest_ticket_price}
                onChange={(event) => updateForm({ guest_ticket_price: event.target.value })}
              />
              <Input
                placeholder="Guest ticket description"
                value={form.guest_ticket_description}
                onChange={(event) =>
                  updateForm({ guest_ticket_description: event.target.value })
                }
                className="sm:col-span-2"
              />
            </div>
          </section>

          <section
            className={cn(
              "space-y-4 rounded-xl border border-dash-border bg-dash-surface-subtle p-4",
              step !== "publish" && "hidden"
            )}
          >
            <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-dash-muted">
              Review and publish
            </h3>
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs text-dash-muted">Title</dt>
                <dd className="font-medium text-dash-text">
                  {form.title || "Not set"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-dash-muted">When</dt>
                <dd className="font-medium text-dash-text">
                  {form.event_date || "Not set"}{" "}
                  {form.event_time ? `· ${form.event_time}` : ""}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-dash-muted">Where</dt>
                <dd className="font-medium text-dash-text">
                  {form.location || "Not set"}
                  {form.temple_room ? ` · ${form.temple_room}` : ""}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-dash-muted">Type</dt>
                <dd className="font-medium text-dash-text">
                  {typeLabel(form.event_type)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-dash-muted">RSVP</dt>
                <dd className="font-medium text-dash-text">
                  {form.enable_rsvp ? "Enabled" : "Off"}
                  {form.enable_dining_rsvp
                    ? ` · Dining ${form.dining_price ? `£${form.dining_price}` : "(no price)"}`
                    : ""}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-dash-muted">Payments</dt>
                <dd className="font-medium text-dash-text">
                  {form.enable_payments ? "Enabled" : "Off"}
                  {form.enable_meeting_fee
                    ? ` · Fee ${form.meeting_fee_amount ? `£${form.meeting_fee_amount}` : "(no amount)"}`
                    : ""}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs text-dash-muted">Charity</dt>
                <dd className="font-medium text-dash-text">
                  {form.enable_charity_donation
                    ? form.charity_name || "(no name)"
                    : "Off"}
                </dd>
              </div>
            </dl>
            <label className="flex items-center gap-2 text-sm text-dash-text">
              <input
                type="checkbox"
                checked={form.published}
                onChange={(event) =>
                  updateForm({ published: event.target.checked })
                }
              />
              Published on the public lodge site
            </label>
          </section>

          <div className="sticky bottom-0 -mx-6 flex items-center justify-between gap-3 border-t border-dash-border bg-dash-surface px-6 py-4">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              className="text-dash-muted"
            >
              Cancel
            </Button>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() =>
                  setStep(WIZARD_STEPS[currentIndex - 1].id)
                }
                disabled={isFirst}
              >
                <ArrowLeft className="mr-1 h-4 w-4" /> Back
              </Button>
              {!isLast ? (
                <Button
                  type="button"
                  variant="primary"
                  onClick={() =>
                    setStep(WIZARD_STEPS[currentIndex + 1].id)
                  }
                  disabled={step === "basics" && !basicsValid}
                >
                  Next <ArrowRightIcon className="ml-1 h-4 w-4" />
                </Button>
              ) : (
                <Button type="submit" variant="primary" disabled={formSaving}>
                  {formSaving
                    ? "Saving..."
                    : editing
                    ? "Save changes"
                    : "Create meeting"}
                </Button>
              )}
            </div>
          </div>
        </form>
      </div>
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
