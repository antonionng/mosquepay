"use client";

import { useEffect, useState } from "react";
import {
  Wallet,
  CheckCircle2,
  AlertCircle,
  Clock,
  ExternalLink,
  CreditCard,
  Calendar,
  PoundSterling,
  Repeat,
  ShieldAlert,
  XCircle,
  Loader2,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmActionDialog } from "@/components/ui/confirm-action-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface SubscriptionPreview {
  memberEmail: string;
  memberName: string | null;
  currency: string;
  annualAmount: number;
  cadence: "monthly" | "quarterly";
  strategy: string;
  strategyDescription: string;
  autoRenew: boolean;
  yearLabel: string;
  yearStartDate: string;
  yearEndDate: string;
  cycleCount: number;
  firstCycleAmount: number;
  total: number;
  cycles: { sequence: number; dueDate: string; amount: number }[];
}

interface AdvanceInfo {
  alreadyPaid: boolean;
  memberDuesId: string | null;
  nextYearLabel: string | null;
  baseAmount: number | null;
  discountPercent: number;
  amount: number | null;
  currency: string;
}

interface ScheduleInfo {
  id: string;
  status:
    | "pending"
    | "active"
    | "action_required"
    | "past_due"
    | "paused"
    | "cancelled"
    | "completed"
    | "active_stripe";
  cadence: "monthly" | "quarterly";
  splitStrategy: string;
  autoRenew: boolean;
  cyclesTotal: number;
  cyclesPaid: number;
  cyclesOutstanding: number;
  nextChargeAt: string | null;
  nextAmount: number | null;
  lastChargedAt: string | null;
  consecutiveFailures: number;
  lastFailureCode: string | null;
  requiresAction: boolean;
  currency: string;
}

interface DuesInfo {
  annualAmount: number;
  status: "paid" | "outstanding" | "partial";
  paidAmount: number;
  dueDate?: string;
  duesId?: string;
  memberEmail?: string;
  memberName?: string;
  allowInstalments: boolean;
  instalmentCount: number;
  instalmentFrequency: string;
  yearLabel?: string | null;
  advance?: AdvanceInfo | null;
  schedule?: ScheduleInfo | null;
  history: {
    id: string;
    date: string;
    amount: number;
    period: string;
    method?: string;
  }[];
}

function SkeletonBlock() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm animate-pulse">
      <div className="space-y-4">
        <div className="h-5 w-40 rounded bg-slate-100" />
        <div className="h-10 w-32 rounded bg-slate-100" />
        <div className="h-4 w-56 rounded bg-slate-100" />
      </div>
    </div>
  );
}

