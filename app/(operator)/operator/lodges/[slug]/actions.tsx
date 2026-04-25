"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Ban, Loader2, CheckCircle2 } from "lucide-react";
import type { Lodge } from "@/lib/db/types";

export function LodgeDetailActions({ lodge }: { lodge: Lodge }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [confirm, setConfirm] = useState(false);

  async function handleToggle() {
    setLoading(true);
    try {
      await fetch("/api/lodges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: lodge.name,
          slug: lodge.slug,
          is_active: !lodge.is_active,
        }),
      });
      router.refresh();
    } catch {
      /* fail silently */
    } finally {
      setLoading(false);
      setConfirm(false);
    }
  }

  if (confirm) {
    return (
      <div className="admin-surface p-6">
        <h2 className="text-lg font-semibold text-white border-b border-white/10 pb-4">
          {lodge.is_active ? "Deactivate" : "Activate"} Lodge
        </h2>
        <p className="mt-4 text-sm text-slate-300">
          {lodge.is_active
            ? "This will hide the lodge from public pages. You can reactivate it later."
            : "This will make the lodge visible on public pages."}
        </p>
        <div className="mt-4 flex gap-2">
          <button
            onClick={handleToggle}
            disabled={loading}
            className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-white transition-colors ${
              lodge.is_active
                ? "bg-red-600 hover:bg-red-500"
                : "bg-emerald-600 hover:bg-emerald-500"
            } disabled:opacity-50`}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : lodge.is_active ? (
              <Ban className="h-4 w-4" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            Confirm
          </button>
          <button
            onClick={() => setConfirm(false)}
            className="rounded-xl border border-white/10 px-4 py-2.5 text-sm text-slate-400 transition-colors hover:bg-white/5"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-surface p-6">
      <h2 className="text-lg font-semibold text-white border-b border-white/10 pb-4">
        Actions
      </h2>
      <div className="mt-4">
        <button
          onClick={() => setConfirm(true)}
          className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${
            lodge.is_active
              ? "border border-red-500/20 bg-red-500/5 text-red-400 hover:bg-red-500/10"
              : "border border-emerald-500/20 bg-emerald-500/5 text-emerald-400 hover:bg-emerald-500/10"
          }`}
        >
          {lodge.is_active ? (
            <>
              <Ban className="h-4 w-4" /> Deactivate Lodge
            </>
          ) : (
            <>
              <CheckCircle2 className="h-4 w-4" /> Activate Lodge
            </>
          )}
        </button>
      </div>
    </div>
  );
}
