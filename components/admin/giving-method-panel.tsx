"use client";

// components/admin/giving-method-panel.tsx
//
// Admin-side panel on /admin/members/[id] that surfaces *how* the
// member is paying this year's giving and lets the treasurer / secretary
// change it. The panel always renders next to the (existing)
// MemberSubscriptionPanel: the subscription panel shows the live
// state of any Mooov subscription, this panel shows the
// admin-declared payment method (online / BACS / paid in full /
// waived) PLUS a copyable subscription link for nudging members
// onto the online flow.
//
// The two are intentionally separate: a member can be tagged 'bacs'
// while never having an active subscription, or 'paid_in_full'
// because they paid by cheque on the night, or 'fee_waived' for
// good-cause reasons. The single-source-of-truth column we read is
// member_giving.giving_payment_method (added in migration 063).

import { useState } from "react";
import {
  Repeat,
  Banknote,
  CheckCircle2,
  ShieldCheck,
  XCircle,
  Mail,
  Copy,
  Check,
  Wallet,
  AlertCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { GivingPaymentMethod } from "@/lib/db/types";

export interface GivingMethodPanelProps {
  memberId: string;
  memberEmail: string;
  memberName: string;
  initial: {
    givingId: string | null;
    method: GivingPaymentMethod | null;
    bacsMonthlyAmount: number | null;
    bacsReference: string | null;
    waiverReason: string | null;
    paidAt: string | null;
    setBy: string | null;
    setAt: string | null;
    annualAmount: number | null;
    yearLabel: string | null;
    subscriptionLink: string | null;
    hasActiveSubscription: boolean;
  };
}

type ActionDialog =
  | { kind: "none" }
  | { kind: "send_link" }
  | { kind: "bacs" }
  | { kind: "paid_in_full" }
  | { kind: "fee_waived" }
  | { kind: "reset" };

function methodLabel(method: GivingPaymentMethod | null): string {
  switch (method) {
    case "online_subscription":
      return "Online subscription";
    case "bacs":
      return "BACS";
    case "paid_in_full":
      return "Paid in full";
    case "fee_waived":
      return "Fee waived";
    default:
      return "Not set";
  }
}

function methodDescription(method: GivingPaymentMethod | null): string {
  switch (method) {
    case "online_subscription":
      return "Paying via card subscription through pay.mooov.money. Charges run automatically each cycle.";
    case "bacs":
      return "Pays by external bank transfer. Reconcile manually from the bank statement against the giving period.";
    case "paid_in_full":
      return "Paid in full offline (cash, cheque, transfer). Status recorded as paid for the year.";
    case "fee_waived":
      return "Mosque has waived giving for this year for this member.";
    default:
      return "No payment method tagged yet. Tag this member so the treasurer dashboard counts them in the right bucket.";
  }
}

function methodBadgeVariant(
  method: GivingPaymentMethod | null,
): "success" | "secondary" | "warning" | "default" | "muted" {
  switch (method) {
    case "online_subscription":
      return "secondary";
    case "paid_in_full":
      return "success";
    case "fee_waived":
      return "muted";
    case "bacs":
      return "warning";
    default:
      return "default";
  }
}

function formatGbp(amount: number | null): string {
  if (amount == null) return "—";
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(amount);
}

function formatDateTime(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function GivingMethodPanel({
  memberId,
  memberEmail,
  memberName,
  initial,
}: GivingMethodPanelProps) {
  const [state, setState] = useState({
    method: initial.method,
    bacsMonthlyAmount: initial.bacsMonthlyAmount,
    bacsReference: initial.bacsReference,
    waiverReason: initial.waiverReason,
    paidAt: initial.paidAt,
    setBy: initial.setBy,
    setAt: initial.setAt,
    subscriptionLink: initial.subscriptionLink,
  });
  const [dialog, setDialog] = useState<ActionDialog>({ kind: "none" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  // Form state for the BACS / waiver dialogs. Reset whenever a new
  // dialog opens so stale input from a prior cancel doesn't leak.
  const [bacsAmount, setBacsAmount] = useState<string>(
    state.bacsMonthlyAmount != null ? String(state.bacsMonthlyAmount) : "",
  );
  const [bacsRef, setBacsRef] = useState<string>(state.bacsReference ?? "");
  const [waiverReason, setWaiverReason] = useState<string>(
    state.waiverReason ?? "",
  );
  const [paidNote, setPaidNote] = useState<string>("");

  const hasGivingRow = initial.givingId != null;

  function openDialog(next: ActionDialog) {
    setError(null);
    if (next.kind === "bacs") {
      setBacsAmount(
        state.bacsMonthlyAmount != null ? String(state.bacsMonthlyAmount) : "",
      );
      setBacsRef(state.bacsReference ?? "");
    } else if (next.kind === "fee_waived") {
      setWaiverReason(state.waiverReason ?? "");
    } else if (next.kind === "paid_in_full") {
      setPaidNote("");
    }
    setDialog(next);
  }

  async function callApi(payload: Record<string, unknown>) {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/members/${memberId}/giving-method`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        giving?: {
          giving_payment_method: GivingPaymentMethod | null;
          bacs_monthly_amount: number | null;
          bacs_reference: string | null;
          waiver_reason: string | null;
          paid_at: string | null;
          payment_method_set_by: string | null;
          payment_method_set_at: string | null;
        };
        subscription_link?: string;
      };
      if (!res.ok || !data.giving) {
        throw new Error(data.error ?? "Could not update payment method.");
      }
      setState({
        method: data.giving.giving_payment_method,
        bacsMonthlyAmount: data.giving.bacs_monthly_amount,
        bacsReference: data.giving.bacs_reference,
        waiverReason: data.giving.waiver_reason,
        paidAt: data.giving.paid_at,
        setBy: data.giving.payment_method_set_by,
        setAt: data.giving.payment_method_set_at,
        subscriptionLink: data.subscription_link ?? state.subscriptionLink,
      });
      setDialog({ kind: "none" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update payment method.");
    } finally {
      setSubmitting(false);
    }
  }

  async function copyLink() {
    if (!state.subscriptionLink) return;
    try {
      await navigator.clipboard.writeText(state.subscriptionLink);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      // Older browsers — fall through silently. The input is selectable.
    }
  }

  const mailtoHref = state.subscriptionLink
    ? `mailto:${memberEmail}?subject=${encodeURIComponent(
        `Mosque giving – set up your payment plan`,
      )}&body=${encodeURIComponent(
        `Hi ${memberName.split(" ")[0] ?? memberName},\n\n` +
          `You can set up your mosque giving here:\n\n${state.subscriptionLink}\n\n` +
          `Pay in full or split it into monthly / quarterly instalments — whatever works for you.\n\n` +
          `With every blessing,\nThe Mosque`,
      )}`
    : "#";

  const isPaidViaPanel = state.method === "paid_in_full";
  const isWaivedViaPanel = state.method === "fee_waived";

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100">
              <Wallet className="h-5 w-5 text-slate-700" />
            </div>
            <div>
              <p className="font-semibold text-slate-900">
                Giving payment method
                {initial.yearLabel ? (
                  <span className="ml-2 text-xs font-normal text-slate-500">
                    {initial.yearLabel}
                  </span>
                ) : null}
              </p>
              <p className="mt-0.5 text-sm text-slate-600">
                {methodDescription(state.method)}
              </p>
            </div>
          </div>
          <Badge variant={methodBadgeVariant(state.method)}>
            {methodLabel(state.method)}
          </Badge>
        </div>

        {!hasGivingRow ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-none" />
              <p>
                No giving record exists for this member yet. Create one from
                the <span className="font-semibold">Membership Giving</span>{" "}
                panel below before assigning a payment method.
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
                  Annual amount
                </p>
                <p className="mt-1 font-semibold text-slate-900">
                  {formatGbp(initial.annualAmount)}
                </p>
              </div>
              {state.method === "bacs" ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3">
                  <p className="text-xs font-medium uppercase tracking-wider text-amber-700">
                    BACS standing order
                  </p>
                  <p className="mt-1 font-semibold text-slate-900">
                    {formatGbp(state.bacsMonthlyAmount)} / month
                  </p>
                  {state.bacsReference ? (
                    <p className="mt-1 text-xs text-slate-600">
                      Ref: <span className="font-mono">{state.bacsReference}</span>
                    </p>
                  ) : null}
                </div>
              ) : isPaidViaPanel ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3">
                  <p className="text-xs font-medium uppercase tracking-wider text-emerald-700">
                    Paid in full on
                  </p>
                  <p className="mt-1 font-semibold text-slate-900">
                    {formatDateTime(state.paidAt)}
                  </p>
                </div>
              ) : isWaivedViaPanel ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
                    Waiver reason
                  </p>
                  <p className="mt-1 text-sm text-slate-700">
                    {state.waiverReason || "—"}
                  </p>
                </div>
              ) : initial.hasActiveSubscription ? (
                <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-3">
                  <p className="text-xs font-medium uppercase tracking-wider text-blue-700">
                    Live subscription
                  </p>
                  <p className="mt-1 text-sm text-slate-700">
                    Member has an active giving subscription — see the panel above for cycle history.
                  </p>
                </div>
              ) : (
                <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                  <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
                    Set
                  </p>
                  <p className="mt-1 text-sm text-slate-700">
                    {state.setBy ? (
                      <>
                        {state.setBy === "system_backfill_063"
                          ? "Migration backfill"
                          : state.setBy}{" "}
                        · {formatDateTime(state.setAt)}
                      </>
                    ) : (
                      "Not yet tagged"
                    )}
                  </p>
                </div>
              )}
            </div>

            {state.subscriptionLink ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50/40 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
                    Subscription / pay link
                  </p>
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={copyLink}
                      className="h-7 px-2 text-xs"
                    >
                      {linkCopied ? (
                        <>
                          <Check className="h-3.5 w-3.5 mr-1 text-emerald-600" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5 mr-1" />
                          Copy
                        </>
                      )}
                    </Button>
                    <Button
                      asChild
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                    >
                      <a href={mailtoHref}>
                        <Mail className="h-3.5 w-3.5 mr-1" />
                        Email
                      </a>
                    </Button>
                  </div>
                </div>
                <p className="mt-1 break-all font-mono text-[11px] text-slate-600">
                  {state.subscriptionLink}
                </p>
              </div>
            ) : null}

            {error ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
                {error}
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Button
                variant="primary"
                size="sm"
                onClick={() => openDialog({ kind: "send_link" })}
                disabled={!state.subscriptionLink}
              >
                <Mail className="h-4 w-4 mr-1.5" />
                Send subscription link
              </Button>
              <Button
                variant={state.method === "bacs" ? "secondary" : "outline"}
                size="sm"
                onClick={() => openDialog({ kind: "bacs" })}
              >
                <Banknote className="h-4 w-4 mr-1.5" />
                {state.method === "bacs" ? "Update BACS" : "Mark as BACS"}
              </Button>
              <Button
                variant={isPaidViaPanel ? "secondary" : "outline"}
                size="sm"
                onClick={() => openDialog({ kind: "paid_in_full" })}
              >
                <CheckCircle2 className="h-4 w-4 mr-1.5" />
                Mark paid in full
              </Button>
              <Button
                variant={isWaivedViaPanel ? "secondary" : "outline"}
                size="sm"
                onClick={() => openDialog({ kind: "fee_waived" })}
              >
                <ShieldCheck className="h-4 w-4 mr-1.5" />
                Waive fee
              </Button>
              {state.method ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => openDialog({ kind: "reset" })}
                  className="text-slate-500 hover:text-slate-900"
                >
                  <XCircle className="h-4 w-4 mr-1.5" />
                  Clear
                </Button>
              ) : null}
            </div>
          </>
        )}
      </div>

      {/* Send subscription link dialog */}
      <Dialog
        open={dialog.kind === "send_link"}
        onOpenChange={(open) => !submitting && !open && setDialog({ kind: "none" })}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Send subscription link</DialogTitle>
            <DialogDescription>
              Email {memberName} a link they can use to set up online giving.
              Tagging them as &quot;Online subscription&quot; here helps the
              treasurer dashboard track who&apos;s on the platform.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs">
              <p className="font-medium text-slate-700">Link</p>
              <p className="mt-1 break-all font-mono text-slate-600">
                {state.subscriptionLink}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="primary" size="sm">
                <a href={mailtoHref}>
                  <Mail className="h-4 w-4 mr-1.5" />
                  Open in email
                </a>
              </Button>
              <Button variant="outline" size="sm" onClick={copyLink}>
                {linkCopied ? (
                  <>
                    <Check className="h-4 w-4 mr-1.5 text-emerald-600" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 mr-1.5" />
                    Copy link
                  </>
                )}
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setDialog({ kind: "none" })}
              disabled={submitting}
            >
              Close
            </Button>
            <Button
              variant="secondary"
              onClick={() =>
                callApi({ method: "online_subscription" })
              }
              disabled={submitting}
            >
              <Repeat className="h-4 w-4 mr-1.5" />
              Tag as online subscription
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* BACS dialog */}
      <Dialog
        open={dialog.kind === "bacs"}
        onOpenChange={(open) => !submitting && !open && setDialog({ kind: "none" })}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Mark as BACS payer</DialogTitle>
            <DialogDescription>
              Record the agreed monthly standing-order amount {memberName}{" "}
              pays. The treasurer dashboard will count this in the BACS
              breakdown.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <label className="block text-sm">
              <span className="font-medium text-slate-700">
                Monthly amount (£)
              </span>
              <input
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={bacsAmount}
                onChange={(e) => setBacsAmount(e.target.value)}
                placeholder="e.g. 20.00"
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                disabled={submitting}
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium text-slate-700">
                Reference (optional)
              </span>
              <input
                type="text"
                value={bacsRef}
                onChange={(e) => setBacsRef(e.target.value)}
                placeholder="e.g. BRO ANTONIO 25/26"
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                disabled={submitting}
              />
            </label>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setDialog({ kind: "none" })}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() =>
                callApi({
                  method: "bacs",
                  bacs_monthly_amount: bacsAmount,
                  bacs_reference: bacsRef || null,
                })
              }
              disabled={submitting || !bacsAmount}
            >
              <Banknote className="h-4 w-4 mr-1.5" />
              {submitting ? "Saving..." : "Save BACS"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Paid-in-full dialog */}
      <Dialog
        open={dialog.kind === "paid_in_full"}
        onOpenChange={(open) => !submitting && !open && setDialog({ kind: "none" })}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Mark giving as paid in full</DialogTitle>
            <DialogDescription>
              {memberName} paid {formatGbp(initial.annualAmount)} for
              {initial.yearLabel ? ` ${initial.yearLabel}` : " this year"}{" "}
              outside the platform (cash, cheque, or bank transfer).
              Status will flip to <strong>paid</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <label className="block text-sm">
              <span className="font-medium text-slate-700">
                Note (optional)
              </span>
              <input
                type="text"
                value={paidNote}
                onChange={(e) => setPaidNote(e.target.value)}
                placeholder="e.g. cheque #4823, paid 1 Jun"
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                disabled={submitting}
              />
            </label>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setDialog({ kind: "none" })}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() =>
                callApi({ method: "paid_in_full", note: paidNote || null })
              }
              disabled={submitting}
            >
              <CheckCircle2 className="h-4 w-4 mr-1.5" />
              {submitting ? "Saving..." : "Mark as paid"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Fee-waived dialog */}
      <Dialog
        open={dialog.kind === "fee_waived"}
        onOpenChange={(open) => !submitting && !open && setDialog({ kind: "none" })}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Waive giving for this member</DialogTitle>
            <DialogDescription>
              The mosque has agreed to waive {memberName}&apos;s giving for
              {initial.yearLabel ? ` ${initial.yearLabel}` : " this year"}.
              Status flips to <strong>waived</strong> and the reason is
              kept on the record.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <label className="block text-sm">
              <span className="font-medium text-slate-700">
                Reason (required)
              </span>
              <textarea
                rows={3}
                value={waiverReason}
                onChange={(e) => setWaiverReason(e.target.value)}
                placeholder="e.g. financial hardship, honorary member, treasurer decision dated..."
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                disabled={submitting}
              />
            </label>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setDialog({ kind: "none" })}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() =>
                callApi({
                  method: "fee_waived",
                  waiver_reason: waiverReason,
                })
              }
              disabled={submitting || !waiverReason.trim()}
            >
              <ShieldCheck className="h-4 w-4 mr-1.5" />
              {submitting ? "Saving..." : "Waive fee"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset dialog */}
      <Dialog
        open={dialog.kind === "reset"}
        onOpenChange={(open) => !submitting && !open && setDialog({ kind: "none" })}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Clear payment method</DialogTitle>
            <DialogDescription>
              This removes the {methodLabel(state.method).toLowerCase()} tag.
              {state.method === "paid_in_full" || state.method === "fee_waived"
                ? " The giving row's paid/waived status will be left in place — change it from the Membership Giving panel if needed."
                : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setDialog({ kind: "none" })}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              variant="outline"
              onClick={() => callApi({ method: null })}
              disabled={submitting}
            >
              <XCircle className="h-4 w-4 mr-1.5" />
              {submitting ? "Saving..." : "Clear method"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
