"use client";

import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDate } from "@/lib/utils";
import { CATEGORIES, type CategoryId, type EventOption } from "./types";

// Collapsible "extras" panel: meeting link, category, reference, receipt
// note. Hidden by default to keep the entry form to the essentials — most
// treasurers just want to type £20 and hit go.

const NO_EVENT_VALUE = "__none__";

export function ExtrasSection({
  category,
  setCategory,
  reference,
  setReference,
  description,
  setDescription,
  events,
  eventId,
  setEventId,
  note,
  setNote,
  showNote,
  defaultOpen,
}: {
  category: CategoryId;
  setCategory: (v: CategoryId) => void;
  reference: string;
  setReference: (v: string) => void;
  description: string;
  setDescription: (v: string) => void;
  events: EventOption[];
  eventId: string | null;
  setEventId: (v: string | null) => void;
  note?: string;
  setNote?: (v: string) => void;
  showNote?: boolean;
  /** Initial collapsed/open state. Pages that deep-link with a preset
   *  event_id or non-default category pass true so the operator sees the
   *  inherited selections without having to expand the section first. */
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(Boolean(defaultOpen));

  const filled =
    category !== "general" || reference || description || note || eventId;

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/60">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-slate-700"
        aria-expanded={open}
      >
        <span>
          {open ? "Hide" : "Add"} category, reference, or receipt note
        </span>
        <span className="text-xs text-slate-500">
          {filled ? "Filled in" : "Optional"}
        </span>
      </button>
      {open ? (
        <div className="space-y-4 border-t border-slate-200 p-4">
          {events.length > 0 ? (
            <div className="space-y-2">
              <Label htmlFor="tp-event">Link to meeting (optional)</Label>
              <Select
                value={eventId ?? NO_EVENT_VALUE}
                onValueChange={(v) =>
                  setEventId(v === NO_EVENT_VALUE ? null : v)
                }
              >
                <SelectTrigger id="tp-event">
                  <SelectValue placeholder="No meeting" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_EVENT_VALUE}>No meeting</SelectItem>
                  {events.map((event) => (
                    <SelectItem key={event.id} value={event.id}>
                      {event.title} · {formatDate(event.event_date)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Roll this payment into a specific meeting&apos;s &quot;Money raised&quot; total.
              </p>
            </div>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="tp-category">Category</Label>
            <Select
              value={category}
              onValueChange={(v) => setCategory(v as CategoryId)}
            >
              <SelectTrigger id="tp-category">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="tp-reference">Reference (optional)</Label>
            <Input
              id="tp-reference"
              type="text"
              placeholder="Bro. Smith — raffle prize"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              maxLength={120}
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              className="ios-input"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tp-description">
              Description on receipt (optional)
            </Label>
            <Input
              id="tp-description"
              type="text"
              placeholder="Festive Board top-up — 5 June"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={140}
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              className="ios-input"
            />
          </div>
          {showNote && setNote ? (
            <div className="space-y-2">
              <Label htmlFor="tp-note">
                Cash note (internal — not shown to payer)
              </Label>
              <Input
                id="tp-note"
                type="text"
                placeholder="e.g. handed to Treasurer at the bar"
                value={note ?? ""}
                onChange={(e) => setNote(e.target.value)}
                maxLength={280}
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                className="ios-input"
              />
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
