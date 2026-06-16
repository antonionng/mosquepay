"use client";

import { CalendarCheck2, CalendarPlus } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDate } from "@/lib/utils";
import type { EventOption } from "./types";

// Prominent, always-visible service selector for the POS. The single biggest
// reconciliation problem is takings that never got tagged to a service, so we
// surface this above the fold (not buried in "Extras") and pre-select today's
// service when there's an obvious one. The duty officer confirms rather than
// has to remember.

const NO_EVENT_VALUE = "__none__";

export function ServiceLinkField({
  events,
  eventId,
  setEventId,
  autoSelected,
}: {
  events: EventOption[];
  eventId: string | null;
  setEventId: (v: string | null) => void;
  /** True when we pre-selected today's Jumu'ah (vs the operator choosing). */
  autoSelected?: boolean;
}) {
  if (events.length === 0) return null;

  const selected = events.find((e) => e.id === eventId) ?? null;

  return (
    <div
      className={
        selected
          ? "rounded-xl border border-emerald-300 bg-emerald-50/70 p-3"
          : "rounded-xl border border-amber-300 bg-amber-50/60 p-3"
      }
    >
      <div className="mb-2 flex items-center gap-2">
        {selected ? (
          <CalendarCheck2 className="h-4 w-4 text-emerald-700" />
        ) : (
          <CalendarPlus className="h-4 w-4 text-amber-700" />
        )}
        <span
          className={
            selected
              ? "text-sm font-semibold text-emerald-900"
              : "text-sm font-semibold text-amber-900"
          }
        >
          {selected ? "Linked to a service" : "Which service is this for?"}
        </span>
        {autoSelected && selected ? (
          <span className="ml-auto rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
            Today
          </span>
        ) : null}
      </div>
      <Select
        value={eventId ?? NO_EVENT_VALUE}
        onValueChange={(v) => setEventId(v === NO_EVENT_VALUE ? null : v)}
      >
        <SelectTrigger className="h-11 bg-white text-base">
          <SelectValue placeholder="Choose a service" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NO_EVENT_VALUE}>Not for a service</SelectItem>
          {events.map((event) => (
            <SelectItem key={event.id} value={event.id}>
              {event.title} · {formatDate(event.event_date)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p
        className={
          selected
            ? "mt-1.5 text-xs text-emerald-700"
            : "mt-1.5 text-xs text-amber-700"
        }
      >
        {selected
          ? "This payment will roll into the service's totals and reconciliation."
          : "Linking now saves reconciling later. Pick the service these takings are for, or leave as “Not for a service”."}
      </p>
    </div>
  );
}