export default function MemberDuesPage() {
  const [dues, setDues] = useState<DuesInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [payMode, setPayMode] = useState<"payment" | "subscription" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [subscriptionPreview, setSubscriptionPreview] =
    useState<SubscriptionPreview | null>(null);
  const [subscriptionPreviewOpen, setSubscriptionPreviewOpen] = useState(false);
  const [subscriptionPreviewLoading, setSubscriptionPreviewLoading] =
    useState(false);
  const [autoRenewOverride, setAutoRenewOverride] = useState<boolean | null>(
    null,
  );

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/member/dashboard");
        if (res.ok) {
          const data = await res.json();
          setDues(data.dues ?? null);
        } else {
          setDues(null);
        }
      } catch {
        setDues(null);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function handlePay(mode: "payment" | "subscription") {
    if (!dues?.duesId || !dues?.memberEmail) {
      setError(
        "We couldn't load your dues record. Please refresh the page, or contact your lodge secretary if this persists."
      );
      setPayMode(null);
      setSubscriptionPreviewOpen(false);
      return;
    }
    setPaying(true);
    setError(null);
    try {
      const res = await fetch("/api/dues/pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dues_id: dues.duesId,
          member_email: dues.memberEmail,
          member_name: dues.memberName,
          mode,
          ...(mode === "subscription" && autoRenewOverride !== null
            ? { auto_renew: autoRenewOverride }
            : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.url) {
        window.location.href = data.url;
        return;
      }
      throw new Error(data.error ?? "Could not start payment.");
    } catch (paymentError) {
      setError(paymentError instanceof Error ? paymentError.message : "Could not start payment.");
    } finally {
      setPaying(false);
      setPayMode(null);
      setSubscriptionPreviewOpen(false);
    }
  }

  // Open the rich plan preview dialog. Hits the side-effect-free
  // /api/dues/subscription-preview endpoint so the member sees the full
  // schedule (cycles, dates, amounts, total) BEFORE we redirect them
  // to Mooov hosted Checkout — which only shows cycle 1.
  async function openSubscriptionPreview() {
    if (!dues?.duesId || !dues?.memberEmail) {
      setError(
        "We couldn't load your dues record. Please refresh the page, or contact your lodge secretary if this persists.",
      );
      return;
    }
    setSubscriptionPreviewLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/dues/subscription-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dues_id: dues.duesId,
          member_email: dues.memberEmail,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.plan) {
        throw new Error(data.error ?? "Could not preview your plan.");
      }
      const plan = data.plan as SubscriptionPreview;
      setSubscriptionPreview(plan);
      setAutoRenewOverride(plan.autoRenew);
      setSubscriptionPreviewOpen(true);
    } catch (previewError) {
      setError(
        previewError instanceof Error
          ? previewError.message
          : "Could not preview your plan.",
      );
    } finally {
      setSubscriptionPreviewLoading(false);
    }
  }

  const isPaid = dues?.status === "paid";
  const outstanding = dues ? dues.annualAmount - dues.paidAmount : 0;
  const instalmentAmount =
    dues?.allowInstalments && dues.instalmentCount > 0
      ? (dues.annualAmount / dues.instalmentCount).toFixed(2)
      : null;
  const advance = dues?.advance ?? null;
  const schedule = dues?.schedule ?? null;
  const [advanceLoading, setAdvanceLoading] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);

  async function handleCancelSchedule() {
    if (!schedule) return;
    setCancelling(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/dues/schedules/${schedule.id}/cancel`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            actor: "member",
            reason: "member_self_cancel",
          }),
        }
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(body.error ?? "Could not cancel.");
      }
      window.location.reload();
    } catch (cancelErr) {
      setError(
        cancelErr instanceof Error
          ? cancelErr.message
          : "Could not cancel."
      );
    } finally {
      setCancelling(false);
      setCancelConfirmOpen(false);
    }
  }

  async function handlePayInAdvance() {
    if (!advance || advance.alreadyPaid) return;
    setAdvanceLoading(true);
    setError(null);
    try {
      const mintRes = await fetch("/api/dues/pay-in-advance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const mintData = await mintRes.json().catch(() => ({}));
      if (!mintRes.ok || !mintData.member_dues_id) {
        throw new Error(
          mintData.error ?? "Could not start advance payment."
        );
      }
      const payRes = await fetch("/api/dues/pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dues_id: mintData.member_dues_id,
          member_email: dues?.memberEmail,
          member_name: dues?.memberName,
          mode: "one_off",
        }),
      });
      const payData = await payRes.json().catch(() => ({}));
      if (payRes.ok && payData.url) {
        window.location.href = payData.url;
        return;
      }
      throw new Error(payData.error ?? "Could not start advance payment.");
    } catch (advErr) {
      setError(
        advErr instanceof Error ? advErr.message : "Could not start advance payment."
      );
    } finally {
      setAdvanceLoading(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dues</h1>
        <p className="text-slate-500 mt-1">Manage your annual lodge dues</p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SkeletonBlock />
          <SkeletonBlock />
        </div>
      ) : !dues ? (
        <>
          {error && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800">
              {error}
            </div>
          )}
          <div className="rounded-2xl border border-slate-200 bg-white p-10 shadow-sm text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-slate-50 mb-3">
              <Wallet className="h-6 w-6 text-slate-300" />
            </div>
            <p className="text-sm font-medium text-slate-700">
              No dues record found
            </p>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              We couldn&apos;t find a dues record for your account. If you believe this is wrong, please contact your lodge secretary.
            </p>
          </div>
        </>
      ) : (
        <>
          {error && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div
              className={`rounded-2xl border p-6 shadow-sm ${
                isPaid
                  ? "border-emerald-200 bg-emerald-50/50"
                  : "border-amber-200 bg-amber-50/50"
              }`}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-slate-600 uppercase tracking-wider">
                  Current Status
                </h2>
                {isPaid ? (
                  <Badge variant="success">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Paid
                  </Badge>
                ) : (
                  <Badge variant="warning">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    Outstanding
                  </Badge>
                )}
              </div>

              {isPaid ? (
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                  <div>
                    <p className="text-lg font-bold text-emerald-900">All dues paid</p>
                    <p className="text-sm text-emerald-700">Thank you for your contribution</p>
                  </div>
                </div>
              ) : (
                <div>
                  <p className="text-3xl font-bold text-amber-900">
                    £{outstanding.toFixed(2)}
                  </p>
                  <p className="text-sm text-amber-700 mt-1">
                    Outstanding balance
                    {dues?.dueDate && (
                      <span className="flex items-center gap-1 mt-1">
                        <Calendar className="h-3 w-3" />
                        Due by{" "}
                        {new Date(dues.dueDate).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })}
                      </span>
                    )}
                  </p>
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-sm font-semibold text-slate-600 uppercase tracking-wider mb-4">
                Annual Dues
              </h2>
              <div className="flex items-baseline gap-1 mb-1">
                <PoundSterling className="h-6 w-6 text-slate-400" />
                <span className="text-3xl font-bold text-slate-900">
                  {dues?.annualAmount.toFixed(2)}
                </span>
              </div>
              <p className="text-sm text-slate-500">per year</p>

              {dues && dues.paidAmount > 0 && dues.paidAmount < dues.annualAmount && (
                <div className="mt-4">
                  <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
                    <span>Paid: £{dues.paidAmount.toFixed(2)}</span>
                    <span>
                      {Math.round((dues.paidAmount / dues.annualAmount) * 100)}%
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-blue-500 transition-all"
                      style={{
                        width: `${(dues.paidAmount / dues.annualAmount) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {schedule && (
            <ScheduleStatusCard
              schedule={schedule}
              cancelling={cancelling}
              onCancelClick={() => setCancelConfirmOpen(true)}
            />
          )}

          {!isPaid && !schedule && (
            <div className="space-y-3">
              <div className="rounded-2xl border border-blue-200 bg-blue-50/50 p-6 shadow-sm">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100">
                      <CreditCard className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900">Pay in full</p>
                      <p className="text-sm text-slate-600">
                        One-time payment of £{outstanding.toFixed(2)}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="primary"
                    size="lg"
                    disabled={paying}
                    onClick={() => setPayMode("payment")}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    {paying ? "Redirecting..." : `Pay £${outstanding.toFixed(2)} Now`}
                  </Button>
                </div>
              </div>

              {dues?.allowInstalments && instalmentAmount && (
                <div className="rounded-2xl border border-purple-200 bg-purple-50/50 p-6 shadow-sm">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-100">
                        <Repeat className="h-5 w-5 text-purple-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900">Pay in instalments</p>
                        <p className="text-sm text-slate-600">
                          £{instalmentAmount} per{" "}
                          {dues.instalmentFrequency === "monthly" ? "month" : "quarter"}{" "}
                          over {dues.instalmentCount} payments
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="secondary"
                      size="lg"
                      disabled={paying || subscriptionPreviewLoading}
                      onClick={openSubscriptionPreview}
                    >
                      {subscriptionPreviewLoading ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Loading plan...
                        </>
                      ) : (
                        <>
                          <Repeat className="h-4 w-4 mr-2" />
                          Set Up Instalments
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {isPaid && advance && advance.amount != null && (
            <div className="rounded-2xl border border-blue-200 bg-blue-50/40 p-6 shadow-sm">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100">
                    <Calendar className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">
                      {advance.alreadyPaid
                        ? `${advance.nextYearLabel} dues are paid in advance`
                        : `Pay your ${advance.nextYearLabel} dues now`}
                    </p>
                    <p className="text-sm text-slate-600">
                      {advance.alreadyPaid
                        ? `Thank you — you're set for the next masonic year.`
                        : advance.discountPercent > 0 && advance.baseAmount
                        ? `£${advance.amount.toFixed(2)} now — saves ${advance.discountPercent}% vs the £${advance.baseAmount.toFixed(2)} standard rate.`
                        : `£${advance.amount.toFixed(2)} locks in next year now.`}
                    </p>
                  </div>
                </div>
                {!advance.alreadyPaid && (
                  <Button
                    variant="primary"
                    size="lg"
                    disabled={advanceLoading}
                    onClick={handlePayInAdvance}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    {advanceLoading
                      ? "Redirecting..."
                      : `Pay £${advance.amount.toFixed(2)} for ${advance.nextYearLabel}`}
                  </Button>
                )}
              </div>
            </div>
          )}

          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-6 py-4">
              <h2 className="text-base font-semibold text-slate-900">Payment History</h2>
            </div>
            <div className="divide-y divide-slate-100">
              {dues?.history && dues.history.length > 0 ? (
                dues.history.map((item) => (
                  <div key={item.id} className="flex items-center gap-4 px-6 py-4">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800">{item.period}</p>
                      <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(item.date).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                        {item.method && ` · ${item.method}`}
                      </p>
                    </div>
                    <p className="text-sm font-semibold text-slate-900">
                      £{item.amount.toFixed(2)}
                    </p>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-50 mb-3">
                    <Wallet className="h-6 w-6 text-slate-300" />
                  </div>
                  <p className="text-sm font-medium text-slate-500">No payment history</p>
                  <p className="text-xs text-slate-400 mt-1">
                    Past dues payments will appear here
                  </p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
      <ConfirmActionDialog
        open={payMode === "payment"}
        onOpenChange={(open) => {
          if (!open) setPayMode(null);
        }}
        title="Pay dues in full?"
        description={`You will be taken to a secure checkout to pay £${outstanding.toFixed(2)}.`}
        confirmLabel="Continue to checkout"
        loading={paying}
        onConfirm={() => {
          if (payMode === "payment") void handlePay("payment");
        }}
      />
      <SubscriptionPreviewDialog
        open={subscriptionPreviewOpen}
        plan={subscriptionPreview}
        loading={paying}
        autoRenewOverride={autoRenewOverride}
        onAutoRenewChange={setAutoRenewOverride}
        onOpenChange={(open) => {
          if (!open && !paying) setSubscriptionPreviewOpen(false);
        }}
        onConfirm={() => void handlePay("subscription")}
      />
      <ConfirmActionDialog
        open={cancelConfirmOpen}
        onOpenChange={(open) => {
          if (!open && !cancelling) setCancelConfirmOpen(false);
        }}
        title="Cancel monthly dues?"
        description={
          schedule
            ? `We'll stop charging your card at the start of each month. Any cycles already paid stay paid; you can pay the remaining balance one-off whenever you're ready.`
            : ""
        }
        confirmLabel="Cancel monthly dues"
        cancelLabel="Keep monthly"
        tone="danger"
        loading={cancelling}
        onConfirm={handleCancelSchedule}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// ScheduleStatusCard
// ---------------------------------------------------------------------------

function formatNextChargeDate(value: string | null): string {
  if (!value) return "scheduled";
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function ScheduleStatusCard({
  schedule,
  cancelling,
  onCancelClick,
}: {
  schedule: ScheduleInfo;
  cancelling: boolean;
  onCancelClick: () => void;
}) {
  const isActionRequired = schedule.requiresAction;
  const isPaused = schedule.status === "paused";
  const isPastDue = schedule.status === "past_due";
  const accent = isActionRequired || isPastDue
    ? "border-amber-200 bg-amber-50/50"
    : isPaused
      ? "border-slate-300 bg-slate-50"
      : "border-emerald-200 bg-emerald-50/40";

  const progressPct =
    schedule.cyclesTotal > 0
      ? Math.round((schedule.cyclesPaid / schedule.cyclesTotal) * 100)
      : 0;

  return (
    <div className={`rounded-2xl border p-6 shadow-sm ${accent}`}>
      <div className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/70">
              <Repeat className="h-5 w-5 text-slate-700" />
            </div>
            <div>
              <p className="font-semibold text-slate-900">
                Monthly dues subscription
              </p>
              <p className="text-sm text-slate-600">
                {schedule.cyclesPaid} of {schedule.cyclesTotal} months paid ·{" "}
                {schedule.cyclesOutstanding} remaining
              </p>
            </div>
          </div>
          <Badge
            variant={
              isActionRequired
                ? "warning"
                : isPaused
                  ? "default"
                  : isPastDue
                    ? "warning"
                    : "success"
            }
          >
            {isActionRequired
              ? "Action needed"
              : isPaused
                ? "Paused"
                : isPastDue
                  ? "Past due"
                  : "Active"}
          </Badge>
        </div>

        <div className="h-2 rounded-full bg-white/70 overflow-hidden">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        {isActionRequired ? (
          <div className="flex flex-col gap-3 rounded-xl border border-amber-300 bg-amber-100/50 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-2">
              <ShieldAlert className="h-4 w-4 mt-0.5 flex-none text-amber-700" />
              <p className="text-sm text-amber-900">
                Your bank wants to verify this month&apos;s charge. Tap below
                to complete it — usually under a minute.
              </p>
            </div>
            <Button
              asChild
              variant="primary"
              size="sm"
              className="shrink-0"
            >
              <a href={`/dues/schedules/${schedule.id}/resume`}>
                <ShieldAlert className="h-4 w-4 mr-2" />
                Verify card
              </a>
            </Button>
          </div>
        ) : isPastDue && schedule.consecutiveFailures > 0 ? (
          <div className="rounded-xl border border-amber-300 bg-amber-100/50 p-4 text-sm text-amber-900">
            <p className="font-medium">Last charge didn&apos;t go through.</p>
            <p className="mt-1">
              We&apos;ll automatically try again on{" "}
              {formatNextChargeDate(schedule.nextChargeAt)}. If your card is
              expiring or has changed, please contact your lodge secretary.
            </p>
          </div>
        ) : null}

        <dl className="grid grid-cols-2 gap-y-2 text-sm">
          <dt className="text-slate-500">Next charge</dt>
          <dd className="text-right text-slate-900 tabular-nums">
            {schedule.nextAmount != null
              ? `£${schedule.nextAmount.toFixed(2)} on ${formatNextChargeDate(schedule.nextChargeAt)}`
              : "—"}
          </dd>
          {schedule.lastChargedAt ? (
            <>
              <dt className="text-slate-500">Last charge</dt>
              <dd className="text-right text-slate-900 tabular-nums">
                {formatNextChargeDate(schedule.lastChargedAt)}
              </dd>
            </>
          ) : null}
        </dl>

        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={onCancelClick}
            disabled={cancelling}
          >
            <XCircle className="h-4 w-4 mr-2" />
            Cancel monthly dues
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SubscriptionPreviewDialog
// ---------------------------------------------------------------------------
// Shown after the member clicks "Set Up Instalments" on /member/dues.
// Hosted Mooov Checkout will only show cycle 1 + saved-card setup, so
// the full schedule context (cycle count, dates, amounts, total,
// auto-renew choice, cancel-anytime note) has to live here, server-
// computed by /api/dues/subscription-preview against the same code path
// as /api/dues/pay so the preview cannot disagree with the actual charge.

function formatPlanDate(value: string): string {
  return new Date(`${value.slice(0, 10)}T12:00:00.000Z`).toLocaleDateString(
    "en-GB",
    { day: "numeric", month: "short", year: "numeric" },
  );
}

function formatPlanCycleLabel(
  cycle: { sequence: number; dueDate: string },
  isFirst: boolean,
): string {
  if (isFirst) return `Today (${formatPlanDate(cycle.dueDate)})`;
  return formatPlanDate(cycle.dueDate);
}

function SubscriptionPreviewDialog({
  open,
  plan,
  loading,
  autoRenewOverride,
  onAutoRenewChange,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  plan: SubscriptionPreview | null;
  loading: boolean;
  autoRenewOverride: boolean | null;
  onAutoRenewChange: (next: boolean) => void;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  const showAutoRenew =
    autoRenewOverride !== null
      ? autoRenewOverride
      : (plan?.autoRenew ?? true);
  const finalCycle = plan?.cycles[plan.cycles.length - 1] ?? null;
  const tailCount = plan ? Math.max(0, plan.cycleCount - 1) : 0;
  const currencySymbol = plan?.currency === "GBP" ? "£" : (plan?.currency ?? "");

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !loading && onOpenChange(next)}
    >
      <DialogContent
        showClose={!loading}
        className="border-dash-border bg-dash-surface p-0 text-dash-text shadow-2xl sm:max-w-lg"
      >
        <DialogHeader className="space-y-3 border-b border-dash-border px-6 py-5 text-left">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
            <Repeat className="h-5 w-5" />
          </div>
          <div>
            <DialogTitle className="text-lg font-semibold text-dash-text">
              {plan
                ? `Your ${plan.cadence} dues plan`
                : "Your dues plan"}
            </DialogTitle>
            <DialogDescription className="mt-1 text-sm leading-6 text-dash-muted">
              {plan
                ? `Masonic year ${plan.yearLabel} · ${plan.strategyDescription}`
                : "Loading your plan..."}
            </DialogDescription>
          </div>
        </DialogHeader>

        {plan ? (
          <div className="max-h-[55vh] space-y-5 overflow-y-auto px-6 py-5">
            <div className="rounded-xl border border-purple-100 bg-purple-50/40 p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-purple-700">
                Today&apos;s charge
              </p>
              <p className="mt-1 text-3xl font-bold tabular-nums text-slate-900">
                {currencySymbol}
                {plan.firstCycleAmount.toFixed(2)}
              </p>
              <p className="mt-1 text-sm text-slate-600">
                {tailCount > 0
                  ? `Then ${tailCount} more ${plan.cadence === "monthly" ? "monthly" : "quarterly"} payment${tailCount === 1 ? "" : "s"} on file.`
                  : "Single cycle — your card stays on file in case auto-renew kicks in."}
                {" "}
                <span className="text-slate-500">
                  Total {currencySymbol}
                  {plan.total.toFixed(2)} for {plan.yearLabel}.
                </span>
              </p>
            </div>

            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
                Schedule
              </p>
              <ul className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-200">
                {plan.cycles.map((cycle, idx) => (
                  <li
                    key={cycle.sequence}
                    className="flex items-center justify-between px-4 py-2.5 text-sm"
                  >
                    <span
                      className={
                        idx === 0
                          ? "font-medium text-slate-900"
                          : "text-slate-700"
                      }
                    >
                      {formatPlanCycleLabel(cycle, idx === 0)}
                    </span>
                    <span className="font-medium tabular-nums text-slate-900">
                      {currencySymbol}
                      {cycle.amount.toFixed(2)}
                    </span>
                  </li>
                ))}
              </ul>
              {finalCycle ? (
                <p className="mt-2 text-xs text-slate-500">
                  Final charge {formatPlanDate(finalCycle.dueDate)} — covers{" "}
                  {plan.yearLabel} in full.
                </p>
              ) : null}
            </div>

            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 px-4 py-3">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                checked={showAutoRenew}
                onChange={(event) =>
                  onAutoRenewChange(event.target.checked)
                }
                disabled={loading}
              />
              <span className="text-sm">
                <span className="block font-medium text-slate-900">
                  Auto-renew next year
                </span>
                <span className="mt-0.5 block text-slate-600">
                  Keep paying monthly when the next masonic year starts. You
                  can cancel from this page anytime — including before the
                  first renewal cycle.
                </span>
              </span>
            </label>

            <div className="flex items-start gap-2 text-xs text-slate-500">
              <Lock className="mt-0.5 h-3.5 w-3.5 flex-none" />
              <span>
                You&apos;ll be redirected to a secure hosted card form to
                authorise today&apos;s charge and save your card. Subsequent
                charges run automatically — no further action needed.
              </span>
            </div>
          </div>
        ) : (
          <div className="px-6 py-10 text-center text-sm text-slate-500">
            <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin text-slate-400" />
            Building your plan...
          </div>
        )}

        <DialogFooter className="gap-2 border-t border-dash-border px-6 py-4 sm:justify-end [&_button]:w-full sm:[&_button]:w-auto">
          <Button
            type="button"
            variant="secondary"
            disabled={loading}
            onClick={() => onOpenChange(false)}
          >
            Back
          </Button>
          <Button
            type="button"
            variant="primary"
            disabled={loading || !plan}
            onClick={onConfirm}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Redirecting...
              </>
            ) : (
              <>
                <ExternalLink className="mr-2 h-4 w-4" />
                Continue to secure checkout
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
