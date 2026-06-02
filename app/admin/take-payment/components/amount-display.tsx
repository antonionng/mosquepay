"use client";

import { useCallback, useMemo } from "react";
import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

// The big slate-black "amount to take" panel. Shared between the Charge and
// Cash tabs so the visual identity stays consistent. The +£5 / +£10 / -£5
// adjusters live here as well — treasurers often round up after counting
// notes and the adjusters beat re-typing the whole figure on a phone.

export function AmountDisplay({
  amount,
  setAmount,
  label,
  ariaLabel,
  readOnly,
}: {
  amount: string;
  setAmount: React.Dispatch<React.SetStateAction<string>>;
  label: string;
  ariaLabel?: string;
  /** Itemised mode: the amount is the computed basket total, so we hide the
   *  +/- adjusters and Clear and show the figure as read-only. */
  readOnly?: boolean;
}) {
  const displayAmount = useMemo(() => {
    if (!amount) return "0.00";
    const n = Number(amount);
    if (!Number.isFinite(n)) return amount;
    return n.toFixed(
      amount.includes(".")
        ? Math.min(2, amount.split(".")[1]?.length ?? 0)
        : 2,
    );
  }, [amount]);

  const adjust = useCallback(
    (delta: number) => {
      setAmount((prev) => {
        const current = Number(prev || "0");
        const next = Math.max(0, Math.min(5000, current + delta));
        return next === 0 ? "" : String(Number(next.toFixed(2)));
      });
    },
    [setAmount],
  );

  const clearAmount = useCallback(() => {
    setAmount("");
  }, [setAmount]);

  return (
    <div
      className="rounded-2xl bg-slate-950 px-4 py-5 text-white shadow-inner sm:py-8"
      aria-label={ariaLabel}
    >
      <p className="text-center text-[10px] font-medium uppercase tracking-[0.18em] text-slate-400 sm:text-xs">
        {label}
      </p>
      <div className="mt-1.5 flex items-center justify-center gap-2 sm:mt-2">
        <span className="text-3xl font-semibold text-slate-300 sm:text-4xl">
          £
        </span>
        <span
          className={cn(
            "tabular-nums font-semibold tracking-tight",
            amount ? "text-white" : "text-slate-500",
            "text-5xl sm:text-6xl",
          )}
        >
          {displayAmount}
        </span>
      </div>
      {readOnly ? (
        <p className="mt-2 text-center text-[11px] font-medium uppercase tracking-wide text-slate-400">
          Itemised total
        </p>
      ) : (
      <div className="mt-3 flex items-center justify-center gap-1.5 sm:mt-4 sm:gap-2">
        <button
          type="button"
          onClick={() => adjust(-5)}
          className="touch-pad inline-flex h-8 items-center gap-1 rounded-full bg-slate-800/80 px-2.5 text-[11px] font-medium text-slate-200 hover:bg-slate-700 sm:h-9 sm:px-3 sm:text-xs"
          aria-label="Decrease by £5"
        >
          <Minus className="h-3 w-3 sm:h-3.5 sm:w-3.5" /> £5
        </button>
        <button
          type="button"
          onClick={() => adjust(5)}
          className="touch-pad inline-flex h-8 items-center gap-1 rounded-full bg-slate-800/80 px-2.5 text-[11px] font-medium text-slate-200 hover:bg-slate-700 sm:h-9 sm:px-3 sm:text-xs"
          aria-label="Increase by £5"
        >
          <Plus className="h-3 w-3 sm:h-3.5 sm:w-3.5" /> £5
        </button>
        <button
          type="button"
          onClick={() => adjust(10)}
          className="touch-pad inline-flex h-8 items-center gap-1 rounded-full bg-slate-800/80 px-2.5 text-[11px] font-medium text-slate-200 hover:bg-slate-700 sm:h-9 sm:px-3 sm:text-xs"
          aria-label="Increase by £10"
        >
          <Plus className="h-3 w-3 sm:h-3.5 sm:w-3.5" /> £10
        </button>
        {amount ? (
          <button
            type="button"
            onClick={clearAmount}
            className="touch-pad inline-flex h-8 items-center gap-1 rounded-full bg-red-500/15 px-2.5 text-[11px] font-medium text-red-300 hover:bg-red-500/25 sm:h-9 sm:px-3 sm:text-xs"
          >
            Clear
          </button>
        ) : null}
      </div>
      )}
    </div>
  );
}
