"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Ban, CheckCircle2 } from "lucide-react";
import type { Mosque } from "@/lib/db/types";
import { Button } from "@/components/ui/button";
import { ConfirmActionDialog } from "@/components/ui/confirm-action-dialog";

export function MosqueDetailActions({ mosque }: { mosque: Mosque }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleToggle() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/mosques", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: mosque.name,
          slug: mosque.slug,
          is_active: !mosque.is_active,
        }),
      });
      if (!res.ok) {
        throw new Error("Could not update mosque status.");
      }
      router.refresh();
      setConfirm(false);
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : "Could not update mosque status.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="admin-surface p-6">
      <h2 className="text-lg font-semibold text-white border-b border-white/10 pb-4">
        Actions
      </h2>
      {error && (
        <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}
      <div className="mt-4 space-y-3">
        <Button
          type="button"
          variant="dashboard"
          onClick={() => setConfirm(true)}
          className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${
            mosque.is_active
              ? "border border-red-500/20 bg-red-500/5 text-red-400 hover:bg-red-500/10"
              : "border border-emerald-500/20 bg-emerald-500/5 text-emerald-400 hover:bg-emerald-500/10"
          }`}
        >
          {mosque.is_active ? (
            <>
              <Ban className="h-4 w-4" /> Deactivate Mosque
            </>
          ) : (
            <>
              <CheckCircle2 className="h-4 w-4" /> Activate Mosque
            </>
          )}
        </Button>
        <p className="text-xs leading-5 text-slate-400">
          Status changes are recorded in the audit trail for operator review.
        </p>
      </div>
      <ConfirmActionDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={`${mosque.is_active ? "Deactivate" : "Activate"} mosque?`}
        description={
          mosque.is_active
            ? "This will hide the mosque from public pages and tenant selectors. Existing admin records are preserved."
            : "This will make the mosque visible again for public pages and tenant selectors."
        }
        confirmLabel={mosque.is_active ? "Deactivate mosque" : "Activate mosque"}
        loading={loading}
        tone={mosque.is_active ? "danger" : "success"}
        onConfirm={handleToggle}
      />
    </div>
  );
}
