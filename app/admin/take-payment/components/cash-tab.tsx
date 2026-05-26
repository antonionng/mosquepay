"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Banknote,
  CheckCircle2,
  HeartHandshake,
  Loader2,
  RotateCcw,
  TriangleAlert,
  User,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AmountDisplay } from "./amount-display";
import { AmountKeypad } from "./amount-keypad";
import { PayerRow } from "./payer-row";
import { ExtrasSection } from "./extras-section";
import { formatMoney, newClientToken } from "./helpers";
import type {
  CashResponse,
  CategoryId,
  MemberOption,
  PayerSelection,
} from "./types";
import { buildPayerPayload, displayPayerName } from "./payer-payload";

// Cash tab — treasurer-recorded cash entry.
//
// Same backbone as the Charge tab (keypad + payer row + extras) but the
// bottom CTA records the entry directly (no Mooov call, no QR). After the
// POST succeeds we show an in-place confirmation with a 5-minute Undo
// button. After 5 minutes the form resets cleanly; the admin can still
// void from the History tab indefinitely.

const VOID_WINDOW_MS = 5 * 60 * 1000;

type ConfirmationState = {
  paymentId: string;
  amountMinor: number;
  currency: string;
  payerName: string | null;
  payerKind: PayerSelection["kind"];
  giftAidEligible: boolean;
  loggedAt: number;
  category: CategoryId;
};

