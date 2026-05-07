"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronUp, ChevronDown, Loader2, Save, X } from "lucide-react";

export type OrderableMember = {
  id: string;
  full_name: string;
  office_title: string | null;
  officer_sort_order: number | null;
  directory_sort_order: number | null;
};

type Mode = "officer" | "directory";

export function MemberOrderPanel({
  members,
  onClose,
}: {
  members: OrderableMember[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("officer");
  const [list, setList] = useState<OrderableMember[]>(() => sorted(members, "officer"));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function changeMode(next: Mode) {
    setMode(next);
    setList(sorted(members, next));
  }

  function move(id: string, delta: number) {
    setList((prev) => {
      const i = prev.findIndex((m) => m.id === id);
      const target = i + delta;
      if (i < 0 || target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[target]] = [next[target], next[i]];
      return next;
    });
  }

  async function save() {
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      await Promise.all(
        list.map((m, idx) => {
          const order = idx + 1;
          const update =
            mode === "officer"
              ? { officer_sort_order: order }
              : { directory_sort_order: order };
          return fetch(`/api/members/${m.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(update),
          });
        })
      );
      setSuccess(true);
      router.refresh();
      setTimeout(() => setSuccess(false), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save order");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-dash-text/30 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <Card
        variant="panel"
        className="relative flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden p-0"
      >
        <div className="flex items-center justify-between border-b border-dash-border bg-dash-surface-subtle px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-dash-text">
              Order {mode === "officer" ? "officers" : "directory"}
            </h2>
            <p className="text-xs text-dash-muted">
              Use the arrows to set the order shown on summons.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-dash-muted hover:bg-dash-surface-subtle"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex items-center gap-1 border-b border-dash-border bg-dash-surface px-6 py-3">
          <Button
            type="button"
            size="sm"
            variant={mode === "officer" ? "primary" : "ghost"}
            onClick={() => changeMode("officer")}
          >
            Officers
          </Button>
          <Button
            type="button"
            size="sm"
            variant={mode === "directory" ? "primary" : "ghost"}
            onClick={() => changeMode("directory")}
          >
            Directory
          </Button>
        </div>

        <CardContent className="flex-1 overflow-y-auto bg-dash-surface p-4">
          {list.length === 0 ? (
            <p className="px-2 py-6 text-center text-sm text-dash-muted">
              No members{mode === "officer" ? " with an office title" : ""} yet.
            </p>
          ) : (
            <ol className="space-y-1">
              {list
                .filter((m) =>
                  mode === "officer" ? Boolean(m.office_title) : true
                )
                .map((m, idx, visible) => (
                  <li
                    key={m.id}
                    className="flex items-center gap-3 rounded-lg border border-dash-border bg-dash-surface-subtle px-3 py-2"
                  >
                    <span className="w-6 text-center text-xs font-semibold text-dash-muted tabular-nums">
                      {idx + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-dash-text">
                        {m.full_name}
                      </p>
                      {m.office_title && (
                        <p className="text-xs text-dash-muted">
                          {m.office_title}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        disabled={idx === 0}
                        onClick={() => move(m.id, -1)}
                        aria-label="Move up"
                      >
                        <ChevronUp className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        disabled={idx === visible.length - 1}
                        onClick={() => move(m.id, 1)}
                        aria-label="Move down"
                      >
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                    </div>
                  </li>
                ))}
            </ol>
          )}
        </CardContent>

        <div className="flex items-center justify-between border-t border-dash-border bg-dash-surface px-6 py-4">
          {error ? (
            <p className="text-xs text-red-600">{error}</p>
          ) : success ? (
            <p className="text-xs text-emerald-700">Order saved.</p>
          ) : (
            <p className="text-xs text-dash-muted">
              Order is saved as numeric sort order on each member.
            </p>
          )}
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose} disabled={saving}>
              Close
            </Button>
            <Button variant="primary" onClick={save} disabled={saving}>
              {saving ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Save className="h-4 w-4" />
                  Save order
                </span>
              )}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

function sorted(members: OrderableMember[], mode: Mode): OrderableMember[] {
  const copy = [...members];
  if (mode === "officer") {
    return copy.sort(
      (a, b) =>
        (a.officer_sort_order ?? 9999) - (b.officer_sort_order ?? 9999) ||
        a.full_name.localeCompare(b.full_name)
    );
  }
  return copy.sort(
    (a, b) =>
      (a.directory_sort_order ?? 9999) - (b.directory_sort_order ?? 9999) ||
      a.full_name.localeCompare(b.full_name)
  );
}
