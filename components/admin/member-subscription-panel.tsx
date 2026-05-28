"use client";

import { useState } from "react";
import {
  Repeat,
  ShieldAlert,
  XCircle,
  AlertTriangle,
  Calendar,
  CircleCheck,
  Clock,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmActionDialog } from "@/components/ui/confirm-action-dialog";
import { getScheduleStatusDisplay } from "@/lib/dues/status-display";
import type { DuesSchedule, MemberDuesInstalment } from "@/lib/db/types";

interface Props {
  schedule: DuesSchedule;
  instalments: MemberDuesInstalment[];
  memberName: string;
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
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

function formatAmount(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2,
  }).format(amount);
}

const CADENCE_LABELS: Record<string, string> = {
  monthly: "Monthly",
  quarterly: "Quarterly",
};

const STRATEGY_LABELS: Record<string, string> = {
  even_split: "Even split",
  catch_up_lump: "Catch-up lump (month 1)",
  catch_up_balloon: "Year-end balloon",
  reslice: "Resliced over remaining months",
  pro_rata: "Pro-rata (mid-year join)",
};

export function MemberSubscriptionPanel({
  schedule,
  instalments,
  memberName,
}: Props) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [localStatus, setLocalStatus] = useState(schedule.status);
  const [error, setError] = useState<string | null>(null);

  const display = getScheduleStatusDisplay(localStatus);

  const orderedInstalments = [...instalments].sort(
    (a, b) => a.sequence - b.sequence
  );
  const cyclesTotal = orderedInstalments.length;
  const cyclesPaid = orderedInstalments.filter((i) => i.status === "paid")
    .length;
  const progressPct =
    cyclesTotal > 0 ? Math.round((cyclesPaid / cyclesTotal) * 100) : 0;

  const nextOutstanding = orderedInstalments.find(
    (i) => i.status === "outstanding" || i.status === "overdue"
  );

  const isCancellable =
    localStatus === "active" ||
    localStatus === "past_due" ||
    localStatus === "action_required" ||
    localStatus === "paused";

  async function handleCancel() {
    setCancelling(true);
    setError(null);
    try {
      const res = await fetch(`/api/dues/schedules/${schedule.id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actor: "admin" }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? "Cancel failed.");
      }
      setLocalStatus("cancelled");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cancel failed.");
    } finally {
      setCancelling(false);
      setConfirmOpen(false);
    }
  }

  return (
    <div
      className={`rounded-2xl border p-6 shadow-sm ${display.accentClasses}`}
    >
      <div className="flex flex-col gap-5">
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
                {CADENCE_LABELS[schedule.cadence] ?? schedule.cadence} ·{" "}
                {STRATEGY_LABELS[schedule.split_strategy] ??
                  schedule.split_strategy}{" "}
                · auto-renew {schedule.auto_renew ? "on" : "off"}
              </p>
            </div>
          </div>
          <Badge variant={display.badgeVariant}>{display.label}</Badge>
        </div>

        <p className="text-xs text-slate-600">{display.description}</p>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-slate-700">
              {cyclesPaid} of {cyclesTotal} cycles paid
            </span>
            <span className="text-slate-500">{progressPct}%</span>
          </div>
          <div className="h-2 rounded-full bg-white/70 overflow-hidden">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
          <div className="rounded-xl bg-white/70 p-3">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Calendar className="h-3.5 w-3.5" />
              Next charge
            </div>
            <div className="mt-1 font-medium text-slate-900">
              {formatDate(schedule.next_charge_at)}
              {nextOutstanding ? (
                <>
                  {" · "}
                  <span className="font-semibold">
                    {formatAmount(nextOutstanding.amount, "GBP")}
                  </span>
                </>
              ) : null}
            </div>
          </div>
          <div className="rounded-xl bg-white/70 p-3">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Clock className="h-3.5 w-3.5" />
              Last charged
            </div>
            <div className="mt-1 font-medium text-slate-900">
              {formatDateTime(schedule.last_charged_at)}
            </div>
          </div>
        </div>

        {schedule.consecutive_failures > 0 ? (
          <div className="rounded-xl border border-amber-300 bg-amber-100/50 p-3 text-xs text-amber-900">
            <div className="flex items-center gap-2 font-semibold">
              <AlertTriangle className="h-3.5 w-3.5" />
              {schedule.consecutive_failures} consecutive failure
              {schedule.consecutive_failures === 1 ? "" : "s"}
            </div>
            {schedule.last_failure_code ? (
              <div className="mt-1 font-mono text-[11px]">
                code: {schedule.last_failure_code}
                {schedule.last_failure_category
                  ? ` · category: ${schedule.last_failure_category}`
                  : ""}
                {schedule.last_failure_at
                  ? ` · ${formatDateTime(schedule.last_failure_at)}`
                  : ""}
              </div>
            ) : null}
          </div>
        ) : null}

        {localStatus === "action_required" ? (
          <div className="flex flex-col gap-2 rounded-xl border border-amber-300 bg-amber-100/50 p-3 text-xs text-amber-900 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-2">
              <ShieldAlert className="h-4 w-4 mt-0.5 flex-none text-amber-700" />
              <p>
                {memberName} needs to complete 3DS verification on their
                browser. Resume link is valid until the cron retries.
              </p>
            </div>
            <Button asChild variant="outline" size="sm">
              <a
                href={`/dues/schedules/${schedule.id}/resume`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open resume page
              </a>
            </Button>
          </div>
        ) : null}

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Cycle history
          </p>
          <div className="overflow-hidden rounded-xl border border-white/70 bg-white/70">
            <table className="w-full text-sm">
              <thead className="bg-slate-50/70 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2 text-left">#</th>
                  <th className="px-3 py-2 text-left">Due</th>
                  <th className="px-3 py-2 text-right">Amount</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">Paid</th>
                </tr>
              </thead>
              <tbody>
                {orderedInstalments.map((instalment) => (
                  <tr
                    key={instalment.id}
                    className="border-t border-slate-100 text-slate-700"
                  >
                    <td className="px-3 py-2">{instalment.sequence}</td>
                    <td className="px-3 py-2">
                      {formatDate(instalment.due_date)}
                    </td>
                    <td className="px-3 py-2 text-right font-medium">
                      {formatAmount(instalment.amount, "GBP")}
                    </td>
                    <td className="px-3 py-2">
                      <InstalmentStatusBadge status={instalment.status} />
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-500">
                      {formatDate(instalment.paid_at)}
                    </td>
                  </tr>
                ))}
                {orderedInstalments.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-3 py-6 text-center text-xs text-slate-500"
                    >
                      No instalments seeded yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        {schedule.mooov_subscription_id || schedule.stripe_customer_id ? (
          <div className="rounded-xl bg-white/40 px-3 py-2 text-[11px] font-mono text-slate-500">
            {schedule.mooov_subscription_id ? (
              <div>mooov_subscription_id: {schedule.mooov_subscription_id}</div>
            ) : null}
            {schedule.stripe_customer_id ? (
              <div>stripe_customer_id: {schedule.stripe_customer_id}</div>
            ) : null}
            {schedule.mooov_payment_method_id ? (
              <div>
                mooov_payment_method_id: {schedule.mooov_payment_method_id}
              </div>
            ) : null}
            <div>customer_ref: {schedule.customer_ref}</div>
          </div>
        ) : null}

        {error ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
            {error}
          </div>
        ) : null}

        {isCancellable ? (
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmOpen(true)}
              disabled={cancelling}
            >
              <XCircle className="h-4 w-4 mr-2" />
              Cancel subscription
            </Button>
          </div>
        ) : null}
      </div>

      <ConfirmActionDialog
        open={confirmOpen}
        onOpenChange={(next) => {
          if (!cancelling) setConfirmOpen(next);
        }}
        title="Cancel monthly subscription?"
        description={`This stops further charges for ${memberName}. Existing paid cycles stay paid; outstanding cycles flip to manual. The member can re-enrol from their portal.`}
        confirmLabel="Cancel subscription"
        loading={cancelling}
        tone="danger"
        onConfirm={handleCancel}
      />
    </div>
  );
}

function InstalmentStatusBadge({ status }: { status: string }) {
  if (status === "paid") {
    return (
      <Badge variant="success">
        <CircleCheck className="h-3 w-3 mr-1" />
        Paid
      </Badge>
    );
  }
  if (status === "overdue") {
    return <Badge variant="destructive">Overdue</Badge>;
  }
  if (status === "outstanding") {
    return <Badge variant="default">Outstanding</Badge>;
  }
  if (status === "skipped") {
    return <Badge variant="default">Skipped</Badge>;
  }
  if (status === "refunded") {
    return <Badge variant="default">Refunded</Badge>;
  }
  return <Badge variant="default">{status}</Badge>;
}
