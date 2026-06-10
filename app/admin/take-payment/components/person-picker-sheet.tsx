"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Loader2, Plus, Search, UserPlus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  GuestInlineDraft,
  GuestOption,
  MemberOption,
  PayerSelection,
} from "./types";

// Unified picker for the "Payer" control. Used by PayerRow in both Charge
// and Cash tabs. Two modes:
//
//   mode="member" — fuzzy-filters a locally-passed members[] array.
//   mode="guest"  — debounced server search of the guests directory via
//                   /api/admin/take-payment/guests, with an inline "Add new
//                   guest" form that finds-or-creates on submit.
//
// The sheet returns a fully-resolved PayerSelection, never a bare id, so the
// caller can immediately render the selected payer without a round-trip.

type PersonPickerSheetProps = {
  open: boolean;
  mode: "member" | "guest";
  members: MemberOption[];
  onClose: () => void;
  onPick: (selection: PayerSelection) => void;
};

export function PersonPickerSheet({
  open,
  mode,
  members,
  onClose,
  onPick,
}: PersonPickerSheetProps) {
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"list" | "add_guest">("list");
  const inputRef = useRef<HTMLInputElement>(null);

  // Guest mode state. The list is async because the guests directory can be
  // huge on busy churches and we don't want to ship the whole thing to every
  // mobile client at page load.
  const [guests, setGuests] = useState<GuestOption[]>([]);
  const [guestsLoading, setGuestsLoading] = useState(false);
  const [guestsError, setGuestsError] = useState<string | null>(null);

  // New-guest inline form.
  const [draft, setDraft] = useState<GuestInlineDraft>({
    full_name: "",
    email: null,
    phone: null,
    mother_church_name: null,
    mother_church_number: null,
  });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Reset state when the sheet opens/closes so the next open is a clean
  // slate. Doing this when `open` flips means we don't briefly render stale
  // results from the previous payer selection.
  useEffect(() => {
    if (open) {
      setView("list");
      setQuery("");
      setDraft({
        full_name: "",
        email: null,
        phone: null,
        mother_church_name: null,
        mother_church_number: null,
      });
      setCreateError(null);
    }
  }, [open, mode]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    // Defer focus a tick so the sheet animates in before the iOS keyboard
    // jumps up; otherwise the layout can flash.
    const id = setTimeout(() => inputRef.current?.focus(), 60);
    return () => clearTimeout(id);
  }, [open, view]);

  const fetchGuests = useCallback(async (q: string) => {
    setGuestsLoading(true);
    setGuestsError(null);
    try {
      const url = new URL(
        "/api/admin/take-payment/guests",
        window.location.origin,
      );
      if (q.trim()) url.searchParams.set("q", q.trim());
      const res = await fetch(url.toString(), { credentials: "same-origin" });
      if (!res.ok) {
        throw new Error(`Failed (${res.status})`);
      }
      const data = (await res.json()) as { guests: GuestOption[] };
      setGuests(Array.isArray(data.guests) ? data.guests : []);
    } catch (err) {
      setGuestsError(
        err instanceof Error ? err.message : "Could not load guests.",
      );
      setGuests([]);
    } finally {
      setGuestsLoading(false);
    }
  }, []);

  // Debounce guest search. Member search filters in-memory so it doesn't
  // need the debounce.
  useEffect(() => {
    if (!open || mode !== "guest" || view !== "list") return;
    const id = setTimeout(() => {
      void fetchGuests(query);
    }, 200);
    return () => clearTimeout(id);
  }, [open, mode, view, query, fetchGuests]);

  const filteredMembers = useMemo(() => {
    if (mode !== "member") return [];
    if (!query.trim()) return members.slice(0, 200);
    const q = query.trim().toLowerCase();
    return members
      .filter((m) => {
        const name = m.full_name.toLowerCase();
        const email = (m.email ?? "").toLowerCase();
        return name.includes(q) || email.includes(q);
      })
      .slice(0, 200);
  }, [mode, members, query]);

  const handleClose = () => {
    setQuery("");
    setView("list");
    onClose();
  };

  const handleAddGuest = async () => {
    const fullName = draft.full_name.trim();
    if (!fullName) {
      setCreateError("Full name is required.");
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      const res = await fetch("/api/admin/take-payment/guests", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: fullName,
          email: draft.email ?? undefined,
          phone: draft.phone ?? undefined,
          mother_church_name: draft.mother_church_name ?? undefined,
          mother_church_number: draft.mother_church_number ?? undefined,
        }),
      });
      const json = (await res.json()) as
        | { guest: GuestOption }
        | { error: string };
      if (!res.ok || "error" in json) {
        setCreateError(
          "error" in json ? json.error : `Could not add guest (${res.status}).`,
        );
        return;
      }
      onPick({ kind: "guest", guest: json.guest });
      handleClose();
    } catch (err) {
      setCreateError(
        err instanceof Error ? err.message : "Could not add the guest.",
      );
    } finally {
      setCreating(false);
    }
  };

  if (!open) return null;

  const title = mode === "guest" ? "Pick guest" : "Pick member";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 sm:items-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div
        className={cn(
          "flex w-full flex-col bg-white shadow-2xl",
          "max-h-[90dvh] rounded-t-2xl pb-[env(safe-area-inset-bottom)]",
          "sm:max-h-[80vh] sm:max-w-md sm:rounded-2xl sm:pb-0",
        )}
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            {view === "add_guest" ? (
              <button
                type="button"
                onClick={() => setView("list")}
                aria-label="Back"
                className="touch-pad rounded-md p-1.5 text-slate-500 hover:bg-slate-100"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            ) : null}
            <h2 className="text-sm font-semibold text-slate-800">
              {view === "add_guest" ? "Add new guest" : title}
            </h2>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close"
            className="touch-pad rounded-md p-1.5 text-slate-500 hover:bg-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {view === "list" ? (
          <>
            <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3">
              <Search className="h-4 w-4 shrink-0 text-slate-400" />
              <input
                ref={inputRef}
                type="text"
                inputMode="search"
                enterKeyHint="search"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                placeholder={
                  mode === "guest"
                    ? "Search guests by name or email…"
                    : "Search members by name or email…"
                }
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="ios-input w-full bg-transparent outline-none placeholder:text-slate-400"
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label="Clear search"
                  className="touch-pad rounded-md p-1 text-slate-400 hover:text-slate-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>

            <ul className="flex-1 overflow-y-auto overscroll-contain">
              {mode === "guest" ? (
                <li className="border-b border-slate-100">
                  <button
                    type="button"
                    onClick={() => setView("add_guest")}
                    className="touch-pad flex w-full items-center gap-3 px-4 py-3 text-left text-emerald-700 hover:bg-emerald-50/60 active:bg-emerald-100/70"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100">
                      <UserPlus className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">Add new guest</p>
                      <p className="text-xs text-emerald-700/80">
                        Capture name, email, and mother church for the receipt.
                      </p>
                    </div>
                  </button>
                </li>
              ) : null}

              {mode === "guest" && guestsLoading ? (
                <li className="flex items-center gap-2 px-4 py-6 text-sm text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading guests…
                </li>
              ) : null}

              {mode === "guest" && guestsError ? (
                <li className="px-4 py-6 text-sm text-rose-600">
                  {guestsError}
                </li>
              ) : null}

              {mode === "guest" && !guestsLoading && !guestsError ? (
                guests.length === 0 ? (
                  <li className="px-4 py-10 text-center text-sm text-slate-500">
                    {query.trim()
                      ? `No guests match "${query}". Tap "Add new guest" above.`
                      : "No guests yet. Tap \"Add new guest\" to capture one for the receipt."}
                  </li>
                ) : (
                  guests.map((g) => (
                    <li key={g.id}>
                      <button
                        type="button"
                        onClick={() => {
                          onPick({ kind: "guest", guest: g });
                          handleClose();
                        }}
                        className="touch-pad flex w-full items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 text-left hover:bg-slate-50 active:bg-slate-100"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-slate-800">
                            {g.full_name}
                          </p>
                          <p className="truncate text-xs text-slate-500">
                            {g.email
                              ? g.email
                              : g.mother_church_name
                                ? g.mother_church_name
                                : "Guest"}
                          </p>
                        </div>
                      </button>
                    </li>
                  ))
                )
              ) : null}

              {mode === "member"
                ? filteredMembers.length === 0
                  ? (
                    <li className="px-4 py-10 text-center text-sm text-slate-500">
                      {query.trim()
                        ? `No members match "${query}".`
                        : "No active members in this church yet."}
                    </li>
                  )
                  : filteredMembers.map((m) => (
                      <li key={m.id}>
                        <button
                          type="button"
                          onClick={() => {
                            onPick({ kind: "member", member: m });
                            handleClose();
                          }}
                          className="touch-pad flex w-full items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 text-left hover:bg-slate-50 active:bg-slate-100"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-slate-800">
                              {m.full_name}
                            </p>
                            {m.email ? (
                              <p className="truncate text-xs text-slate-500">
                                {m.email}
                              </p>
                            ) : null}
                          </div>
                        </button>
                      </li>
                    ))
                : null}
            </ul>
          </>
        ) : (
          <div className="flex-1 overflow-y-auto px-4 py-4">
            <div className="space-y-3">
              <Field
                label="Full name"
                required
                inputRef={inputRef}
                value={draft.full_name}
                onChange={(v) => setDraft({ ...draft, full_name: v })}
                placeholder="W.Bro. John Smith"
                autoCapitalize="words"
              />
              <Field
                label="Email"
                type="email"
                value={draft.email ?? ""}
                onChange={(v) =>
                  setDraft({ ...draft, email: v.trim() ? v : null })
                }
                placeholder="receipt destination"
                hint="We'll send a receipt and use this for Gift Aid lookup."
              />
              <Field
                label="Phone"
                type="tel"
                value={draft.phone ?? ""}
                onChange={(v) =>
                  setDraft({ ...draft, phone: v.trim() ? v : null })
                }
                placeholder="Optional"
              />
              <Field
                label="Mother church"
                value={draft.mother_church_name ?? ""}
                onChange={(v) =>
                  setDraft({
                    ...draft,
                    mother_church_name: v.trim() ? v : null,
                  })
                }
                placeholder="Optional"
                autoCapitalize="words"
              />
              <Field
                label="Church number"
                value={draft.mother_church_number ?? ""}
                onChange={(v) =>
                  setDraft({
                    ...draft,
                    mother_church_number: v.trim() ? v : null,
                  })
                }
                placeholder="Optional"
              />
            </div>

            {createError ? (
              <p className="mt-3 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {createError}
              </p>
            ) : null}

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setView("list")}
                className="touch-pad flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleAddGuest}
                disabled={creating || !draft.full_name.trim()}
                className="touch-pad flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
              >
                {creating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                Add guest
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  required = false,
  hint,
  autoCapitalize = "none",
  inputRef,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: "text" | "email" | "tel";
  required?: boolean;
  hint?: string;
  autoCapitalize?: "none" | "words" | "sentences";
  inputRef?: React.Ref<HTMLInputElement>;
}) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-slate-600">
        {label}
        {required ? <span className="ml-1 text-rose-500">*</span> : null}
      </span>
      <input
        ref={inputRef}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoCapitalize={autoCapitalize}
        autoComplete={
          type === "email"
            ? "email"
            : type === "tel"
              ? "tel"
              : autoCapitalize === "words"
                ? "name"
                : "off"
        }
        autoCorrect="off"
        spellCheck={false}
        className="ios-input mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-slate-900 shadow-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
      />
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </label>
  );
}
