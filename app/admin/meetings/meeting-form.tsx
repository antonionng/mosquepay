"use client";

import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight as ArrowRightIcon,
  ExternalLink,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { LodgeFeeDefaults } from "@/lib/fees/resolve";
import { resolveEffectiveAmount } from "@/lib/fees/resolve";

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
  /** Comma-separated suggested amounts, e.g. "10, 20, 50, 100". */
  charity_suggested_amounts: string;
  charity_allow_custom: boolean;
  enable_raffle_donation: boolean;
  raffle_description: string;
  /** Comma-separated suggested amounts, e.g. "5, 10, 20, 50". */
  raffle_suggested_amounts: string;
  raffle_allow_custom: boolean;
  enable_raffle_wine_pledge: boolean;
  raffle_wine_description: string;
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
  charity_suggested_amounts?: number[] | null;
  charity_allow_custom?: boolean;
  enable_raffle_donation?: boolean;
  raffle_description?: string | null;
  raffle_suggested_amounts?: number[] | null;
  raffle_allow_custom?: boolean;
  enable_raffle_wine_pledge?: boolean;
  raffle_wine_description?: string | null;
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

/**
 * Render an array of suggested amounts (e.g. [10, 20, 50, 100]) into the
 * comma-separated string the form input edits. We strip falsy/non-numeric
 * entries so the editor never resurrects garbage rows.
 */
export function suggestedAmountsToInput(
  values: number[] | null | undefined
): string {
  if (!Array.isArray(values) || values.length === 0) return "";
  return values
    .map((n) => Number(n))
    .filter((n) => Number.isFinite(n) && n > 0)
    .map((n) => (Number.isInteger(n) ? String(n) : n.toFixed(2)))
    .join(", ");
}

/**
 * Parse the user-facing comma-separated amounts back into a numeric array
 * suitable for the JSON `*_suggested_amounts` columns. Drops blanks and
 * non-positive values silently — the wizard intentionally does not error
 * on bad rows, it just ignores them.
 */
export function parseSuggestedAmounts(input: string): number[] {
  if (!input) return [];
  return input
    .split(/[,\s]+/)
    .map((raw) => raw.trim())
    .filter(Boolean)
    .map((raw) => Number(raw))
    .filter((n) => Number.isFinite(n) && n > 0);
}

const DEFAULT_CHARITY_SUGGESTED = "10, 20, 50, 100";
const DEFAULT_RAFFLE_SUGGESTED = "5, 10, 20, 50";
const DEFAULT_RAFFLE_DESCRIPTION =
  "Buy strips of raffle tickets — proceeds fund the evening prizes";
const DEFAULT_WINE_DESCRIPTION =
  "Bring a bottle of wine for the evening raffle";

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
    charity_suggested_amounts: DEFAULT_CHARITY_SUGGESTED,
    charity_allow_custom: true,
    enable_raffle_donation: false,
    raffle_description: DEFAULT_RAFFLE_DESCRIPTION,
    raffle_suggested_amounts: DEFAULT_RAFFLE_SUGGESTED,
    raffle_allow_custom: true,
    enable_raffle_wine_pledge: false,
    raffle_wine_description: DEFAULT_WINE_DESCRIPTION,
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
    charity_suggested_amounts:
      suggestedAmountsToInput(meeting.charity_suggested_amounts) ||
      DEFAULT_CHARITY_SUGGESTED,
    charity_allow_custom: meeting.charity_allow_custom ?? true,
    enable_raffle_donation: meeting.enable_raffle_donation === true,
    raffle_description:
      meeting.raffle_description ?? DEFAULT_RAFFLE_DESCRIPTION,
    raffle_suggested_amounts:
      suggestedAmountsToInput(meeting.raffle_suggested_amounts) ||
      DEFAULT_RAFFLE_SUGGESTED,
    raffle_allow_custom: meeting.raffle_allow_custom ?? true,
    enable_raffle_wine_pledge: meeting.enable_raffle_wine_pledge === true,
    raffle_wine_description:
      meeting.raffle_wine_description ?? DEFAULT_WINE_DESCRIPTION,
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
  { id: "rsvp", label: "Attendance" },
  { id: "fees", label: "Fees" },
  { id: "publish", label: "Review" },
] as const;

type WizardStepId = (typeof WIZARD_STEPS)[number]["id"];

