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
  Trash2,
} from "lucide-react";
import {
  type ServiceReadiness,
  READINESS_CLASSES,
} from "@/lib/services/readiness";
import {
  MEETING_TYPES,
  ServiceFormDrawer,
  emptyServiceForm,
  formatMoneyInput,
  formFromService,
  parseSuggestedAmounts,
  slugify,
  type ServiceForm,
} from "./service-form";
import type { ChurchFeeDefaults } from "@/lib/fees/resolve";

type ServiceEvent = {
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
  charity_suggested_amounts: number[] | null;
  charity_allow_custom: boolean;
  enable_raffle_donation: boolean;
  raffle_description: string | null;
  raffle_suggested_amounts: number[] | null;
  raffle_allow_custom: boolean;
  enable_raffle_wine_pledge: boolean;
  raffle_wine_description: string | null;
  enable_service_fee: boolean;
  service_fee_amount: number | null;
  service_fee_description: string | null;
  enable_guest_tickets: boolean;
  guest_ticket_price: number | null;
  guest_ticket_description: string | null;
  published: boolean;
  feature_on_website: boolean;
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
  raffle_wine_pledged?: boolean;
  raffle_wine_bottles?: number;
  raffle_wine_note?: string | null;
};

type View = "list" | "calendar";
type WorkflowTab = "calendar" | "services" | "notice" | "rsvps";

type KpiAccent = "blue" | "emerald" | "violet" | "amber";

const kpiAccentIcon: Record<KpiAccent, { wrap: string; icon: string }> = {
  blue: { wrap: "bg-blue-500/10", icon: "text-blue-600" },
  emerald: { wrap: "bg-emerald-500/10", icon: "text-emerald-600" },
  violet: { wrap: "bg-violet-500/10", icon: "text-violet-600" },
  amber: { wrap: "bg-amber-500/10", icon: "text-amber-700" },
};

