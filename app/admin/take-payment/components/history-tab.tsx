"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { History as HistoryIcon, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { HistoryRow } from "./history-row";
import type { HistoryItem, HistoryMethod } from "./types";

// History tab. Mixed feed of card QRs + cash entries with method and status
// filters. Driven entirely by the data; the row component does the rendering
// per entry.

type MethodFilter = "all" | HistoryMethod;
type StatusFilter = "all" | "open" | "paid" | "issues";

export function HistoryTab({
  items,
  loading,
  onRefresh,
  onReopen,
  onAction,
  focusId,
}: {
  items: HistoryItem[];
  loading: boolean;
  onRefresh: () => void;
  onReopen: (item: HistoryItem) => void;
  // onAction handles both QR Cancel and Cash Void — endpoint is the same
  // and the server picks behaviour from the underlying intent.
  onAction: (item: HistoryItem) => Promise<void>;
  focusId?: string | null;
}) {
  const [method, setMethod] = useState<MethodFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const focusedRowRef = useRef<HTMLDivElement | null>(null);

  // Scroll a focused row into view exactly once when the tab mounts. The
  // Charge/Cash tabs deep-link here with ?focus=<id> after recording a cash
  // payment so the admin sees the new entry without scrolling.
  useEffect(() => {
    if (!focusId) return;
    const el = document.querySelector(
      `[data-payment-id="${CSS.escape(focusId)}"]`,
    );
    if (el && "scrollIntoView" in el) {
      (el as HTMLElement).scrollIntoView({
        block: "center",
        behavior: "smooth",
      });
    }
  }, [focusId, items.length]);

  const counts = useMemo(() => {
    let qr = 0;
    let cash = 0;
    let open = 0;
    for (const item of items) {
      if (item.method === "card_qr") qr++;
      else if (item.method === "cash") cash++;
      if (item.derived_status === "open") open++;
    }
    return { all: items.length, qr, cash, open };
  }, [items]);

  const filtered = useMemo(() => {
    return items.filter((item) => {
      if (method !== "all" && item.method !== method) return false;
      if (status === "open" && item.derived_status !== "open") return false;
      if (status === "paid" && item.derived_status !== "paid") return false;
      if (
        status === "issues" &&
        item.derived_status !== "expired" &&
        item.derived_status !== "cancelled" &&
        item.derived_status !== "failed" &&
        item.derived_status !== "voided"
      ) {
        return false;
      }
      return true;
    });
  }, [items, method, status]);

  const handleAction = useCallback(
    async (item: HistoryItem) => {
      setBusyId(item.payment_id);
      try {
        await onAction(item);
      } finally {
        setBusyId(null);
      }
    },
    [onAction],
  );

  return (
    <div className="space-y-3" ref={focusedRowRef}>
      <Card className="overflow-hidden p-0">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50/60 px-3 py-3 sm:px-4">
          <div className="flex items-center gap-2">
            <HistoryIcon className="h-4 w-4 text-slate-500" />
            <h3 className="text-sm font-semibold text-slate-800">
              Recent payments
            </h3>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onRefresh}
            disabled={loading}
            aria-label="Refresh"
            className="h-8 px-2"
          >
            <RefreshCw
              className={cn(
                "h-4 w-4 text-slate-500",
                loading && "animate-spin",
              )}
            />
          </Button>
        </div>
        <div className="flex flex-wrap gap-2 border-b border-slate-200 px-3 py-3 sm:px-4">
          <FilterChip
            active={method === "all"}
            label={`All ${counts.all}`}
            onClick={() => setMethod("all")}
          />
          <FilterChip
            active={method === "card_qr"}
            label={`QR ${counts.qr}`}
            onClick={() => setMethod("card_qr")}
          />
          <FilterChip
            active={method === "cash"}
            label={`Cash ${counts.cash}`}
            onClick={() => setMethod("cash")}
          />
          <span className="mx-1 hidden h-6 w-px bg-slate-200 sm:inline-block" />
          <FilterChip
            active={status === "all"}
            label="Any status"
            onClick={() => setStatus("all")}
          />
          <FilterChip
            active={status === "open"}
            label={`Open${counts.open ? ` ${counts.open}` : ""}`}
            onClick={() => setStatus("open")}
          />
          <FilterChip
            active={status === "paid"}
            label="Paid"
            onClick={() => setStatus("paid")}
          />
          <FilterChip
            active={status === "issues"}
            label="Issues"
            onClick={() => setStatus("issues")}
          />
        </div>

        {filtered.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-slate-500 sm:px-6">
            {loading
              ? "Loading recent payments…"
              : items.length === 0
                ? "No payments yet. Go to Charge or Cash to take your first one."
                : "Nothing matches the current filter."}
          </div>
        ) : (
          <ul className="divide-y divide-slate-200">
            {filtered.map((item) => (
              <HistoryRow
                key={item.payment_id}
                item={item}
                onReopen={() => onReopen(item)}
                onCancel={() => void handleAction(item)}
                cancelling={busyId === item.payment_id}
                focused={focusId === item.payment_id}
              />
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function FilterChip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "touch-pad inline-flex h-8 items-center rounded-full px-3 text-xs font-medium transition-colors",
        active
          ? "bg-slate-900 text-white"
          : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
      )}
    >
      {label}
    </button>
  );
}
