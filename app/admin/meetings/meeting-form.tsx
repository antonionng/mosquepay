"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import {
  ArrowLeft,
  ArrowRight as ArrowRightIcon,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export const MEETING_TYPES = [
  "regular_meeting",
  "lodge_meeting",
  "installation",
  "lodge_of_instruction",
  "committee",
  "emergency",
];

export type MeetingForm = {
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
  dining_waived_for_all: boolean;
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
  feature_on_website: boolean;
};

export type MeetingFormMeeting = {
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
  feature_on_website: boolean;
  guest_ticket_price: number | null;
  guest_ticket_description: string | null;
  published: boolean;
};

export function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function dateInput(value: string | null) {
  return value ? new Date(value).toISOString().slice(0, 10) : "";
}

export function timeInput(value: string | null) {
  if (!value) return "";

  const trimmed = value.trim().toLowerCase();
  const isoTime = trimmed.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (isoTime) {
    const hours = Number(isoTime[1]);
    const minutes = Number(isoTime[2]);
    if (hours < 24 && minutes < 60) {
      return `${hours.toString().padStart(2, "0")}:${isoTime[2]}`;
    }
  }

  const meridiemTime = trimmed.match(/^(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)$/);
  if (!meridiemTime) return "";

  let hours = Number(meridiemTime[1]);
  const minutes = Number(meridiemTime[2] ?? "00");
  if (hours < 1 || hours > 12 || minutes >= 60) return "";
  if (meridiemTime[3] === "pm" && hours !== 12) hours += 12;
  if (meridiemTime[3] === "am" && hours === 12) hours = 0;

  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
}

export function normalizeMoneyInput(value: string) {
  const cleaned = value.replace(/[^\d.]/g, "");
  const [pounds = "", ...penceParts] = cleaned.split(".");
  if (penceParts.length === 0) return pounds;

  return `${pounds}.${penceParts.join("").slice(0, 2)}`;
}

export function formatMoneyInput(value: string | number | null | undefined) {
  if (value == null || value === "") return "";

  const normalized = normalizeMoneyInput(String(value));
  if (!normalized || normalized === ".") return "";

  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount.toFixed(2) : "";
}

export function emptyMeetingForm(): MeetingForm {
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
    dining_waived_for_all: false,
    enable_charity_donation: false,
    charity_name: "",
    charity_description: "",
    enable_meeting_fee: false,
    meeting_fee_amount: "",
    meeting_fee_description: "",
    enable_guest_tickets: false,
    guest_ticket_price: "",
    guest_ticket_description: "",
    published: false,
    feature_on_website: false,
  };
}

export function formFromMeeting(meeting: MeetingFormMeeting): MeetingForm {
  return {
    title: meeting.title,
    slug: meeting.slug,
    description: meeting.description ?? "",
    event_type: meeting.event_type,
    event_date: dateInput(meeting.event_date),
    event_time: timeInput(meeting.event_time),
    location: meeting.location ?? "",
    temple_room: meeting.temple_room ?? "",
    dress_code: meeting.dress_code ?? "",
    enable_rsvp: meeting.enable_rsvp,
    rsvp_deadline: dateInput(meeting.rsvp_deadline),
    max_attendees: meeting.max_attendees?.toString() ?? "",
    enable_payments: meeting.enable_payments,
    enable_dining_rsvp: meeting.enable_dining_rsvp,
    dining_price: formatMoneyInput(meeting.dining_price),
    dining_description: meeting.dining_description ?? "",
    dining_waived_for_all: meeting.dining_waived_for_all === true,
    enable_charity_donation: meeting.enable_charity_donation,
    charity_name: meeting.charity_name ?? "",
    charity_description: meeting.charity_description ?? "",
    enable_meeting_fee: meeting.enable_meeting_fee,
    meeting_fee_amount: formatMoneyInput(meeting.meeting_fee_amount),
    meeting_fee_description: meeting.meeting_fee_description ?? "",
    enable_guest_tickets: meeting.enable_guest_tickets,
    guest_ticket_price: formatMoneyInput(meeting.guest_ticket_price),
    guest_ticket_description: meeting.guest_ticket_description ?? "",
    published: meeting.published,
    feature_on_website: meeting.feature_on_website === true,
  };
}

const WIZARD_STEPS = [
  { id: "basics", label: "Basics" },
  { id: "rsvp", label: "RSVP & dining" },
  { id: "payments", label: "Payments & charity" },
  { id: "publish", label: "Review" },
] as const;

