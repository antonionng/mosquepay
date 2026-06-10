"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MemberOption } from "./types";

// Full-screen-on-phone / centred-card-on-tablet member picker. Used by the
// Charge and Cash tabs through PayerRow. Search input is 16px to avoid iOS
// auto-zoom, body scroll is locked while the sheet is open.

export function MemberPickerSheet({
  members,
  open,
  onPick,
  onClose,
}: {
  members: MemberOption[];
  open: boolean;
  onPick: (m: MemberOption) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

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
  }, [open]);

  // When the picker closes we reset the query so re-opening is a clean
  // slate. Doing this in onClose instead of an effect keeps the search box
  // visibly clear at the moment the user re-opens it.
  const handleClose = () => {
    setQuery("");
    onClose();
  };

  const filtered = useMemo(() => {
    if (!query.trim()) return members.slice(0, 200);
    const q = query.trim().toLowerCase();
    return members
      .filter((m) => {
        const name = m.full_name.toLowerCase();
        const email = (m.email ?? "").toLowerCase();
        return name.includes(q) || email.includes(q);
      })
      .slice(0, 200);
  }, [members, query]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Pick member"
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 sm:items-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div
        className={cn(
          "flex w-full flex-col bg-white shadow-2xl",
          "max-h-[85dvh] rounded-t-2xl pb-[env(safe-area-inset-bottom)]",
          "sm:max-h-[70vh] sm:max-w-md sm:rounded-2xl sm:pb-0",
        )}
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-800">Pick member</h2>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close"
            className="touch-pad rounded-md p-1.5 text-slate-500 hover:bg-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
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
            placeholder="Search by name or email…"
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
          {filtered.length === 0 ? (
            <li className="px-4 py-10 text-center text-sm text-slate-500">
              {query.trim()
                ? `No members match "${query}".`
                : "No active members in this church yet."}
            </li>
          ) : (
            filtered.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    onPick(m);
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
          )}
        </ul>
      </div>
    </div>
  );
}
