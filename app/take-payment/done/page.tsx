// /take-payment/done?payment_id=tip_...
//
// Public landing page the cardholder lands on after the Mooov hosted page
// captures their in-person QR payment. No auth required (the payer isn't an
// admin), and intentionally outside /admin/ so the auth proxy doesn't trap
// them on an admin-login redirect.
//
// Server component: looks up the payment_attempt + lodge for friendly display.
// Falls back to a generic thank-you if the payment_id can't be resolved (e.g.
// somebody bookmarked an expired link). Never reveals payer name / email /
// guest details — just the public-safe summary of the transaction the user
// has just authorised on Mooov.

import { CheckCircle2, Receipt } from "lucide-react";
import Link from "next/link";
import * as db from "@/lib/db";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

type AttemptRow = {
  payment_id: string;
  status: string;
  amount: number;
  currency: string;
  lodge_id: string;
};

type ProjectedRow = {
  status: string;
  currency: string | null;
};

function pickFirst(value: string | string[] | undefined): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (Array.isArray(value) && value[0]) return value[0];
  return null;
}

function formatAmount(amountMinor: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: (currency || "GBP").toUpperCase(),
    }).format(amountMinor / 100);
  } catch {
    return `£${(amountMinor / 100).toFixed(2)}`;
  }
}

type Phase = "succeeded" | "processing" | "unknown";

function phaseFor(status: string | null | undefined): Phase {
  if (!status) return "unknown";
  switch (status) {
    case "succeeded":
    case "captured":
    case "completed":
      return "succeeded";
    case "authorized":
    case "processing":
    case "pending":
      return "processing";
    default:
      return "unknown";
  }
}

async function loadSummary(paymentId: string | null) {
  if (!paymentId || !isSupabaseConfigured()) return null;
  try {
    const supa = createServiceClient();
    const { data: attempt } = await supa
      .schema("mooov")
      .from("payment_attempts")
      .select("payment_id, status, amount, currency, lodge_id")
      .eq("payment_id", paymentId)
      .maybeSingle<AttemptRow>();
    if (!attempt) return null;

    // The LP-side projection is the canonical source of truth for *status*
    // once the webhook has fired. The Mooov redirect can race the webhook by
    // a second or two, so we tolerate either "succeeded on the projection" OR
    // "succeeded on the attempt" as a positive outcome.
    //
    // Amount stays sourced from payment_attempts because that table stores it
    // in minor units (pence), matching the status polling endpoint and what
    // formatAmount below expects. payments.total_amount is in major units
    // (pounds) per the LP-side schema convention, so reading it here would
    // double-divide by 100 and render £1.00 as £0.01.
    const { data: projected } = await supa
      .from("payments")
      .select("status, currency")
      .eq("mooov_payment_id", paymentId)
      .maybeSingle<ProjectedRow>();

    let lodgeName: string | null = null;
    try {
      const lodge = await db.getLodgeById(attempt.lodge_id);
      lodgeName = lodge?.name ?? null;
    } catch {
      lodgeName = null;
    }

    const status = projected?.status ?? attempt.status;
    return {
      paymentId: attempt.payment_id,
      amountMinor: attempt.amount,
      currency: projected?.currency ?? attempt.currency,
      phase: phaseFor(status),
      lodgeName,
    };
  } catch {
    return null;
  }
}

export default async function TakePaymentDonePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const paymentId = pickFirst(params.payment_id);
  const summary = await loadSummary(paymentId);

  const isProcessing = summary?.phase === "processing";
  const showAmount = summary && summary.amountMinor > 0;

  return (
    <main className="min-h-[100dvh] bg-slate-50 px-4 py-10 pb-[calc(2.5rem+env(safe-area-inset-bottom))] pt-[calc(2.5rem+env(safe-area-inset-top))]">
      <div className="mx-auto flex max-w-md flex-col items-stretch gap-6">
        <div className="rounded-3xl bg-white p-8 text-center shadow-md">
          <span
            className={
              isProcessing
                ? "mx-auto grid h-14 w-14 place-items-center rounded-full bg-amber-100 text-amber-700"
                : "mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-100 text-emerald-700"
            }
          >
            <CheckCircle2 className="h-7 w-7" />
          </span>
          <h1 className="mt-5 text-2xl font-semibold tracking-tight text-slate-900">
            {isProcessing ? "Payment received" : "Thank you"}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            {isProcessing
              ? "Your payment is confirming. You'll see a receipt by email shortly."
              : "Your payment has been received. A receipt is on its way to your inbox."}
          </p>

          {showAmount && summary ? (
            <dl className="mt-6 space-y-2 rounded-2xl bg-slate-50 px-5 py-4 text-left text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-slate-500">Amount</dt>
                <dd className="font-semibold text-slate-900">
                  {formatAmount(summary.amountMinor, summary.currency)}
                </dd>
              </div>
              {summary.lodgeName ? (
                <div className="flex items-center justify-between">
                  <dt className="text-slate-500">Paid to</dt>
                  <dd className="font-medium text-slate-800">{summary.lodgeName}</dd>
                </div>
              ) : null}
            </dl>
          ) : null}

          <div className="mt-6 flex items-center justify-center gap-2 text-xs text-slate-400">
            <Receipt className="h-3.5 w-3.5" aria-hidden />
            <span>You can safely close this page.</span>
          </div>
        </div>

        <p className="text-center text-xs text-slate-400">
          Powered by{" "}
          <Link href="/" className="font-medium text-slate-500 hover:text-slate-700">
            LodgePay
          </Link>
        </p>
      </div>
    </main>
  );
}