type WizardStepId = (typeof WIZARD_STEPS)[number]["id"];

function MoneyInput({
  id,
  value,
  onChange,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-sm font-medium text-dash-muted">
        £
      </span>
      <Input
        id={id}
        type="text"
        inputMode="decimal"
        placeholder="0.00"
        value={value}
        onChange={(event) => onChange(normalizeMoneyInput(event.target.value))}
        onBlur={() => onChange(formatMoneyInput(value))}
        className="pl-8 pr-16"
        aria-describedby={`${id}-currency`}
      />
      <span
        id={`${id}-currency`}
        className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-4 text-xs font-semibold text-dash-muted"
      >
        GBP
      </span>
    </div>
  );
}

export function MeetingFormDrawer({
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
    <div className="admin-drawer-shell fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Close meeting form"
        className="absolute inset-0 bg-dash-text/20 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div className="admin-drawer-panel relative flex h-full w-full max-w-2xl flex-col border-l border-dash-border bg-dash-surface shadow-xl">
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

          <section className={cn("space-y-4", step !== "basics" && "hidden")}>
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
              <div className="space-y-2">
                <label className="text-sm font-medium text-dash-text" htmlFor="meeting-date">
                  Meeting date
                </label>
                <Input
                  id="meeting-date"
                  type="date"
                  required
                  value={form.event_date}
                  onChange={(event) => updateForm({ event_date: event.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-dash-text" htmlFor="meeting-time">
                  Start time
                </label>
                <Input
                  id="meeting-time"
                  type="time"
                  step="300"
                  value={form.event_time}
                  onChange={(event) => updateForm({ event_time: event.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-dash-text" htmlFor="meeting-location">
                  Location
                </label>
                <Input
                  id="meeting-location"
                  placeholder="Mark Masons' Hall"
                  value={form.location}
                  onChange={(event) => updateForm({ location: event.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-dash-text" htmlFor="meeting-temple">
                  Temple room
                </label>
                <Input
                  id="meeting-temple"
                  placeholder="e.g. Egyptian Temple"
                  value={form.temple_room}
                  onChange={(event) => updateForm({ temple_room: event.target.value })}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <label className="text-sm font-medium text-dash-text" htmlFor="meeting-dress">
                  Dress code
                </label>
                <Input
                  id="meeting-dress"
                  placeholder="e.g. Dark Suit, White Shirt & Gloves, Black Tie"
                  value={form.dress_code}
                  onChange={(event) => updateForm({ dress_code: event.target.value })}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <label className="text-sm font-medium text-dash-text" htmlFor="meeting-description">
                  Description
                </label>
                <Textarea
                  id="meeting-description"
                  rows={4}
                  placeholder="Optional summary printed on summons and shown on the public meeting page."
                  value={form.description}
                  onChange={(event) => updateForm({ description: event.target.value })}
                />
              </div>
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
              <div className="space-y-2">
                <label className="text-sm font-medium text-dash-text" htmlFor="rsvp-deadline">
                  RSVP deadline
                </label>
                <Input
                  id="rsvp-deadline"
                  type="date"
                  value={form.rsvp_deadline}
                  onChange={(event) => updateForm({ rsvp_deadline: event.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-dash-text" htmlFor="max-attendees">
                  Max attendees
                </label>
                <Input
                  id="max-attendees"
                  type="number"
                  min="0"
                  placeholder="Leave blank for no limit"
                  value={form.max_attendees}
                  onChange={(event) => updateForm({ max_attendees: event.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-dash-text" htmlFor="dining-price">
                  Dining price
                </label>
                <MoneyInput
                  id="dining-price"
                  value={form.dining_price}
                  onChange={(value) => updateForm({ dining_price: value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-dash-text" htmlFor="dining-description">
                  Dining description
                </label>
                <Input
                  id="dining-description"
                  placeholder="Three-course installation dinner at 7.30 pm"
                  value={form.dining_description}
                  onChange={(event) =>
                    updateForm({ dining_description: event.target.value })
                  }
                />
              </div>
              {form.enable_dining_rsvp && (
                <label className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50/60 p-3 text-sm text-amber-900 sm:col-span-2">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={form.dining_waived_for_all}
                    onChange={(event) =>
                      updateForm({
                        dining_waived_for_all: event.target.checked,
                      })
                    }
                  />
                  <div>
                    <p className="font-semibold">
                      Waive dining for everyone at this meeting
                    </p>
                    <p className="text-xs text-amber-800">
                      Useful for events where the lodge covers dining (e.g. an
                      installation). Members and guests are shown as
                      complimentary on the recipients panel and dining will
                      not be charged at checkout.
                    </p>
                  </div>
                </label>
              )}
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
              <div className="space-y-2">
                <label className="text-sm font-medium text-dash-text" htmlFor="meeting-fee-amount">
                  Meeting fee amount
                </label>
                <MoneyInput
                  id="meeting-fee-amount"
                  value={form.meeting_fee_amount}
                  onChange={(value) => updateForm({ meeting_fee_amount: value })}
                />
              </div>
              <div className="space-y-2">
                <label
                  className="text-sm font-medium text-dash-text"
                  htmlFor="meeting-fee-description"
                >
                  Meeting fee description
                </label>
                <Input
                  id="meeting-fee-description"
                  placeholder="e.g. Per-meeting subscription"
                  value={form.meeting_fee_description}
                  onChange={(event) =>
                    updateForm({ meeting_fee_description: event.target.value })
                  }
                />
              </div>
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
              <div className="space-y-2">
                <label className="text-sm font-medium text-dash-text" htmlFor="charity-name">
                  Charity name
                </label>
                <Input
                  id="charity-name"
                  placeholder="e.g. RMBI"
                  value={form.charity_name}
                  onChange={(event) => updateForm({ charity_name: event.target.value })}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <label
                  className="text-sm font-medium text-dash-text"
                  htmlFor="charity-description"
                >
                  Charity description
                </label>
                <Textarea
                  id="charity-description"
                  rows={2}
                  placeholder="Optional note about the charity or the donation purpose."
                  value={form.charity_description}
                  onChange={(event) =>
                    updateForm({ charity_description: event.target.value })
                  }
                />
              </div>
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
              <div className="space-y-2">
                <label className="text-sm font-medium text-dash-text" htmlFor="guest-ticket-price">
                  Guest ticket price
                </label>
                <MoneyInput
                  id="guest-ticket-price"
                  value={form.guest_ticket_price}
                  onChange={(value) => updateForm({ guest_ticket_price: value })}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <label
                  className="text-sm font-medium text-dash-text"
                  htmlFor="guest-ticket-description"
                >
                  Guest ticket description
                </label>
                <Input
                  id="guest-ticket-description"
                  placeholder="e.g. Includes ceremony and dining"
                  value={form.guest_ticket_description}
                  onChange={(event) =>
                    updateForm({ guest_ticket_description: event.target.value })
                  }
                />
              </div>
            </div>
          </section>

          <section
            className={cn(
              "space-y-4 rounded-xl border border-dash-border bg-dash-surface-subtle p-4",
              step !== "publish" && "hidden"
            )}
          >
            <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-dash-muted">
              Review
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
                    ? ` · Dining ${form.dining_price ? `£${formatMoneyInput(form.dining_price)}` : "(no price)"}`
                    : ""}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-dash-muted">Payments</dt>
                <dd className="font-medium text-dash-text">
                  {form.enable_payments ? "Enabled" : "Off"}
                  {form.enable_meeting_fee
                    ? ` · Fee ${form.meeting_fee_amount ? `£${formatMoneyInput(form.meeting_fee_amount)}` : "(no amount)"}`
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
              Publish (visible to members in the member portal)
            </label>
            <div className="mt-3 rounded-xl border border-dash-border bg-dash-surface-subtle p-3">
              <label className="flex items-start gap-2 text-sm text-dash-text">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={form.feature_on_website}
                  onChange={(event) =>
                    updateForm({ feature_on_website: event.target.checked })
                  }
                  disabled={!form.published}
                />
                <span>
                  <span className="font-medium">Also show on the public lodge website</span>
                  <span className="mt-1 block text-xs text-dash-muted">
                    Regular meetings and lodges of instruction stay private by default. Tick this
                    only for meetings that genuinely welcome visitors or the wider public (e.g. an
                    installation open to visiting brethren, or a public charity event). Socials and
                    charity events are shown on the public site automatically.
                  </span>
                </span>
              </label>
            </div>
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
                    : form.published
                    ? "Create and publish"
                    : "Create draft"}
                </Button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
