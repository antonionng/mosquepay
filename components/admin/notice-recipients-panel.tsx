"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, RotateCcw, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type OverrideSource = "none" | "event" | "profile" | "event_wide";

type RecipientRow = {
  id: string;
  type: "member" | "honorary_guest";
  name: string;
  email: string | null;
  levy: number;
  dining: number;
  levy_waived: boolean;
  dining_waived: boolean;
  levy_source: OverrideSource;
  dining_source: OverrideSource;
  override_note: string | null;
};

type EventInfo = {
  id: string;
  dining_waived_for_all: boolean;
  enable_dining_rsvp: boolean;
  enable_service_fee: boolean;
};

type Preview = {
  members: RecipientRow[];
  honoraryGuests: RecipientRow[];
  totals: { levy: number; dining: number; count: number };
  include_members: boolean;
  include_honorary_guests: boolean;
  event: EventInfo;
};

type Props = {
  eventId: string;
};

function money(amount: number, waived: boolean) {
  if (waived && amount === 0) return "Complimentary";
  return `£${amount.toFixed(2)}`;
}

function sourceBadge(source: OverrideSource) {
  if (source === "event")
    return (
      <span className="ml-1 rounded bg-amber-100 px-1 text-[10px] font-medium uppercase tracking-wide text-amber-800">
        Event
      </span>
    );
  if (source === "event_wide")
    return (
      <span className="ml-1 rounded bg-blue-100 px-1 text-[10px] font-medium uppercase tracking-wide text-blue-800">
        All
      </span>
    );
  if (source === "profile")
    return (
      <span className="ml-1 rounded bg-slate-100 px-1 text-[10px] font-medium uppercase tracking-wide text-slate-600">
        Profile
      </span>
    );
  return null;
}

