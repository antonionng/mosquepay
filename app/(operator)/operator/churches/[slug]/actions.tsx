"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Ban, CheckCircle2 } from "lucide-react";
import type { Church } from "@/lib/db/types";
import { Button } from "@/components/ui/button";
import { ConfirmActionDialog } from "@/components/ui/confirm-action-dialog";

export function ChurchDetailActions({ church }: { church: Church }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleToggle() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/churches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: church.name,
          slug: church.slug,
          is_active: !church.is_active,
        }),
      });
      if (!res.ok) {
        throw new Error("Could not update church status.");
      }
      router.refresh();
      setConfirm(false);
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : "Could not update church status.");
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
            church.is_active
              ? "border border-red-500/20 bg-red-500/5 text-red-400 hover:bg-red-500/10"
              : "border border-emerald-500/20 bg-emerald-500/5 text-emerald-400 hover:bg-emerald-500/10"
          }`}
        >
          {church.is_active ? (
            <>
              <Ban className="h-4 w-4" /> Deactivate Church
            </>
          ) : (
            <>
              <CheckCircle2 className="h-4 w-4" /> Activate Church
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
        title={`${church.is_active ? "Deactivate" : "Activate"} church?`}
        description={
          church.is_active
            ? "This will hide the church from public pages and tenant selectors. Existing admin records are preserved."
            : "This will make the church visible again for public pages and tenant selectors."
        }
        confirmLabel={church.is_active ? "Deactivate church" : "Activate church"}
        loading={loading}
        tone={church.is_active ? "danger" : "success"}
        onConfirm={handleToggle}
      />
    </div>
  );
}
