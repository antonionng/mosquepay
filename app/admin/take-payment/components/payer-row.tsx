"use client";

import { useState } from "react";
import { User, UserPlus, UserX, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { PersonPickerSheet } from "./person-picker-sheet";
import type { MemberOption, PayerSelection } from "./types";

// Two-button payer selector. Replaces the single "Attach member" affordance
// with two explicit choices so the treasurer never has to guess what the
// control does. Both buttons open the same unified picker drawer in their
// respective mode:
//
//   [ 👥 Guest    ] [ 👤 Member  ]
//
// Once a payer is picked the row collapses to a single chip showing the
// payer (member or guest) with a clear-to-revert button. The unified picker
// lets us share search behaviour, focus management, and the bottom-sheet
// scaffolding between modes without duplicating code per population.

export function PayerRow({
  members,
  payer,
  setPayer,
  hint,
}: {
  members: MemberOption[];
  payer: PayerSelection;
  setPayer: (p: PayerSelection) => void;
  hint?: string;
}) {
  const [openMode, setOpenMode] = useState<"member" | "guest" | null>(null);

  if (payer.kind === "member" || payer.kind === "guest") {
    const isMember = payer.kind === "member";
    const name = isMember ? payer.member.full_name : payer.guest.full_name;
    const sub = isMember
      ? payer.member.email
      : payer.guest.email ??
        payer.guest.mother_mosque_name ??
        (isMember ? null : "Guest");
    return (
      <div className="space-y-1.5">
        <div
          className={cn(
            "flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-sm",
            isMember
              ? "border-emerald-200 bg-emerald-50/60"
              : "border-sky-200 bg-sky-50/70",
          )}
        >
          <div className="flex min-w-0 items-center gap-2">
            <span
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                isMember ? "bg-emerald-100" : "bg-sky-100",
              )}
            >
              {isMember ? (
                <User className="h-4 w-4 text-emerald-700" />
              ) : (
                <UserPlus className="h-4 w-4 text-sky-700" />
              )}
            </span>
            <div className="min-w-0">
              <p
                className={cn(
                  "truncate font-medium",
                  isMember ? "text-emerald-900" : "text-sky-900",
                )}
              >
                {name}
              </p>
              {sub ? (
                <p
                  className={cn(
                    "truncate text-xs",
                    isMember ? "text-emerald-800/80" : "text-sky-800/80",
                  )}
                >
                  {sub}
                </p>
              ) : null}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setPayer({ kind: "anonymous" })}
            aria-label="Clear payer"
            className={cn(
              "touch-pad shrink-0 rounded-md p-1.5 hover:bg-white/50",
              isMember ? "text-emerald-800/80" : "text-sky-800/80",
            )}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {hint ? <p className="px-1 text-xs text-slate-500">{hint}</p> : null}
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <div
        role="radiogroup"
        aria-label="Payer"
        className="grid grid-cols-2 gap-2"
      >
        <button
          type="button"
          onClick={() => setOpenMode("guest")}
          aria-checked={false}
          role="radio"
          className="touch-pad flex min-h-14 items-center justify-center gap-2 rounded-xl border-2 border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm hover:border-slate-300 hover:bg-slate-50"
        >
          <UserX className="h-4 w-4" />
          <span>Guest</span>
        </button>
        <button
          type="button"
          onClick={() => setOpenMode("member")}
          aria-checked={false}
          role="radio"
          className="touch-pad flex min-h-14 items-center justify-center gap-2 rounded-xl border-2 border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm hover:border-slate-300 hover:bg-slate-50"
        >
          <User className="h-4 w-4" />
          <span>Member</span>
        </button>
      </div>
      {hint ? <p className="px-1 text-xs text-slate-500">{hint}</p> : null}
      <PersonPickerSheet
        open={openMode !== null}
        mode={openMode ?? "member"}
        members={members}
        onClose={() => setOpenMode(null)}
        onPick={(sel) => {
          setPayer(sel);
          setOpenMode(null);
        }}
      />
    </div>
  );
}