export function NoticeRecipientsPanel({ eventId }: Props) {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingFlag, setSavingFlag] = useState<null | "honorary" | "dining-wide">(
    null
  );
  const [search, setSearch] = useState("");
  const [includeMembers, setIncludeMembers] = useState(true);
  const [includeHonoraryGuests, setIncludeHonoraryGuests] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<RecipientRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (!includeMembers) params.set("include_members", "false");
      if (!includeHonoraryGuests) params.set("include_honorary_guests", "false");
      const res = await fetch(
        `/api/notice/${eventId}/recipients-preview?${params.toString()}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not load recipients");
      setPreview(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load recipients");
    } finally {
      setLoading(false);
    }
  }, [eventId, includeMembers, includeHonoraryGuests]);

  useEffect(() => {
    void load();
  }, [load]);

  async function persistHonoraryToggle(checked: boolean) {
    setIncludeHonoraryGuests(checked);
    setSavingFlag("honorary");
    try {
      await fetch(`/api/notice/${eventId}/recipients-preview`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ include_honorary_guests: checked }),
      });
    } catch {
      /* the next load will reflect server state */
    } finally {
      setSavingFlag(null);
    }
  }

  async function persistDiningWaiveAll(checked: boolean) {
    setSavingFlag("dining-wide");
    try {
      const res = await fetch(`/api/notice/${eventId}/recipients-preview`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dining_waived_for_all: checked }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Could not update event-wide dining waiver.");
      }
      await load();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not update dining waiver."
      );
    } finally {
      setSavingFlag(null);
    }
  }

  const rows = useMemo(() => {
    const all = [
      ...(preview?.members ?? []),
      ...(preview?.honoraryGuests ?? []),
    ];
    if (!search.trim()) return all;
    const q = search.toLowerCase();
    return all.filter(
      (row) =>
        row.name.toLowerCase().includes(q) ||
        (row.email ?? "").toLowerCase().includes(q)
    );
  }, [preview, search]);

  const warnings = useMemo(() => {
    if (!preview) return [] as string[];
    const list: string[] = [];
    const honoraryNoEmail = preview.honoraryGuests.filter(
      (g) => !g.email || !g.email.trim()
    );
    if (honoraryNoEmail.length > 0) {
      list.push(
        `${honoraryNoEmail.length} honorary guest${honoraryNoEmail.length === 1 ? "" : "s"} have no email and will be skipped on send.`
      );
    }
    const allComplimentary =
      preview.totals.count > 0 &&
      preview.totals.levy === 0 &&
      preview.totals.dining === 0;
    if (allComplimentary) {
      list.push(
        "Every line resolves to complimentary. Double check this is intentional before sending."
      );
    }
    return list;
  }, [preview]);

  const event = preview?.event;
  const eventWideWaived = event?.dining_waived_for_all === true;

  return (
    <section className="space-y-4 rounded-xl border border-dash-border bg-dash-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.14em] text-dash-muted">
            <Users className="h-4 w-4" />
            Recipients preview
          </h3>
          <p className="mt-1 text-sm text-dash-muted">
            Everyone who will be invited when the notice is sent, with the
            resolved levy and dining fees. Click a row to override the fee for
            this one service.
          </p>
        </div>
        {preview && (
          <p className="text-sm font-medium text-dash-text">
            {preview.totals.count} recipient
            {preview.totals.count === 1 ? "" : "s"}
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={includeMembers}
            onChange={(e) => setIncludeMembers(e.target.checked)}
          />
          Include all active members
          {preview ? ` (${preview.members.length})` : ""}
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={includeHonoraryGuests}
            disabled={savingFlag === "honorary"}
            onChange={(e) => void persistHonoraryToggle(e.target.checked)}
          />
          Invite all honorary guests
          {preview ? ` (${preview.honoraryGuests.length})` : ""}
        </label>
      </div>

      {event?.enable_dining_rsvp && (
        <label className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50/60 p-3 text-sm text-amber-900">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={eventWideWaived}
            disabled={savingFlag === "dining-wide"}
            onChange={(e) => void persistDiningWaiveAll(e.target.checked)}
          />
          <div>
            <p className="font-semibold">
              Waive dining for everyone at this service
            </p>
            <p className="text-xs text-amber-800">
              Useful when the church is covering dining (e.g. special_service). This
              overrides each member and guest&apos;s individual price. Per-row
              overrides below are ignored while this is on.
            </p>
          </div>
          {savingFlag === "dining-wide" && (
            <Loader2 className="ml-auto h-4 w-4 animate-spin" />
          )}
        </label>
      )}

      <div className="space-y-2">
        <Label htmlFor="recipient-search">Search</Label>
        <Input
          id="recipient-search"
          placeholder="Name or email"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {loading ? (
        <div className="flex items-center gap-2 py-8 text-sm text-dash-muted">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading recipients…
        </div>
      ) : (
        <>
          <div className="max-h-72 overflow-y-auto rounded-lg border border-dash-border">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-dash-surface-subtle text-xs uppercase text-dash-muted">
                <tr>
                  <th className="px-3 py-2 font-medium">Name</th>
                  <th className="px-3 py-2 font-medium">Type</th>
                  <th className="px-3 py-2 font-medium text-right">Levy</th>
                  <th className="px-3 py-2 font-medium text-right">Dining</th>
                  <th className="px-3 py-2 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-3 py-6 text-center text-dash-muted"
                    >
                      No recipients match.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr
                      key={`${row.type}:${row.id}`}
                      className="border-t border-dash-border align-top"
                    >
                      <td className="px-3 py-2">
                        <div className="font-medium text-dash-text">
                          {row.name}
                        </div>
                        {row.email && (
                          <div className="text-xs text-dash-muted">
                            {row.email}
                          </div>
                        )}
                        {row.override_note && (
                          <div className="mt-1 text-xs italic text-amber-700">
                            “{row.override_note}”
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-dash-muted">
                        {row.type === "honorary_guest"
                          ? "Honorary guest"
                          : "Member"}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        <span
                          className={cn(
                            row.levy_waived && "text-emerald-700"
                          )}
                        >
                          {row.type === "honorary_guest"
                            ? "—"
                            : money(row.levy, row.levy_waived)}
                        </span>
                        {row.type !== "honorary_guest" &&
                          sourceBadge(row.levy_source)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        <span
                          className={cn(
                            row.dining_waived && "text-emerald-700"
                          )}
                        >
                          {money(row.dining, row.dining_waived)}
                        </span>
                        {sourceBadge(row.dining_source)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={eventWideWaived && row.dining_source !== "event"}
                          onClick={() => setEditing(row)}
                        >
                          Override
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {preview && preview.totals.count > 0 && (
            <p className="text-xs text-dash-muted">
              If everyone attends and dines: estimated levies £
              {preview.totals.levy.toFixed(2)}, dining £
              {preview.totals.dining.toFixed(2)}.
            </p>
          )}

          {warnings.length > 0 && (
            <ul className="space-y-1 rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2 text-xs text-amber-900">
              {warnings.map((w) => (
                <li key={w}>• {w}</li>
              ))}
            </ul>
          )}
        </>
      )}

      {editing && (
        <OverrideDialog
          eventId={eventId}
          row={editing}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await load();
          }}
        />
      )}
    </section>
  );
}

function OverrideDialog({
  eventId,
  row,
  onClose,
  onSaved,
}: {
  eventId: string;
  row: RecipientRow;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const [diningMode, setDiningMode] = useState<"default" | "waive" | "custom">(
    row.dining_source === "event" && row.dining_waived
      ? "waive"
      : row.dining_source === "event"
        ? "custom"
        : "default"
  );
  const [diningAmount, setDiningAmount] = useState<string>(
    row.dining_source === "event" && !row.dining_waived ? row.dining.toFixed(2) : ""
  );
  const [levyMode, setLevyMode] = useState<"default" | "waive" | "custom">(
    row.levy_source === "event" && row.levy_waived
      ? "waive"
      : row.levy_source === "event"
        ? "custom"
        : "default"
  );
  const [levyAmount, setLevyAmount] = useState<string>(
    row.levy_source === "event" && !row.levy_waived ? row.levy.toFixed(2) : ""
  );
  const [note, setNote] = useState(row.override_note ?? "");
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const isMember = row.type === "member";

  async function save() {
    setSaving(true);
    setSubmitError(null);
    try {
      const subjectType = isMember ? "member" : "guest";
      const body = {
        subject_type: subjectType,
        subject_id: row.id,
        note: note.trim() || null,
        dining_waived: diningMode === "waive",
        dining_amount:
          diningMode === "custom" ? Number(diningAmount || 0) : null,
        levy_waived: isMember && levyMode === "waive",
        levy_amount:
          isMember && levyMode === "custom" ? Number(levyAmount || 0) : null,
      };
      const allDefault =
        diningMode === "default" && (!isMember || levyMode === "default");
      if (allDefault) {
        const res = await fetch(
          `/api/notice/${eventId}/overrides?subject_type=${subjectType}&subject_id=${row.id}`,
          { method: "DELETE" }
        );
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? "Could not clear override.");
        }
      } else {
        const res = await fetch(`/api/notice/${eventId}/overrides`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? "Could not save override.");
        }
      }
      await onSaved();
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Could not save override."
      );
    } finally {
      setSaving(false);
    }
  }

  async function clearOverride() {
    setSaving(true);
    setSubmitError(null);
    try {
      const subjectType = isMember ? "member" : "guest";
      const res = await fetch(
        `/api/notice/${eventId}/overrides?subject_type=${subjectType}&subject_id=${row.id}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Could not clear override.");
      }
      await onSaved();
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Could not clear override."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (saving) return;
        if (!open) onClose();
      }}
    >
      <DialogContent
        showClose={!saving}
        className="max-w-lg border-dash-border bg-dash-surface p-0 text-dash-text"
      >
        <DialogHeader className="space-y-2 border-b border-dash-border px-6 py-5">
          <DialogTitle>Fee override · {row.name}</DialogTitle>
          <DialogDescription>
            This adjustment applies only to this service. The recipient&apos;s
            profile defaults are untouched and will apply again at future
            services.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 px-6 py-5">
          {isMember && (
            <fieldset className="space-y-3">
              <legend className="text-sm font-semibold text-dash-text">
                Service levy
              </legend>
              <div className="space-y-1 text-sm">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={levyMode === "default"}
                    onChange={() => setLevyMode("default")}
                  />
                  Use default ({money(row.levy, row.levy_waived)})
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={levyMode === "waive"}
                    onChange={() => setLevyMode("waive")}
                  />
                  Waive (complimentary)
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={levyMode === "custom"}
                    onChange={() => setLevyMode("custom")}
                  />
                  Custom amount (£)
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={levyAmount}
                    disabled={levyMode !== "custom"}
                    onChange={(e) => setLevyAmount(e.target.value)}
                    className="ml-2 h-8 w-28"
                  />
                </label>
              </div>
            </fieldset>
          )}

          <fieldset className="space-y-3">
            <legend className="text-sm font-semibold text-dash-text">
              Dining
            </legend>
            <div className="space-y-1 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={diningMode === "default"}
                  onChange={() => setDiningMode("default")}
                />
                Use default ({money(row.dining, row.dining_waived)})
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={diningMode === "waive"}
                  onChange={() => setDiningMode("waive")}
                />
                Waive (complimentary)
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={diningMode === "custom"}
                  onChange={() => setDiningMode("custom")}
                />
                Custom amount (£)
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={diningAmount}
                  disabled={diningMode !== "custom"}
                  onChange={(e) => setDiningAmount(e.target.value)}
                  className="ml-2 h-8 w-28"
                />
              </label>
            </div>
          </fieldset>

          <div className="space-y-1">
            <Label htmlFor="override-note">Note (optional)</Label>
            <Textarea
              id="override-note"
              rows={2}
              placeholder="e.g. Secretary's guest, church covering dining."
              value={note}
              maxLength={500}
              onChange={(e) => setNote(e.target.value)}
            />
            <p className="text-xs text-dash-muted">{note.length}/500</p>
          </div>

          {submitError && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {submitError}
            </p>
          )}
        </div>

        <DialogFooter className="gap-2 border-t border-dash-border px-6 py-4 sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={saving}
            onClick={() => void clearOverride()}
          >
            <RotateCcw className="mr-1 h-3.5 w-3.5" />
            Reset to defaults
          </Button>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              disabled={saving}
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={saving}
              onClick={() => void save()}
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save override
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