export function AdminServicesClient({
  services,
  rsvpMap,
  readinessMap,
  financeMap,
}: {
  services: ServiceEvent[];
  rsvpMap: Record<string, RsvpEntry[]>;
  readinessMap: Record<string, ServiceReadiness>;
  /**
   * Per-event money totals. Undefined buckets render as "—" so older
   * services without any in-person/QR/online payments don't show a
   * misleading £0. Populated from the canonical payments table by the
   * server component above.
   */
  financeMap?: Record<
    string,
    { raised: number; pending: number; count: number }
  >;
}) {
  const router = useRouter();
  const [view, setView] = useState<View>("list");
  const [workflowTab, setWorkflowTab] = useState<WorkflowTab>("services");
  const [typeFilter, setTypeFilter] = useState("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [serviceForm, setServiceForm] = useState<ServiceForm>(() => emptyServiceForm());
  const [formError, setFormError] = useState<string | null>(null);
  const [formSaving, setFormSaving] = useState(false);
  const [churchDefaults, setChurchDefaults] = useState<ChurchFeeDefaults | null>(
    null
  );
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const filteredServices = useMemo(() => {
    if (typeFilter === "all") return services;
    return services.filter((m) => m.event_type === typeFilter);
  }, [services, typeFilter]);

  const upcomingServices = filteredServices.filter(
    (m) => new Date(m.event_date) >= new Date()
  );
  const pastServices = filteredServices.filter(
    (m) => new Date(m.event_date) < new Date()
  );

  const calendarDays = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const startOffset = firstDay === 0 ? 6 : firstDay - 1;

    const days: Array<{ date: number; isCurrentMonth: boolean; services: ServiceEvent[] }> = [];

    for (let i = 0; i < startOffset; i++) {
      const prevDate = new Date(year, month, -startOffset + i + 1);
      days.push({ date: prevDate.getDate(), isCurrentMonth: false, services: [] });
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dayServices = services.filter((m) => {
        const md = new Date(m.event_date);
        return md.getFullYear() === year && md.getMonth() === month && md.getDate() === d;
      });
      days.push({ date: d, isCurrentMonth: true, services: dayServices });
    }

    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      days.push({ date: i, isCurrentMonth: false, services: [] });
    }

    return days;
  }, [calendarMonth, services]);

  const typeLabel = (t: string) =>
    t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  function selectWorkflowTab(tab: WorkflowTab) {
    setWorkflowTab(tab);
    setView(tab === "calendar" ? "calendar" : "list");
  }

  // Cache the church defaults across opens of the drawer. They are tiny and
  // don't change while the user is sitting on this page; revalidate each time
  // the drawer opens so a treasurer who just edited the defaults in another
  // tab sees the latest values.
  async function fetchChurchDefaults(): Promise<ChurchFeeDefaults | null> {
    try {
      const res = await fetch("/api/settings/church-fees");
      if (!res.ok) return null;
      const data = await res.json();
      const fees = data.fees ?? null;
      if (!fees) return null;
      const defaults: ChurchFeeDefaults = {
        default_member_levy_amount:
          fees.default_member_levy_amount ?? null,
        default_member_dining_amount:
          fees.default_member_dining_amount ?? null,
        default_guest_dining_amount:
          fees.default_guest_dining_amount ?? null,
        currency: fees.currency ?? "gbp",
      };
      setChurchDefaults(defaults);
      return defaults;
    } catch {
      return null;
    }
  }

  function openNewServiceForm() {
    setEditingServiceId(null);
    setFormError(null);
    setFormOpen(true);
    // Start with a sensible default: service levy ON (since most services
    // charge one and a church default will be filled in), dining and guests
    // opt-in by the user. Prices are left blank so the resolver falls through
    // to the church defaults at runtime.
    setServiceForm({
      ...emptyServiceForm(),
      enable_service_fee: true,
    });
    void fetchChurchDefaults();
  }

  function openEditServiceForm(service: ServiceEvent) {
    setEditingServiceId(service.id);
    setServiceForm(formFromService(service));
    setFormError(null);
    setFormOpen(true);
    void fetchChurchDefaults();
  }

  function updateServiceForm(updates: Partial<ServiceForm>) {
    setServiceForm((current) => ({ ...current, ...updates }));
  }

  async function handleServiceSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormSaving(true);
    setFormError(null);

    // `enable_payments` is no longer a user-controllable switch — it is
    // derived from whether any fee or charity collection is enabled. Public
    // checkout pages still use this flag as a gate, so we must keep writing
    // it but it should always reflect the actual fee state.
    const derivedEnablePayments =
      serviceForm.enable_service_fee ||
      serviceForm.enable_dining_rsvp ||
      serviceForm.enable_guest_tickets ||
      serviceForm.enable_charity_donation ||
      serviceForm.enable_raffle_donation;

    const payload = {
      ...serviceForm,
      slug: serviceForm.slug || slugify(serviceForm.title),
      event_time: serviceForm.event_time || null,
      dining_price: serviceForm.dining_price || null,
      service_fee_amount: serviceForm.service_fee_amount || null,
      guest_ticket_price: serviceForm.guest_ticket_price || null,
      max_attendees: serviceForm.max_attendees || null,
      rsvp_deadline: serviceForm.rsvp_deadline || null,
      enable_payments: derivedEnablePayments,
      charity_suggested_amounts: parseSuggestedAmounts(
        serviceForm.charity_suggested_amounts
      ),
      raffle_suggested_amounts: parseSuggestedAmounts(
        serviceForm.raffle_suggested_amounts
      ),
    };

    try {
      const res = await fetch(
        editingServiceId ? `/api/events/${editingServiceId}` : "/api/events",
        {
          method: editingServiceId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to save service");
      }
      setFormOpen(false);
      setEditingServiceId(null);
      router.refresh();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Could not save service.");
    } finally {
      setFormSaving(false);
    }
  }

  async function duplicateService(service: ServiceEvent) {
    const newDateInput =
      typeof window !== "undefined"
        ? window.prompt(
            `Duplicate "${service.title}". Enter the new service date (YYYY-MM-DD):`,
            new Date().toISOString().slice(0, 10)
          )
        : null;
    if (!newDateInput) return;
    const baseSlug = service.slug.replace(/-\d{4}-\d{2}-\d{2}$/, "");
    const payload = {
      ...formFromService(service),
      title: service.title,
      slug: `${baseSlug}-${newDateInput}`,
      event_date: newDateInput,
      published: false,
      dining_price: formatMoneyInput(service.dining_price),
      service_fee_amount: formatMoneyInput(service.service_fee_amount),
      guest_ticket_price: formatMoneyInput(service.guest_ticket_price),
      max_attendees: service.max_attendees?.toString() ?? "",
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
        window.alert(data.error ?? "Could not duplicate service.");
        return;
      }
      router.refresh();
    } catch (err) {
      console.error("duplicate service failed", err);
      window.alert("Could not duplicate service.");
    }
  }

  async function deleteService(service: ServiceEvent) {
    const finance = financeMap?.[service.id];
    const paymentNote =
      finance && (finance.raised > 0 || finance.count > 0)
        ? `\n\n${finance.count} payment${finance.count === 1 ? "" : "s"} (£${finance.raised.toFixed(2)} raised) will stay in the ledger but will no longer be linked to this service.`
        : "";
    const ok =
      typeof window !== "undefined" &&
      window.confirm(
        `Delete "${service.title}" permanently?\n\nThis removes RSVPs, notice, and guest records for this service.${paymentNote}\n\nThis cannot be undone.`,
      );
    if (!ok) return;
    try {
      const res = await fetch(`/api/events/${service.id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        window.alert(data.error ?? "Could not delete service.");
        return;
      }
      router.refresh();
    } catch (err) {
      console.error("delete service failed", err);
      window.alert("Could not delete service.");
    }
  }

  const typeColor: Record<string, string> = {
    regular_service: "bg-blue-500",
    church_service: "bg-blue-500",
    special_service: "bg-purple-500",
    church_of_instruction: "bg-cyan-500",
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
      value: String(upcomingServices.length),
      hint: "services scheduled",
      icon: Calendar,
      accent: "blue",
    },
    {
      label: "Past",
      value: String(pastServices.length),
      hint: "completed this year",
      icon: CheckCircle2,
      accent: "emerald",
    },
    {
      label: "Next service",
      value: upcomingServices[0]?.title ?? "None",
      hint: upcomingServices[0]
        ? formatDate(upcomingServices[0].event_date)
        : "Not scheduled",
      icon: Clock,
      accent: "violet",
    },
    {
      label: "Total this year",
      value: String(services.length),
      hint: "across all types",
      icon: CircleDot,
      accent: "amber",
    },
  ];

  return (
    <div className="space-y-5 sm:space-y-8">
      <div className="admin-page-head">
        <div>
          <h1 className="admin-page-title">Services</h1>
          <p className="admin-page-copy">
            Calendar, church services, notice, and attendance in one place.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="dashboard" size="sm">
            <Link href="/admin/sequences">Sequences</Link>
          </Button>
          <Button variant="primary" size="sm" onClick={openNewServiceForm}>
            <Plus className="mr-1.5 h-4 w-4" />
            New Service
          </Button>
        </div>
      </div>

      <Tabs value={workflowTab} onValueChange={(value) => selectWorkflowTab(value as WorkflowTab)}>
        <TabsList>
          <TabsTrigger value="calendar">Calendar</TabsTrigger>
          <TabsTrigger value="services">Services</TabsTrigger>
          <TabsTrigger value="notice">Notice</TabsTrigger>
          <TabsTrigger value="rsvps">RSVPs</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((k) => {
          const Icon = k.icon;
          const ac = kpiAccentIcon[k.accent];
          const isTitleKpi = k.label === "Next service";
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
                if (workflowTab === "calendar") setWorkflowTab("services");
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
        <div className="space-y-4 sm:space-y-6">
          <Card variant="panel" className="space-y-4 overflow-hidden p-0">
            <div className="dash-panel-header rounded-none border-dash-border bg-dash-surface-subtle">
              <div>
                <h2 className="dash-panel-header-title">Services list</h2>
                <p className="dash-panel-header-description">
                  Upcoming and past. Click a row to open the service record.
                </p>
              </div>
            </div>
            <div className="space-y-3 p-4 md:p-5">
              {filteredServices.length === 0 ? (
                <div className="rounded-xl border border-dash-border bg-dash-surface-subtle/50 py-12 text-center">
                  <Calendar className="mx-auto h-8 w-8 text-dash-text-faint" />
                  <p className="mt-3 text-sm text-dash-text-muted">No services found.</p>
                </div>
              ) : (
                <>
                  {upcomingServices.length > 0 && (
                    <>
                      <p className="px-1 text-xs font-semibold uppercase tracking-wider text-dash-text-muted">
                        Upcoming
                      </p>
                      {upcomingServices.map((m) => (
                        <ServiceCard
                          key={m.id}
                          service={m}
                          typeColor={typeColor}
                          typeLabel={typeLabel}
                          isSelected={false}
                          onSelect={() =>
                            router.push(`/admin/services/${m.id}`)
                          }
                          rsvpCount={(rsvpMap[m.id] ?? []).length}
                          readiness={readinessMap[m.id]}
                          onDuplicate={() => duplicateService(m)}
                          onDelete={() => deleteService(m)}
                          finance={financeMap?.[m.id]}
                        />
                      ))}
                    </>
                  )}
                  {pastServices.length > 0 && (
                    <>
                      <p className="mt-4 px-1 text-xs font-semibold uppercase tracking-wider text-dash-text-muted">
                        Past
                      </p>
                      {pastServices.map((m) => (
                        <ServiceCard
                          key={m.id}
                          service={m}
                          typeColor={typeColor}
                          typeLabel={typeLabel}
                          isSelected={false}
                          onSelect={() =>
                            router.push(`/admin/services/${m.id}`)
                          }
                          rsvpCount={(rsvpMap[m.id] ?? []).length}
                          readiness={readinessMap[m.id]}
                          onDuplicate={() => duplicateService(m)}
                          onDelete={() => deleteService(m)}
                          isPast
                          finance={financeMap?.[m.id]}
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
                Click a service chip to open its record.
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
                    {day.services.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => router.push(`/admin/services/${m.id}`)}
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

      <ServiceFormDrawer
        open={formOpen}
        editing={Boolean(editingServiceId)}
        form={serviceForm}
        formError={formError}
        formSaving={formSaving}
        typeLabel={typeLabel}
        updateForm={updateServiceForm}
        onClose={() => setFormOpen(false)}
        onSubmit={handleServiceSubmit}
        churchDefaults={churchDefaults}
      />
    </div>
  );
}

function ServiceCard({
  service,
  typeColor,
  typeLabel,
  isSelected,
  onSelect,
  rsvpCount,
  isPast,
  readiness,
  onDuplicate,
  onDelete,
  finance,
}: {
  service: ServiceEvent;
  typeColor: Record<string, string>;
  typeLabel: (t: string) => string;
  isSelected: boolean;
  onSelect: () => void;
  rsvpCount: number;
  isPast?: boolean;
  readiness?: ServiceReadiness;
  onDuplicate?: () => void;
  onDelete?: () => void;
  finance?: { raised: number; pending: number; count: number };
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
          {new Date(service.event_date).toLocaleDateString("en-GB", { month: "short" })}
        </span>
        <span className="mt-0.5 text-lg font-bold leading-none text-dash-text">
          {new Date(service.event_date).getDate()}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-dash-text">{service.title}</p>
        <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-dash-text-muted">
          {service.location && (
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3" /> {service.location}
            </span>
          )}
          {service.event_time && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" /> {service.event_time}
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
        {finance && (finance.raised > 0 || finance.pending > 0) ? (
          <span
            className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[11px] font-medium text-emerald-800"
            title={
              finance.pending > 0
                ? `£${finance.raised.toFixed(2)} raised · £${finance.pending.toFixed(2)} pending`
                : `£${finance.raised.toFixed(2)} raised across ${finance.count} payment${
                    finance.count === 1 ? "" : "s"
                  }`
            }
          >
            £{finance.raised.toFixed(0)}
            {finance.pending > 0 ? "+" : ""}
          </span>
        ) : null}
        <div className="flex items-center gap-1.5">
          <div
            className={cn("h-2 w-2 rounded-full", typeColor[service.event_type] ?? "bg-slate-400")}
          />
          <Badge variant="outline" className="border-dash-border font-normal text-dash-text-muted">
            {typeLabel(service.event_type)}
          </Badge>
        </div>
        {onDuplicate && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100"
            aria-label="Duplicate service"
            onClick={(e) => {
              e.stopPropagation();
              onDuplicate();
            }}
          >
            <Copy className="h-3.5 w-3.5" />
          </Button>
        )}
        {onDelete && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-rose-600 opacity-0 hover:bg-rose-50 hover:text-rose-700 group-hover:opacity-100"
            aria-label="Delete service"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}
