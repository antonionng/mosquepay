"use client";

// Per-service close panel.
//
// Lives in the right-hand column of the admin service detail page. Shows
// the projected Gift Aid reclaim and lets the treasurer hit one button to:
//   * roll up the service's payments into a service_collections row
//   * create a same-day gift_aid_claim_batch
//   * stamp the service as closed
//
// Once a service is closed the panel collapses to a summary line with
// links to the resulting collection and batch in the admin Gift Aid
// screen.

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { GiftAidHelpDrawer } from "@/components/admin/gift-aid-help-drawer";
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
  giftAidEligibleAmount: number;
  giftAidEligibleCount: number;
  newDeclarationsPreview: number;
  closedBatchId: string | null;
  closedBatchDeclarationsCount: number;
  reliefChestDeliveredAt?: string | null;
  currency: string;
};

function formatGbp(majorUnits: number, currency: string) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: currency.toUpperCase() || "GBP",
  }).format(majorUnits);
}

export function ServiceClosePanel({
  eventId,
  isPast,
  closedAt,
  closedByEmail,
  charityAmount,
  charityCount,
  giftAidEligibleAmount,
  giftAidEligibleCount,
  newDeclarationsPreview,
  closedBatchId,
  closedBatchDeclarationsCount,
  reliefChestDeliveredAt,
  currency,
}: Props) {
  const router = useRouter();
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [batchSkippedReason, setBatchSkippedReason] = useState<string | null>(
    null,
  );
  const [confirming, setConfirming] = useState(false);
  const [markingDelivered, setMarkingDelivered] = useState(false);

  async function markDelivered() {
    setMarkingDelivered(true);
    try {
      const res = await fetch(
        `/api/admin/services/${encodeURIComponent(eventId)}/relief-chest`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ delivered: true }),
        },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Could not update delivery.");
      }
      router.refresh();
    } catch {
      /* surfaced via no-op; treasurer can retry */
    } finally {
      setMarkingDelivered(false);
    }
  }

  if (closedAt) {
    return (
      <Card variant="panel" className="overflow-hidden p-0">
        <div className="dash-panel-header rounded-none border-dash-border bg-emerald-50">
          <h3 className="dash-panel-header-title flex items-center gap-2 text-emerald-900">
            <Lock className="h-4 w-4" />
            Service closed
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
          {!closedBatchId ? (
            <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                {batchSkippedReason ??
                  "No Gift Aid claim batch is linked to this closed service."}
              </span>
            </div>
          ) : null}
          {closedBatchId ? (
            <div className="mt-3 rounded-lg border border-dash-border bg-dash-surface-subtle/40 p-3">
              {reliefChestDeliveredAt ? (
                <p className="flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Delivered to Gift Aid pack on{" "}
                  {new Date(reliefChestDeliveredAt).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </p>
              ) : (
                <>
                  <p className="text-xs text-dash-muted">
                    Once you&rsquo;ve emailed the pack to the Gift Aid pack, mark
                    it delivered to keep the audit trail complete.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={markDelivered}
                    disabled={markingDelivered}
                  >
                    {markingDelivered
                      ? "Saving…"
                      : "Mark delivered to Gift Aid pack"}
                  </Button>
                </>
              )}
            </div>
          ) : null}
          <p className="mt-3 text-xs text-dash-muted">
            All claims and packs are listed in{" "}
            <Link href="/admin/gift-aid" className="underline">Gift Aid batches</Link>.
          </p>
          <div className="mt-3">
            <GiftAidHelpDrawer variant="link" label="What's in the pack?" />
          </div>
        </CardContent>
      </Card>
    );
  }

  async function submit() {
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(
        `/api/admin/services/${encodeURIComponent(eventId)}/close`,
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
        throw new Error(body.error ?? "Could not close service.");
      }
      setBatchSkippedReason(
        typeof body.batch_skipped_reason === "string"
          ? body.batch_skipped_reason
          : null,
      );
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
          Close service &amp; send Gift Aid
        </h3>
      </div>
      <CardContent className="border-t border-dash-border bg-dash-surface p-5 text-sm">
        {!isPast ? (
          <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              This service is in the future. You can still close it but the
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
            <dt className="text-dash-muted">Gift Aid eligible</dt>
            <dd className="font-semibold tabular-nums text-dash-text">
              {formatGbp(giftAidEligibleAmount, currency)} from{" "}
              {giftAidEligibleCount}
            </dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-dash-muted">New declarations to ship</dt>
            <dd className="tabular-nums text-dash-text">
              {newDeclarationsPreview}
            </dd>
          </div>
        </dl>

        {charityCount > 0 && giftAidEligibleCount === 0 ? (
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Donor-linked charity income exists, but no confirmed Gift Aid
              declaration currently matches these donations. Closing may record
              the collection without creating a claim batch unless new
              declarations are also waiting to ship.
            </span>
          </div>
        ) : null}

        <p className="mt-3 text-xs text-dash-muted">
          Closing will record a service collection and create a Gift Aid
          claim batch for this date with every eligible donation plus
          copies of any declarations signed since the last close, ready
          to forward to the Gift Aid pack at UGLE.
        </p>
        <div className="mt-2">
          <GiftAidHelpDrawer variant="link" label="How does this work?" />
        </div>

        {error ? (
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}

        {confirming ? (
          <div className="mt-4 space-y-3">
            <label htmlFor="service-close-notes" className="block text-xs font-medium text-dash-text">
              Notes for the audit trail (optional)
            </label>
            <Textarea
              id="service-close-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="e.g. Coins counted by JW and PastoralCare."
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
              Close service
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