export function CashTab({
  members,
  amount,
  setAmount,
  category,
  setCategory,
  reference,
  setReference,
  description,
  setDescription,
  payer,
  setPayer,
  onLogged,
  onJumpToHistory,
}: {
  members: MemberOption[];
  amount: string;
  setAmount: React.Dispatch<React.SetStateAction<string>>;
  category: CategoryId;
  setCategory: (v: CategoryId) => void;
  reference: string;
  setReference: (v: string) => void;
  description: string;
  setDescription: (v: string) => void;
  payer: PayerSelection;
  setPayer: (v: PayerSelection) => void;
  onLogged: () => void;
  // Lets the parent navigate to the History tab and highlight a specific row.
  onJumpToHistory: (paymentId: string) => void;
}) {
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<ConfirmationState | null>(
    null,
  );
  const [voiding, setVoiding] = useState(false);
  const [tick, setTick] = useState(0);
  const clientTokenRef = useRef(newClientToken());

  // For high-value entries we require a confirmation tap to guard against a
  // fat-fingered £200 instead of £20. QR side has the visible amount the
  // payer sees, so it's far less likely to be a typo.
  const [pendingHighValueConfirm, setPendingHighValueConfirm] = useState(false);

  // Tick once a second while a confirmation is showing so the undo countdown
  // re-renders. Drops when confirmation is null.
  useEffect(() => {
    if (!confirmation) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [confirmation]);

  const undoMsLeft = confirmation
    ? Math.max(0, VOID_WINDOW_MS - (Date.now() - confirmation.loggedAt))
    : 0;
  // tick is read here purely to ensure re-render. The lint disable keeps
  // the dependency declaration explicit-by-intent.
  void tick;

  const reset = useCallback(() => {
    setAmount("");
    setReference("");
    setDescription("");
    setNote("");
    setError(null);
    setConfirmation(null);
    setPendingHighValueConfirm(false);
    clientTokenRef.current = newClientToken();
    // Keep category sticky — treasurers logging a row of cash payments
    // usually want the same category (e.g. raffle, dining) without
    // re-selecting each time.
  }, [setAmount, setReference, setDescription]);

  const submit = useCallback(async () => {
    setError(null);
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setError("Enter an amount in pounds (e.g. 45 or 12.50).");
      return;
    }
    if (numericAmount > 5000) {
      setError(
        "Amounts above £5,000 cannot be recorded on the in-person flow.",
      );
      return;
    }
    if (numericAmount >= 200 && !pendingHighValueConfirm) {
      setPendingHighValueConfirm(true);
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/take-payment/cash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: numericAmount,
          category,
          reference,
          description,
          note,
          client_token: clientTokenRef.current,
          ...buildPayerPayload(payer),
        }),
      });
      const body = (await res.json()) as CashResponse;
      if (!res.ok || "error" in body) {
        const message =
          "error" in body ? body.error : "Could not record cash payment.";
        setError(message);
        return;
      }
      setConfirmation({
        paymentId: body.payment_id,
        amountMinor: body.amount,
        currency: body.currency,
        payerName: body.payer_name ?? body.member_name ?? displayPayerName(payer),
        payerKind: payer.kind,
        giftAidEligible: body.gift_aid_eligible,
        loggedAt: Date.now(),
        category,
      });
      setPendingHighValueConfirm(false);
      // Tiny haptic on success when supported. iOS Safari ignores this but
      // Android Chrome buzzes which feels right after a confirmation tap.
      try {
        navigator.vibrate?.(20);
      } catch {
        /* ignore */
      }
      onLogged();
    } catch (err) {
      console.error("cash payment submit failed", err);
      setError("Network error. Try again.");
    } finally {
      setSubmitting(false);
    }
  }, [
    amount,
    category,
    reference,
    description,
    payer,
    note,
    pendingHighValueConfirm,
    onLogged,
  ]);

  const undo = useCallback(async () => {
    if (!confirmation) return;
    setVoiding(true);
    try {
      const res = await fetch("/api/admin/take-payment/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payment_id: confirmation.paymentId,
          reason: "undo_within_window",
        }),
      });
      if (res.ok) {
        onLogged();
        reset();
      } else {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? "Could not undo. Try voiding from History.");
      }
    } finally {
      setVoiding(false);
    }
  }, [confirmation, onLogged, reset]);

  if (confirmation) {
    const amountLabel = formatMoney(
      confirmation.amountMinor,
      confirmation.currency,
    );
    const undoSecs = Math.ceil(undoMsLeft / 1000);
    const undoExpired = undoMsLeft <= 0;
    return (
      <Card className="space-y-4 border-emerald-200 bg-emerald-50/40 p-6 text-center sm:p-10">
        <CheckCircle2 className="mx-auto h-16 w-16 text-emerald-600 sm:h-20 sm:w-20" />
        <div className="space-y-1.5">
          <h2 className="text-3xl font-semibold text-emerald-900 sm:text-4xl">
            {amountLabel} logged
          </h2>
          <p className="text-sm text-emerald-800">
            {confirmation.payerName
              ? `From ${confirmation.payerName}`
              : "Guest payment"}
            {confirmation.category !== "general"
              ? ` · ${confirmation.category}`
              : ""}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-1.5">
            <Badge variant="outline" className="gap-1 border-slate-300">
              <Banknote className="h-3 w-3" />
              Cash
            </Badge>
            {confirmation.payerName ? (
              <Badge variant="outline" className="gap-1 border-slate-300">
                <User className="h-3 w-3" />
                {confirmation.payerName}
              </Badge>
            ) : null}
            {confirmation.giftAidEligible ? (
              <Badge variant="success" className="gap-1">
                <HeartHandshake className="h-3 w-3" />
                Gift Aid auto-logged
              </Badge>
            ) : null}
          </div>
          <p className="text-xs text-emerald-700/80">
            Ref: {confirmation.paymentId}
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <Button size="lg" onClick={reset}>
            <RotateCcw className="mr-2 h-5 w-5" />
            Log another
          </Button>
          <Button
            variant="outline"
            size="lg"
            onClick={undo}
            disabled={voiding || undoExpired}
            className={!undoExpired ? "text-red-700 hover:text-red-800" : ""}
          >
            {voiding ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            {undoExpired ? "Undo expired" : `Undo (${undoSecs}s)`}
          </Button>
          {undoExpired ? (
            <Button
              variant="ghost"
              size="lg"
              onClick={() => onJumpToHistory(confirmation.paymentId)}
            >
              Void from History
            </Button>
          ) : null}
        </div>
        {error ? (
          <p className="text-center text-xs text-red-700">{error}</p>
        ) : null}
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden rounded-2xl p-0 sm:rounded-2xl">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        className="flex flex-col gap-3.5 p-3 sm:gap-5 sm:p-6"
      >
        <AmountDisplay
          amount={amount}
          setAmount={setAmount}
          label="Cash received"
          ariaLabel="Cash received"
        />
        <AmountKeypad setAmount={setAmount} />
        <PayerRow
          members={members}
          payer={payer}
          setPayer={setPayer}
          hint="Tap Guest to attach a guest record (add a new one if needed). Tap Member for Lodgepay members. Receipts go automatically to whichever email we have on file."
        />
        <ExtrasSection
          category={category}
          setCategory={setCategory}
          reference={reference}
          setReference={setReference}
          description={description}
          setDescription={setDescription}
          note={note}
          setNote={setNote}
          showNote
        />
        {error ? (
          <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <TriangleAlert className="h-4 w-4 flex-none" />
            <span>{error}</span>
          </div>
        ) : null}
        {pendingHighValueConfirm ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <p className="font-medium">
              Confirm £{Number(amount).toFixed(2)} cash entry
            </p>
            <p className="mt-1 text-xs">
              Amounts of £200 or more ask for an extra tap to avoid typos.
              Tap “Log £{Number(amount).toFixed(2)} cash” again to confirm,
              or change the amount above.
            </p>
          </div>
        ) : null}
        <Button
          type="submit"
          size="xl"
          disabled={submitting || !amount || Number(amount) <= 0}
          className="w-full bg-emerald-700 text-base text-white hover:bg-emerald-800"
        >
          {submitting ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Logging…
            </>
          ) : (
            <>
              <Banknote className="mr-2 h-5 w-5" />
              {pendingHighValueConfirm
                ? `Confirm £${Number(amount || 0).toFixed(2)} cash`
                : amount
                  ? `Log £${Number(amount).toFixed(2)} cash`
                  : "Log cash payment"}
            </>
          )}
        </Button>
        <p
          className="hidden text-center text-xs text-muted-foreground sm:block"
          title="Cash payments are recorded on the lodge ledger immediately. You can undo within 5 minutes here, or void any time from the Recent tab."
        >
          Cash payments are recorded on the lodge ledger immediately. You can
          undo within 5 minutes here, or void any time from the Recent tab.
        </p>
        <p
          className="text-center text-[11px] text-muted-foreground sm:hidden"
          title="Recorded immediately on the ledger. 5-min undo here, or void any time from Recent."
        >
          Logged immediately · 5 min undo · void from Recent
        </p>
      </form>
    </Card>
  );
}