function formatGbp(value: number | null | undefined): string {
  if (value == null) return "";
  return `£${Number(value).toFixed(2)}`;
}

/**
 * Helper used by the Fees step. Given the current event-level form value and
 * a lodge default, returns a single string describing what will actually be
 * charged (e.g. "Using lodge default of £10.00", or "Custom: £15.00").
 */
function describeFeeOrigin(
  formValue: string,
  defaultValue: number | null | undefined,
  options: { required?: boolean } = {}
): { resolved: number | null; hint: string; tone: "muted" | "warn" } {
  const trimmed = formValue.trim();
  const hasCustom = trimmed !== "";
  const resolved = resolveEffectiveAmount(
    hasCustom ? Number(trimmed) : null,
    defaultValue ?? null
  );

  if (hasCustom) {
    return {
      resolved,
      hint: `Custom for this meeting: ${formatGbp(Number(trimmed))}`,
      tone: "muted",
    };
  }

  if (defaultValue != null) {
    return {
      resolved,
      hint: `Using lodge default of ${formatGbp(defaultValue)}`,
      tone: "muted",
    };
  }

  if (options.required) {
    return {
      resolved: null,
      hint: "No lodge default — set a price for this meeting.",
      tone: "warn",
    };
  }

  return {
    resolved: null,
    hint: "No price set and no lodge default. Treated as £0.00.",
    tone: "muted",
  };
}

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
  lodgeDefaults,
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
  lodgeDefaults: LodgeFeeDefaults | null;
}) {
  const [step, setStep] = useState<WizardStepId>("basics");

  const levyOrigin = useMemo(
    () =>
      describeFeeOrigin(
        form.meeting_fee_amount,
        lodgeDefaults?.default_member_levy_amount
      ),
    [form.meeting_fee_amount, lodgeDefaults]
  );
  const memberDiningOrigin = useMemo(
    () =>
      describeFeeOrigin(
        form.dining_price,
        lodgeDefaults?.default_member_dining_amount,
        { required: true }
      ),
    [form.dining_price, lodgeDefaults]
  );
  const guestDiningOrigin = useMemo(
    () =>
      describeFeeOrigin(
        form.guest_ticket_price,
        lodgeDefaults?.default_guest_dining_amount
      ),
    [form.guest_ticket_price, lodgeDefaults]
  );

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
              Attendance
            </h3>
            <p className="text-xs text-dash-muted">
              Who can RSVP, whether dinner is served, and whether members may
              bring guests. Fees are set in the next step.
            </p>

            <fieldset className="space-y-3 rounded-lg border border-dash-border bg-dash-surface p-4">
              <label className="flex items-center gap-2 text-sm font-medium text-dash-text">
                <input
                  type="checkbox"
                  checked={form.enable_rsvp}
                  onChange={(event) =>
                    updateForm({ enable_rsvp: event.target.checked })
                  }
                />
                Members can RSVP
              </label>
              {form.enable_rsvp && (
                <div className="grid gap-4 pl-6 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm text-dash-text" htmlFor="rsvp-deadline">
                      RSVP deadline
                    </label>
                    <Input
                      id="rsvp-deadline"
                      type="date"
                      value={form.rsvp_deadline}
                      onChange={(event) =>
                        updateForm({ rsvp_deadline: event.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm text-dash-text" htmlFor="max-attendees">
                      Max attendees
                    </label>
                    <Input
                      id="max-attendees"
                      type="number"
                      min="0"
                      placeholder="Leave blank for no limit"
                      value={form.max_attendees}
                      onChange={(event) =>
                        updateForm({ max_attendees: event.target.value })
                      }
                    />
                  </div>
                </div>
              )}
            </fieldset>

            <fieldset className="space-y-3 rounded-lg border border-dash-border bg-dash-surface p-4">
              <label className="flex items-center gap-2 text-sm font-medium text-dash-text">
                <input
                  type="checkbox"
                  checked={form.enable_dining_rsvp}
                  onChange={(event) =>
                    updateForm({ enable_dining_rsvp: event.target.checked })
                  }
                />
                Festive board is served
              </label>
              {form.enable_dining_rsvp && (
                <div className="space-y-2 pl-6">
                  <label className="text-sm text-dash-text" htmlFor="dining-description">
                    What is being served
                  </label>
                  <Input
                    id="dining-description"
                    placeholder="e.g. Three-course installation dinner at 7.30 pm"
                    value={form.dining_description}
                    onChange={(event) =>
                      updateForm({ dining_description: event.target.value })
                    }
                  />
                  <p className="text-xs text-dash-muted">
                    Shown to members in the summons and on the RSVP form.
                    Member and guest dining prices live in the next step.
                  </p>
                </div>
              )}
            </fieldset>

            <fieldset className="space-y-3 rounded-lg border border-dash-border bg-dash-surface p-4">
              <label className="flex items-center gap-2 text-sm font-medium text-dash-text">
                <input
                  type="checkbox"
                  checked={form.enable_guest_tickets}
                  onChange={(event) =>
                    updateForm({ enable_guest_tickets: event.target.checked })
                  }
                />
                Members may bring guests
              </label>
              <p className="pl-6 text-xs text-dash-muted">
                Members will be able to add guest names when they RSVP. Guest
                dining price is set in the next step.
              </p>
            </fieldset>
          </section>

          <section
            className={cn(
              "space-y-4 rounded-xl border border-dash-border bg-dash-surface-subtle p-4",
              step !== "fees" && "hidden"
            )}
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-dash-muted">
                  Fees
                </h3>
                <p className="mt-1 text-xs text-dash-muted">
                  Leave a price blank to use the lodge default. Set a number
                  here only when this meeting needs to differ.
                </p>
              </div>
              <Link
                href="/admin/treasurer?tab=meeting-dining"
                target="_blank"
                className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline"
              >
                Lodge defaults <ExternalLink className="h-3 w-3" />
              </Link>
            </div>

            <FeeRow
              title="Member meeting levy"
              description="Charged to every member who attends the ceremony."
              enabled={form.enable_meeting_fee}
              onToggle={(value) => updateForm({ enable_meeting_fee: value })}
              amountId="meeting-fee-amount"
              amount={form.meeting_fee_amount}
              onAmount={(value) => updateForm({ meeting_fee_amount: value })}
              originHint={levyOrigin.hint}
              originTone={levyOrigin.tone}
              descriptionId="meeting-fee-description"
              descriptionLabel="Description (optional)"
              descriptionPlaceholder="e.g. Per-meeting subscription"
              descriptionValue={form.meeting_fee_description}
              onDescription={(value) =>
                updateForm({ meeting_fee_description: value })
              }
            />

            <FeeRow
              title="Member dining"
              description="Charged when a member opts in to the festive board."
              enabled={form.enable_dining_rsvp}
              onToggle={(value) => updateForm({ enable_dining_rsvp: value })}
              gateNote={
                !form.enable_dining_rsvp
                  ? "Festive board is currently off. Enable it on the previous step to charge for dining."
                  : null
              }
              amountId="dining-price"
              amount={form.dining_price}
              onAmount={(value) => updateForm({ dining_price: value })}
              originHint={memberDiningOrigin.hint}
              originTone={memberDiningOrigin.tone}
            />

            {form.enable_dining_rsvp && (
              <label className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50/60 p-3 text-sm text-amber-900">
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
                    Use for installations or socials where the lodge is
                    covering dining. Members and guests are shown as
                    complimentary on the recipients panel and dining will
                    not be charged at checkout.
                  </p>
                </div>
              </label>
            )}

            <FeeRow
              title="Guest dining"
              description="Charged for each guest a member brings to the festive board."
              enabled={form.enable_guest_tickets}
              onToggle={(value) => updateForm({ enable_guest_tickets: value })}
              gateNote={
                !form.enable_guest_tickets
                  ? 'Guests are currently off. Enable "Members may bring guests" on the previous step to charge for guests.'
                  : null
              }
              amountId="guest-ticket-price"
              amount={form.guest_ticket_price}
              onAmount={(value) => updateForm({ guest_ticket_price: value })}
              originHint={guestDiningOrigin.hint}
              originTone={guestDiningOrigin.tone}
              descriptionId="guest-ticket-description"
              descriptionLabel="Description (optional)"
              descriptionPlaceholder="e.g. Includes ceremony and dining"
              descriptionValue={form.guest_ticket_description}
              onDescription={(value) =>
                updateForm({ guest_ticket_description: value })
              }
            />

            <fieldset className="space-y-3 rounded-lg border border-dash-border bg-dash-surface p-4">
              <label className="flex items-center gap-2 text-sm font-medium text-dash-text">
                <input
                  type="checkbox"
                  checked={form.enable_charity_donation}
                  onChange={(event) =>
                    updateForm({
                      enable_charity_donation: event.target.checked,
                    })
                  }
                />
                Collect a charity donation at this meeting
              </label>
              {form.enable_charity_donation && (
                <div className="grid gap-4 pl-6 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm text-dash-text" htmlFor="charity-name">
                      Charity name
                    </label>
                    <Input
                      id="charity-name"
                      placeholder="e.g. RMBI"
                      value={form.charity_name}
                      onChange={(event) =>
                        updateForm({ charity_name: event.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <label
                      className="text-sm text-dash-text"
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
                        updateForm({
                          charity_description: event.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <label
                      className="text-sm text-dash-text"
                      htmlFor="charity-suggested"
                    >
                      Suggested amounts (£)
                    </label>
                    <Input
                      id="charity-suggested"
                      placeholder="e.g. 10, 20, 50, 100"
                      value={form.charity_suggested_amounts}
                      onChange={(event) =>
                        updateForm({
                          charity_suggested_amounts: event.target.value,
                        })
                      }
                    />
                    <p className="text-xs text-dash-muted">
                      Comma-separated list. Members can tap one of these
                      buttons on the summons.
                    </p>
                  </div>
                  <label className="flex items-center gap-2 text-sm text-dash-text sm:col-span-2">
                    <input
                      type="checkbox"
                      checked={form.charity_allow_custom}
                      onChange={(event) =>
                        updateForm({
                          charity_allow_custom: event.target.checked,
                        })
                      }
                    />
                    Allow members to enter a custom amount
                  </label>
                </div>
              )}
            </fieldset>

            <fieldset className="space-y-3 rounded-lg border border-dash-border bg-dash-surface p-4">
              <label className="flex items-center gap-2 text-sm font-medium text-dash-text">
                <input
                  type="checkbox"
                  checked={form.enable_raffle_donation}
                  onChange={(event) =>
                    updateForm({
                      enable_raffle_donation: event.target.checked,
                    })
                  }
                />
                Sell strips of raffle tickets at this meeting
              </label>
              <p className="pl-6 text-xs text-dash-muted">
                Members pre-pay for a strip (or strips) of raffle tickets on
                the summons. The strips are drawn at the evening raffle on
                the night, with the proceeds funding the prizes.
              </p>
              {form.enable_raffle_donation && (
                <div className="grid gap-4 pl-6 sm:grid-cols-2">
                  <div className="space-y-2 sm:col-span-2">
                    <label
                      className="text-sm text-dash-text"
                      htmlFor="raffle-description"
                    >
                      Raffle ticket description
                    </label>
                    <Input
                      id="raffle-description"
                      placeholder="e.g. Buy strips of raffle tickets — proceeds fund the evening prizes"
                      value={form.raffle_description}
                      onChange={(event) =>
                        updateForm({ raffle_description: event.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <label
                      className="text-sm text-dash-text"
                      htmlFor="raffle-suggested"
                    >
                      Suggested strip prices (£)
                    </label>
                    <Input
                      id="raffle-suggested"
                      placeholder="e.g. 5, 10, 20, 50"
                      value={form.raffle_suggested_amounts}
                      onChange={(event) =>
                        updateForm({
                          raffle_suggested_amounts: event.target.value,
                        })
                      }
                    />
                    <p className="text-xs text-dash-muted">
                      Comma-separated list of price points members can tap
                      to buy a strip (or multiple strips) on the summons.
                    </p>
                  </div>
                  <label className="flex items-center gap-2 text-sm text-dash-text sm:col-span-2">
                    <input
                      type="checkbox"
                      checked={form.raffle_allow_custom}
                      onChange={(event) =>
                        updateForm({
                          raffle_allow_custom: event.target.checked,
                        })
                      }
                    />
                    Allow members to enter a custom amount
                  </label>
                </div>
              )}
            </fieldset>

            <fieldset className="space-y-3 rounded-lg border border-dash-border bg-dash-surface p-4">
              <label className="flex items-center gap-2 text-sm font-medium text-dash-text">
                <input
                  type="checkbox"
                  checked={form.enable_raffle_wine_pledge}
                  onChange={(event) =>
                    updateForm({
                      enable_raffle_wine_pledge: event.target.checked,
                    })
                  }
                />
                Invite members to pledge a bottle of wine for the raffle
              </label>
              {form.enable_raffle_wine_pledge && (
                <div className="grid gap-4 pl-6 sm:grid-cols-2">
                  <div className="space-y-2 sm:col-span-2">
                    <label
                      className="text-sm text-dash-text"
                      htmlFor="wine-description"
                    >
                      Wine pledge description
                    </label>
                    <Input
                      id="wine-description"
                      placeholder="e.g. Bring a bottle of wine for the evening raffle"
                      value={form.raffle_wine_description}
                      onChange={(event) =>
                        updateForm({
                          raffle_wine_description: event.target.value,
                        })
                      }
                    />
                    <p className="text-xs text-dash-muted">
                      Non-cash pledge. The bottle is the donation, so nothing
                      is charged at checkout. The steward gets a bring-list
                      on the recipients view.
                    </p>
                  </div>
                </div>
              )}
            </fieldset>
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
                </dd>
              </div>
              <div>
                <dt className="text-xs text-dash-muted">Festive board</dt>
                <dd className="font-medium text-dash-text">
                  {form.enable_dining_rsvp ? (
                    form.dining_waived_for_all ? (
                      "Complimentary for everyone"
                    ) : (
                      "Served"
                    )
                  ) : (
                    "Not served"
                  )}
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
              <div>
                <dt className="text-xs text-dash-muted">Raffle (cash)</dt>
                <dd className="font-medium text-dash-text">
                  {form.enable_raffle_donation ? "Enabled" : "Off"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-dash-muted">Wine pledge</dt>
                <dd className="font-medium text-dash-text">
                  {form.enable_raffle_wine_pledge ? "Enabled" : "Off"}
                </dd>
              </div>
            </dl>

            <FeeSummary
              form={form}
              levyResolved={levyOrigin.resolved}
              memberDiningResolved={memberDiningOrigin.resolved}
              guestDiningResolved={guestDiningOrigin.resolved}
            />
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

/**
 * One fee block on the Fees step. Always renders the toggle + amount field
 * (disabled when not enabled) so the height stays stable as the user opts in
 * and out. The hint line below the amount tells the user where the resolved
 * value will come from (lodge default vs custom).
 */
function FeeRow({
  title,
  description,
  enabled,
  onToggle,
  gateNote,
  amountId,
  amount,
  onAmount,
  originHint,
  originTone,
  descriptionId,
  descriptionLabel,
  descriptionPlaceholder,
  descriptionValue,
  onDescription,
}: {
  title: string;
  description: string;
  enabled: boolean;
  onToggle: (value: boolean) => void;
  gateNote?: string | null;
  amountId: string;
  amount: string;
  onAmount: (value: string) => void;
  originHint: string;
  originTone: "muted" | "warn";
  descriptionId?: string;
  descriptionLabel?: string;
  descriptionPlaceholder?: string;
  descriptionValue?: string;
  onDescription?: (value: string) => void;
}) {
  const disabled = !enabled;
  return (
    <fieldset
      className={cn(
        "space-y-3 rounded-lg border border-dash-border bg-dash-surface p-4",
        disabled && "opacity-80"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <label className="flex items-start gap-2 text-sm font-medium text-dash-text">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={enabled}
            onChange={(event) => onToggle(event.target.checked)}
          />
          <span>
            {title}
            <span className="mt-0.5 block text-xs font-normal text-dash-muted">
              {description}
            </span>
          </span>
        </label>
      </div>

      <div className="grid gap-3 pl-6 sm:grid-cols-[minmax(0,180px),1fr]">
        <div className="space-y-1">
          <label
            className={cn(
              "text-xs font-medium",
              disabled ? "text-dash-muted" : "text-dash-text"
            )}
            htmlFor={amountId}
          >
            Amount (£)
          </label>
          <MoneyInput
            id={amountId}
            value={amount}
            onChange={(value) => (disabled ? null : onAmount(value))}
          />
          <p
            className={cn(
              "text-xs",
              originTone === "warn" ? "text-amber-700" : "text-dash-muted"
            )}
          >
            {disabled
              ? gateNote ?? "Toggle on to charge this fee."
              : originHint}
          </p>
        </div>

        {descriptionId && onDescription && (
          <div className="space-y-1">
            <label
              className={cn(
                "text-xs font-medium",
                disabled ? "text-dash-muted" : "text-dash-text"
              )}
              htmlFor={descriptionId}
            >
              {descriptionLabel ?? "Description"}
            </label>
            <Input
              id={descriptionId}
              placeholder={descriptionPlaceholder}
              value={descriptionValue ?? ""}
              disabled={disabled}
              onChange={(event) => onDescription(event.target.value)}
            />
          </div>
        )}
      </div>
    </fieldset>
  );
}

/**
 * The "What members will be charged" block on the Review step. Uses the same
 * resolved amounts the resolver will use, so the user sees the lodge-default
 * fallback applied before they hit Save.
 */
function FeeSummary({
  form,
  levyResolved,
  memberDiningResolved,
  guestDiningResolved,
}: {
  form: MeetingForm;
  levyResolved: number | null;
  memberDiningResolved: number | null;
  guestDiningResolved: number | null;
}) {
  const levyOn = form.enable_meeting_fee;
  const diningOn = form.enable_dining_rsvp;
  const diningWaivedAll = form.dining_waived_for_all && diningOn;
  const guestsOn = form.enable_guest_tickets;

  const memberAttendingDiningTotal =
    (levyOn ? levyResolved ?? 0 : 0) +
    (diningOn && !diningWaivedAll ? memberDiningResolved ?? 0 : 0);

  const memberCeremonyOnlyTotal = levyOn ? levyResolved ?? 0 : 0;
  const guestTotal = guestsOn && !diningWaivedAll ? guestDiningResolved ?? 0 : 0;

  const hasAnyCharge =
    memberAttendingDiningTotal > 0 ||
    memberCeremonyOnlyTotal > 0 ||
    guestTotal > 0 ||
    form.enable_charity_donation ||
    form.enable_raffle_donation ||
    form.enable_raffle_wine_pledge;

  if (!hasAnyCharge && !diningWaivedAll) {
    return (
      <p className="rounded-lg border border-dash-border bg-dash-surface-subtle px-3 py-2 text-xs text-dash-muted">
        No fees configured. Members and guests attend free.
      </p>
    );
  }

  return (
    <div className="space-y-2 rounded-lg border border-dash-border bg-dash-surface-subtle p-3 text-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-dash-muted">
        What attendees will be charged
      </p>
      <ul className="space-y-1">
        {levyOn && (
          <SummaryRow
            label="Member attending ceremony only"
            value={memberCeremonyOnlyTotal}
            zeroFallback={
              levyResolved == null
                ? "No price set"
                : undefined
            }
          />
        )}
        {diningOn && (
          <SummaryRow
            label="Member attending dining"
            value={memberAttendingDiningTotal}
            waived={diningWaivedAll && memberAttendingDiningTotal === 0 && !levyOn}
            zeroFallback={
              diningWaivedAll
                ? "Dining complimentary"
                : memberDiningResolved == null
                ? "No price set"
                : undefined
            }
          />
        )}
        {guestsOn && (
          <SummaryRow
            label="Each guest"
            value={guestTotal}
            waived={diningWaivedAll}
            zeroFallback={
              diningWaivedAll
                ? "Dining complimentary"
                : guestDiningResolved == null
                ? "No price set"
                : undefined
            }
          />
        )}
        {form.enable_charity_donation && (
          <li className="flex items-center justify-between gap-3 text-dash-text">
            <span>Charity collection</span>
            <span className="text-dash-muted">{form.charity_name || "(no name)"}</span>
          </li>
        )}
        {form.enable_raffle_donation && (
          <li className="flex items-center justify-between gap-3 text-dash-text">
            <span>Raffle tickets</span>
            <span className="text-dash-muted">Optional contribution</span>
          </li>
        )}
        {form.enable_raffle_wine_pledge && (
          <li className="flex items-center justify-between gap-3 text-dash-text">
            <span>Wine pledge</span>
            <span className="text-dash-muted">Bring a bottle (non-cash)</span>
          </li>
        )}
      </ul>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  waived,
  zeroFallback,
}: {
  label: string;
  value: number;
  waived?: boolean;
  zeroFallback?: string;
}) {
  return (
    <li className="flex items-center justify-between gap-3 text-dash-text">
      <span>{label}</span>
      <span
        className={cn(
          "font-medium tabular-nums",
          waived && "text-emerald-700"
        )}
      >
        {value === 0 && zeroFallback ? zeroFallback : `£${value.toFixed(2)}`}
      </span>
    </li>
  );
}
