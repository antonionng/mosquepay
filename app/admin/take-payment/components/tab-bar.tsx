"use client";

import { cn } from "@/lib/utils";
import { Banknote, History as HistoryIcon, ScanLine } from "lucide-react";
import type { TabId } from "./types";

// Sticky segmented control sitting just below the iOS status bar
// (top inset). Three tabs:
//   * Charge  — card QR (the default)
//   * Cash    — treasurer-recorded cash
//   * Recent  — combined history for both
//
// Count badge on Recent shows the number of currently-open QRs so the
// duty officer notices a pending payment even when they're on another tab.

const TAB_DEFS: Array<{ id: TabId; label: string; Icon: typeof Banknote }> = [
  { id: "charge", label: "Charge", Icon: ScanLine },
  { id: "cash", label: "Cash", Icon: Banknote },
  { id: "history", label: "Recent", Icon: HistoryIcon },
];

export function TabBar({
  value,
  onChange,
  openCount,
  className,
}: {
  value: TabId;
  onChange: (next: TabId) => void;
  openCount: number;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label="Take payment views"
      className={cn(
        // Stick the bar to the very top of the kiosk viewport so it never
        // scrolls off-screen, but offset by the safe-area inset so it
        // doesn't sit under the iOS clock.
        "sticky top-[env(safe-area-inset-top)] z-20",
        "-mx-3 sm:-mx-4 lg:mx-0",
        "border-b border-slate-200 bg-white/90 px-3 py-2 backdrop-blur supports-[backdrop-filter]:bg-white/75 sm:px-4 lg:rounded-2xl lg:border lg:px-2 lg:py-2",
        className,
      )}
    >
      <div className="grid grid-cols-3 gap-1">
        {TAB_DEFS.map((tab) => {
          const active = tab.id === value;
          const showCount = tab.id === "history" && openCount > 0;
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={active}
              type="button"
              onClick={() => onChange(tab.id)}
              className={cn(
                "touch-pad relative flex h-11 items-center justify-center gap-1.5 rounded-lg text-sm font-medium transition-colors",
                active
                  ? "bg-slate-950 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-100",
              )}
            >
              <tab.Icon className="h-4 w-4" />
              <span>{tab.label}</span>
              {showCount ? (
                <span
                  aria-label={`${openCount} open`}
                  className={cn(
                    "ml-1 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full px-1.5 text-[11px] font-semibold",
                    active
                      ? "bg-white/15 text-white"
                      : "bg-amber-100 text-amber-800",
                  )}
                >
                  {openCount}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
