"use client";

// Per-meeting close panel.
//
// Lives in the right-hand column of the admin meeting detail page. Shows
// the projected Gift Aid reclaim and lets the treasurer hit one button to:
//   * roll up the meeting's payments into a meeting_collections row
//   * create a same-day gift_aid_claim_batch
//   * stamp the meeting as closed
//
// Once a meeting is closed the panel collapses to a summary line with
// links to the resulting collection and batch in the admin Gift Aid
// screen.

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertCircle,
  CheckCircle2,
  ClipboardCheck,
  HeartHandshake,
  Lock,
} from "lucide-react";

type Props = {
  eventId: string;
  isPast: boolean;
  closedAt: string | null;
  closedByEmail: string | null;
  charityAmount: number;
  charityCount: number;
  newDeclarationsPreview: number;
  closedBatchId: string | null;
  closedBatchDeclarationsCount: number;
  currency: string;
};

function formatGbp(majorUnits: number, currency: string) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: currency.toUpperCase() || "GBP",
  }).format(majorUnits);
}

export function MeetingClosePanel({
  eventId,
  isPast,
  closedAt,
  closedByEmail,
  charityAmount,
  charityCount,
  newDeclarationsPreview,
  closedBatchId,
  closedBatchDeclarationsCount,
  currency,
}: Props) {
  const router = useRouter();
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  if (closedAt) {
    return (
      <Card variant="panel" className="overflow-hidden p-0">
        <div className="dash-panel-header rounded-none border-dash-border bg-emerald-50">
          <h3 className="dash-panel-header-title flex items-center gap-2 text-emerald-900">
            <Lock className="h-4 w-4" />
            Meeting closed
          </h3>
        </div>
        <CardContent className="border-t border-dash-border bg-dash-surface p-5 text-sm">
          <p className="text-dash-text">
            Closed on{" "}
            {new Date(closedAt).toLocaleString("en-GB", {
              day: "numeric",
              month: "short",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
            {closedByEmail ? ` by ${closedByEmail}` : ""}.
          </p>
          {closedBatchDeclarationsCount > 0 ? (
            <p className="mt-2 text-xs text-emerald-700">
              Pack includes {closedBatchDeclarationsCount} declaration
              {closedBatchDeclarationsCount === 1 ? "" : "s"} for UGLE.
            </p>
          ) : null}
          {closedBatchId ? (
            <a
              href={`/api/admin/gift-aid/claims/${closedBatchId}/pack`}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-dash-border bg-dash-surface px-3 py-1.5 text-xs font-medium text-dash-text hover:bg-dash-surface-subtle"
            >
              Download Gift Aid pack (ZIP)
            </a>
          ) : null}
          <p className="mt-3 text-xs text-dash-muted">
            All claims and packs are listed in{" "}
            <Link href="/admin/gift-aid" className="underline">Gift Aid batches</Link>.
          </p>
        </CardContent>
      </Card>
    );
  }

  async function submit() {
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(
        `/api/admin/meetings/${encodeURIComponent(eventId)}/close`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            notes: notes.trim() || null,
          }),
        },
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error ?? "Could not close meeting.");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
      setConfirming(false);
    }
  }

  return (
    <Card variant="panel" className="overflow-hidden p-0">
      <div className="dash-panel-header rounded-none border-dash-border bg-dash-surface-subtle">
        <h3 className="dash-panel-header-title flex items-center gap-2">
          <ClipboardCheck className="h-4 w-4" />
          Close meeting &amp; send Gift Aid
        </h3>
      </div>
      <CardContent className="border-t border-dash-border bg-dash-surface p-5 text-sm">
        {!isPast ? (
          <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              This meeting is in the future. You can still close it but the
              Gift Aid batch will only include donations recorded so far.
            </span>
          </div>
        ) : null}

        <dl className="mt-3 space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <dt className="text-dash-muted">Charity income on file</dt>
            <dd className="font-semibold tabular-nums text-dash-text">
              {formatGbp(charityAmount, currency)}
            </dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-dash-muted">Donor-linked donations</dt>
            <dd className="tabular-nums text-dash-text">{charityCount}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-dash-muted">New declarations to ship</dt>
            <dd className="tabular-nums text-dash-text">
              {newDeclarationsPreview}
            </dd>
          </div>
        </dl>

        <p className="mt-3 text-xs text-dash-muted">
          Closing will record a meeting collection and create a Gift Aid
          claim batch for this date with every eligible donation plus
          copies of any declarations signed since the last close, ready
          to forward to the Relief Chest at UGLE.
        </p>

        {error ? (
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}

        {confirming ? (
          <div className="mt-4 space-y-3">
            <label htmlFor="meeting-close-notes" className="block text-xs font-medium text-dash-text">
              Notes for the audit trail (optional)
            </label>
            <Textarea
              id="meeting-close-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="e.g. Coins counted by JW and Almoner."
            />
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                variant="outline"
                onClick={() => setConfirming(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button onClick={submit} disabled={submitting} variant="primary">
                {submitting ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Closing...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" />
                    Confirm close
                  </span>
                )}
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button variant="primary" onClick={() => setConfirming(true)}>
              <HeartHandshake className="mr-2 h-4 w-4" />
              Close meeting
            </Button>
            <Badge variant="outline" className="text-xs">
              Creates Gift Aid batch
            </Badge>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
