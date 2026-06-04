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
import { MeetingLinkField } from "./meeting-link-field";
import { LineItemsSection } from "./line-items-section";
import { formatMoney, newClientToken } from "./helpers";
import type {
  CashResponse,
  CategoryId,
  EventOption,
  LineItemDraft,
  MemberOption,
  PayerSelection,
} from "./types";
import {
  buildPayerPayload,
  displayPayerName,
  isPayerSelected,
} from "./payer-payload";
import { GiftAidCaptureDialog } from "./gift-aid-capture-dialog";
import {
  buildLineItemsPayload,
  lineItemsTotalMajor,
  selectionIsGiftAidable,
  validLineItems,
} from "./types";

// Cash tab — treasurer-recorded cash entry.
//
// Same backbone as the Charge tab (keypad + payer row + extras) but the
// bottom CTA records the entry directly (no Mooov call, no QR). After the
// POST succeeds we show an in-place confirmation with a 5-minute Undo
// button. After 5 minutes the form resets cleanly; the admin can still
// void from the History tab indefinitely.

const VOID_WINDOW_MS = 5 * 60 * 1000;

type ConfirmationState = {
  /** Mooov payment_id; used as the human-facing ref on the success card. */
  paymentId: string;
  /** LP-side public.payments.id; required by /gift-aid-attach which looks
   *  up via getPaymentById. Distinct from the mooov id. */
  ledgerPaymentId: string;
  amountMinor: number;
  currency: string;
  payerName: string | null;
  payerEmail: string | null;
  payerKind: PayerSelection["kind"];
  memberId: string | null;
  giftAidEligible: boolean;
  loggedAt: number;
  category: CategoryId;
  lineItems?: ReadonlyArray<{ category: CategoryId; amount: number }>;
};

