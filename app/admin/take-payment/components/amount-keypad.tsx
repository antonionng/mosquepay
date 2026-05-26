"use client";

import { useCallback } from "react";
import { Delete } from "lucide-react";
import { cn } from "@/lib/utils";
import { PRESET_AMOUNTS } from "./types";

// Built-in 3x4 numeric keypad. Lives outside the browser's native keyboard
// so iOS doesn't squash the rest of the form when amount entry is the
// active control. Pairs with AmountDisplay.

export function AmountKeypad({
  setAmount,
}: {
  setAmount: React.Dispatch<React.SetStateAction<string>>;
}) {
  const appendDigit = useCallback(
    (digit: string) => {
      setAmount((prev) => {
        if (digit === ".") {
          if (prev.includes(".")) return prev;
          return prev === "" ? "0." : `${prev}.`;
        }
        if (prev === "0" && digit !== ".") return digit;
        const next = prev + digit;
        const [, decimals] = next.split(".");
        if (decimals && decimals.length > 2) return prev;
        if (Number(next) > 5000) return prev;
        return next;
      });
    },
    [setAmount],
  );

  const backspace = useCallback(() => {
    setAmount((prev) => prev.slice(0, -1));
  }, [setAmount]);

  const keys: Array<{
    label: React.ReactNode;
    value: string;
    onClick?: () => void;
    aria?: string;
  }> = [
    { label: "1", value: "1" },
    { label: "2", value: "2" },
    { label: "3", value: "3" },
    { label: "4", value: "4" },
    { label: "5", value: "5" },
    { label: "6", value: "6" },
    { label: "7", value: "7" },
    { label: "8", value: "8" },
    { label: "9", value: "9" },
    { label: ".", value: "." },
    { label: "0", value: "0" },
    {
      label: <Delete className="h-5 w-5" />,
      value: "back",
      onClick: backspace,
      aria: "Backspace",
    },
  ];

  return (
    <div className="space-y-2.5 sm:space-y-3">
      <div className="flex flex-wrap justify-center gap-1.5 sm:gap-2">
        {PRESET_AMOUNTS.map((preset) => (
          <button
            key={preset}
            type="button"
            className={cn(
              "touch-pad min-h-10 min-w-[3rem] rounded-full border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 shadow-sm transition-colors hover:bg-slate-50 active:bg-slate-100 sm:min-h-11 sm:min-w-[3.5rem] sm:px-4",
              // £100 only on tablet+ so the row doesn't wrap onto two lines
              // on a phone (and so the more useful £10/£20/£50 presets sit
              // on the same line under the keypad header).
              preset === 100 && "hidden sm:inline-flex",
            )}
            onClick={() => setAmount(String(preset))}
          >
            £{preset}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-1.5 sm:mx-auto sm:w-full sm:max-w-md sm:gap-2">
        {keys.map((k) => (
          <button
            key={k.value}
            type="button"
            aria-label={k.aria ?? `Digit ${k.value}`}
            onClick={k.onClick ?? (() => appendDigit(k.value))}
            className={cn(
              "touch-pad flex h-12 items-center justify-center rounded-xl border border-slate-200 bg-white text-2xl font-semibold text-slate-800 shadow-sm transition-transform active:scale-[0.97] active:bg-slate-100 sm:h-16 sm:text-3xl",
              k.value === "back" && "text-slate-500",
            )}
          >
            {k.label}
          </button>
        ))}
      </div>
    </div>
  );
}
