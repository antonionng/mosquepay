"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Award, CheckCircle2, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { churchTitleFor } from "@/lib/members/rank";

export type OfficeRung = {
  id: string;
  rung_label: string;
  sort_order: number;
  current_member_id: string | null;
};

export type OfficeMember = {
  id: string;
  full_name: string;
  rank: string | null;
};

export function OfficesPanel({
  offices,
  members,
}: {
  offices: OfficeRung[];
  members: OfficeMember[];
}) {
  const router = useRouter();
  const [savingId, setSavingId] = useState<string | null>(null);
  const [justSavedId, setJustSavedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sortedOffices = useMemo(
    () =>
      [...offices].sort(
        (a, b) =>
          a.sort_order - b.sort_order || a.rung_label.localeCompare(b.rung_label)
      ),
    [offices]
  );

  const sortedMembers = useMemo(
    () => [...members].sort((a, b) => a.full_name.localeCompare(b.full_name)),
    [members]
  );

  // For each member, list the other offices they currently hold so we can
  // surface that next to their name in the dropdown.
  const otherOfficesByMember = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const o of sortedOffices) {
      if (!o.current_member_id) continue;
      const list = map.get(o.current_member_id) ?? [];
      list.push(o.rung_label);
      map.set(o.current_member_id, list);
    }
    return map;
  }, [sortedOffices]);

  async function assign(rungId: string, memberId: string) {
    setSavingId(rungId);
    setError(null);
    try {
      const res = await fetch(`/api/members/${rungId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current_member_id: memberId || null }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Could not save.");
      }
      setJustSavedId(rungId);
      setTimeout(() => setJustSavedId((prev) => (prev === rungId ? null : prev)), 1500);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setSavingId(null);
    }
  }

  const filledCount = sortedOffices.filter((o) => o.current_member_id).length;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-dash-text">
            Church officers
          </h2>
          <p className="mt-1 text-sm text-dash-muted">
            Pick a member for each office. To replace someone (e.g. install a
            new Lead Pastor) just choose a different name. Changes save
            automatically and appear on every notice.
          </p>
        </div>
        <div className="rounded-full border border-dash-border bg-dash-surface-subtle px-3 py-1 text-xs font-medium text-dash-muted">
          {filledCount} of {sortedOffices.length} filled
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800"
        >
          {error}
        </div>
      )}

      <Card variant="panel" className="overflow-hidden p-0">
        <ul className="divide-y divide-dash-border">
          {sortedOffices.length === 0 && (
            <li className="px-5 py-10 text-center text-sm text-dash-muted">
              <Award className="mx-auto mb-2 h-6 w-6 text-dash-faint" />
              No offices configured yet.
            </li>
          )}
          {sortedOffices.map((office) => {
            const isSaving = savingId === office.id;
            const justSaved = justSavedId === office.id;
            const holder = office.current_member_id
              ? members.find((m) => m.id === office.current_member_id) ?? null
              : null;
            return (
              <li
                key={office.id}
                className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:gap-6"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold uppercase tracking-wide text-dash-text">
                    {office.rung_label}
                  </p>
                  {holder ? (
                    <p className="mt-0.5 text-xs text-dash-muted">
                      Currently held by{" "}
                      <Link
                        href={`/admin/members/${holder.id}`}
                        className="font-medium text-blue-700 hover:underline"
                      >
                        {churchTitleFor(holder.rank)
                          ? `${churchTitleFor(holder.rank)} `
                          : ""}
                        {holder.full_name}
                      </Link>
                    </p>
                  ) : (
                    <p className="mt-0.5 text-xs text-dash-muted">Vacant</p>
                  )}
                </div>
                <div className="flex items-center gap-2 sm:w-[280px]">
                  <select
                    aria-label={`Holder of ${office.rung_label}`}
                    value={office.current_member_id ?? ""}
                    disabled={isSaving}
                    onChange={(e) => assign(office.id, e.target.value)}
                    className={cn(
                      "h-11 w-full rounded-xl border border-dash-border bg-dash-surface px-3 text-sm",
                      "focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100",
                      isSaving && "opacity-60"
                    )}
                  >
                    <option value="">— Vacant —</option>
                    {sortedMembers.map((m) => {
                      const otherOffices = (otherOfficesByMember.get(m.id) ?? [])
                        .filter((label) => label !== office.rung_label);
                      const suffix =
                        otherOffices.length > 0
                          ? ` (also ${otherOffices.join(", ")})`
                          : "";
                      return (
                        <option key={m.id} value={m.id}>
                          {churchTitleFor(m.rank)
                            ? `${churchTitleFor(m.rank)} `
                            : ""}
                          {m.full_name}
                          {suffix}
                        </option>
                      );
                    })}
                  </select>
                  <div className="w-5 shrink-0 text-blue-600">
                    {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                    {!isSaving && justSaved && (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </Card>

      <p className="text-xs text-dash-muted">
        Tip: you can also assign an office from a member&apos;s profile page.
      </p>
    </div>
  );
}