export function CashTab({
  members,
  events,
  amount,
  setAmount,
  category,
  setCategory,
  reference,
  setReference,
  description,
  setDescription,
  eventId,
  setEventId,
  eventAutoSelected,
  payer,
  setPayer,
  lineItems,
  setLineItems,
  onLogged,
  onJumpToHistory,
}: {
  members: MemberOption[];
  events: EventOption[];
  amount: string;
  setAmount: React.Dispatch<React.SetStateAction<string>>;
  category: CategoryId;
  setCategory: (v: CategoryId) => void;
  reference: string;
  setReference: (v: string) => void;
  description: string;
  setDescription: (v: string) => void;
  eventId: string | null;
  setEventId: (v: string | null) => void;
  eventAutoSelected?: boolean;
  payer: PayerSelection;
  setPayer: (v: PayerSelection) => void;
  lineItems: LineItemDraft[];
  setLineItems: React.Dispatch<React.SetStateAction<LineItemDraft[]>>;
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
  const [giftAidCaptureOpen, setGiftAidCaptureOpen] = useState(false);
  const [giftAidCaptured, setGiftAidCaptured] = useState(false);

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

  const itemised = lineItems.length > 0;
  const itemsTotal = lineItemsTotalMajor(lineItems);

  const reset = useCallback(() => {
    setAmount("");
    setReference("");
    setDescription("");
    setNote("");
    setError(null);
    setConfirmation(null);
    setPendingHighValueConfirm(false);
    setGiftAidCaptured(false);
    setGiftAidCaptureOpen(false);
    setLineItems([]);
    clientTokenRef.current = newClientToken();
    // Keep category sticky — treasurers logging a row of cash payments
    // usually want the same category (e.g. raffle, dining) without
    // re-selecting each time.
  }, [setAmount, setReference, setDescription, setLineItems]);

  const submit = useCallback(async () => {
    setError(null);
    const lineItemsPayload = itemised ? buildLineItemsPayload(lineItems) : null;
    if (itemised && (!lineItemsPayload || lineItemsPayload.length === 0)) {
      setError("Add an amount to at least one line item.");
      return;
    }
    const numericAmount = itemised ? itemsTotal : Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setError(
        itemised
          ? "Add an amount to at least one line item."
          : "Enter an amount in pounds (e.g. 45 or 12.50).",
      );
      return;
    }
    if (numericAmount > 5000) {
      setError(
        "Amounts above £5,000 cannot be recorded on the in-person flow.",
      );
      return;
    }
    if (!isPayerSelected(payer)) {
      setError("Select a member or guest before logging the payment.");
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
          event_id: eventId,
          line_items: lineItemsPayload ?? undefined,
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
        ledgerPaymentId: body.ledger_payment_id,
        amountMinor: body.amount,
        currency: body.currency,
        payerName: body.payer_name ?? body.member_name ?? displayPayerName(payer),
        payerEmail: body.payer_email ?? null,
        payerKind: payer.kind,
        memberId:
          payer.kind === "member" ? payer.member.id ?? null : null,
        giftAidEligible: body.gift_aid_eligible,
        loggedAt: Date.now(),
        category,
        lineItems: lineItemsPayload ?? undefined,
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
    eventId,
    payer,
    note,
    itemised,
    itemsTotal,
    lineItems,
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
            {confirmation.lineItems && confirmation.lineItems.length > 0
              ? ` · ${confirmation.lineItems.length} items`
              : confirmation.category !== "general"
                ? ` · ${confirmation.category}`
                : ""}
          </p>
          {confirmation.lineItems && confirmation.lineItems.length > 0 ? (
            <ul className="mx-auto max-w-xs space-y-0.5 text-xs text-emerald-800">
              {confirmation.lineItems.map((li, i) => (
                <li key={i} className="flex items-center justify-between gap-3">
                  <span className="capitalize">
                    {li.category.replace(/_/g, " ")}
                  </span>
                  <span className="tabular-nums">£{li.amount.toFixed(2)}</span>
                </li>
              ))}
            </ul>
          ) : null}
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
            {confirmation.giftAidEligible || giftAidCaptured ? (
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

        {selectionIsGiftAidable(confirmation.category, confirmation.lineItems) &&
        confirmation.payerKind !== "anonymous" &&
        !confirmation.giftAidEligible &&
        !giftAidCaptured ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-left text-sm text-amber-900">
            <p className="font-medium">No Gift Aid declaration on file</p>
            <p className="mt-1 text-xs text-amber-800">
              If the donor is a UK taxpayer, capture the paper slip now and
              we&apos;ll add a 25 percent reclaim to this £
              {(confirmation.amountMinor / 100).toFixed(2)}.
            </p>
            <Button
              size="sm"
              variant="primary"
              className="mt-2"
              onClick={() => setGiftAidCaptureOpen(true)}
            >
              <HeartHandshake className="mr-2 h-4 w-4" />
              Add Gift Aid declaration
            </Button>
          </div>
        ) : null}
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
        <GiftAidCaptureDialog
          open={giftAidCaptureOpen}
          onOpenChange={setGiftAidCaptureOpen}
          paymentId={confirmation.ledgerPaymentId}
          payer={{
            kind: confirmation.payerKind === "anonymous" ? "anonymous" : confirmation.payerKind === "member" ? "member" : "guest",
            memberId: confirmation.memberId,
            payerName: confirmation.payerName,
            payerEmail: confirmation.payerEmail,
          }}
          onCaptured={() => {
            setGiftAidCaptured(true);
            onLogged();
          }}
        />
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
          amount={itemised ? String(itemsTotal) : amount}
          setAmount={setAmount}
          label="Cash received"
          ariaLabel="Cash received"
          readOnly={itemised}
        />
        {itemised ? null : <AmountKeypad setAmount={setAmount} />}
        <LineItemsSection
          items={lineItems}
          setItems={setLineItems}
          seedAmount={amount}
          seedCategory={category}
        />
        <PayerRow
          members={members}
          payer={payer}
          setPayer={setPayer}
          hint="Tap Guest to attach a guest record (add a new one if needed). Tap Member for Lodgepay members. Receipts go automatically to whichever email we have on file."
        />
        <MeetingLinkField
          events={events}
          eventId={eventId}
          setEventId={setEventId}
          autoSelected={eventAutoSelected}
        />
        <ExtrasSection
          category={category}
          setCategory={setCategory}
          reference={reference}
          setReference={setReference}
          description={description}
          setDescription={setDescription}
          events={events}
          eventId={eventId}
          setEventId={setEventId}
          note={note}
          setNote={setNote}
          showNote
          hideCategory={itemised}
          hideEvent
          defaultOpen={!itemised && category !== "general"}
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
              Confirm £{(itemised ? itemsTotal : Number(amount)).toFixed(2)} cash
              entry
            </p>
            <p className="mt-1 text-xs">
              Amounts of £200 or more ask for an extra tap to avoid typos.
              Tap “Log £{(itemised ? itemsTotal : Number(amount)).toFixed(2)}
              cash” again to confirm, or change the amount above.
            </p>
          </div>
        ) : null}
        <Button
          type="submit"
          size="xl"
          disabled={
            submitting ||
            (itemised ? itemsTotal <= 0 : !amount || Number(amount) <= 0) ||
            (itemised && validLineItems(lineItems).length === 0) ||
            !isPayerSelected(payer)
          }
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
              {(() => {
                const shown = itemised ? itemsTotal : Number(amount || 0);
                if (pendingHighValueConfirm)
                  return `Confirm £${shown.toFixed(2)} cash`;
                if (itemised || amount)
                  return `Log £${shown.toFixed(2)} cash`;
                return "Log cash payment";
              })()}
            </>
          )}
        </Button>
        {!isPayerSelected(payer) ? (
          <p className="text-center text-xs text-amber-700">
            Select a member or guest above to record who this payment is for.
          </p>
        ) : null}
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
