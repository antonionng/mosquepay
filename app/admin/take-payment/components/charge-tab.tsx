"use client";

import { useCallback, useState } from "react";
import QRCode from "qrcode";
import { Banknote, Loader2, TriangleAlert } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AmountDisplay } from "./amount-display";
import { AmountKeypad } from "./amount-keypad";
import { PayerRow } from "./payer-row";
import { ExtrasSection } from "./extras-section";
import { ActiveSession, type ActiveSessionState } from "./active-session";
import type {
  CategoryId,
  MemberOption,
  MintResponse,
  PayerSelection,
  StatusResponse,
} from "./types";
import { buildPayerPayload, displayPayerName } from "./payer-payload";

// Charge tab — live card/QR mint flow. The parent owns the active session
// so "Show QR" from the History tab can drop a re-opened QR into this view
// without prop-drilling a setter.

export async function generateQrForUrl(url: string) {
  return QRCode.toDataURL(url, {
    width: 720,
    margin: 1,
    color: { dark: "#0f172a", light: "#ffffff" },
  });
}

export function ChargeTab({
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
  session,
  setSession,
  status,
  setStatus,
  onRequireConnected,
  onSessionMinted,
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
  session: ActiveSessionState | null;
  setSession: (s: ActiveSessionState | null) => void;
  status: StatusResponse | null;
  setStatus: (s: StatusResponse | null) => void;
  onRequireConnected?: () => void;
  // Fired after a successful mint so the parent can kick a history reload.
  onSessionMinted?: () => void;
}) {
  const [minting, setMinting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetSession = useCallback(() => {
    setSession(null);
    setStatus(null);
    setError(null);
  }, [setSession, setStatus]);

  const handleSubmit = useCallback(
    async (e?: React.FormEvent<HTMLFormElement>) => {
      e?.preventDefault();
      setError(null);
      const numericAmount = Number(amount);
      if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
        setError("Enter an amount in pounds (e.g. 45 or 12.50).");
        return;
      }
      if (numericAmount > 5000) {
        setError("Amounts above £5,000 cannot be taken on the in-person flow.");
        return;
      }
      setMinting(true);
      try {
        const res = await fetch("/api/admin/take-payment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amount: numericAmount,
            category,
            reference,
            description,
            ...buildPayerPayload(payer),
          }),
        });
        const body = (await res.json()) as MintResponse;
        if (!res.ok || "error" in body) {
          const message =
            "error" in body ? body.error : "Could not mint payment.";
          setError(message);
          setMinting(false);
          if ("code" in body && body.code === "lodge_not_connected") {
            onRequireConnected?.();
          }
          return;
        }
        const qrDataUrl = await generateQrForUrl(body.url);
        setSession({
          paymentId: body.payment_id,
          url: body.url,
          qrDataUrl,
          amountMinor: body.amount,
          currency: body.currency,
          reference,
          description,
          memberName: displayPayerName(payer),
          giftAidEligible: false,
        });
        onSessionMinted?.();
      } catch (err) {
        console.error("take-payment mint failed", err);
        setError("Network error. Try again.");
      } finally {
        setMinting(false);
      }
    },
    [
      amount,
      category,
      reference,
      description,
      payer,
      onRequireConnected,
      onSessionMinted,
      setSession,
    ],
  );

  if (session) {
    return (
      <ActiveSession
        session={session}
        status={status}
        onStatusChange={setStatus}
        onReset={resetSession}
      />
    );
  }

  return (
    <Card className="overflow-hidden rounded-2xl p-0 sm:rounded-2xl">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3.5 p-3 sm:gap-5 sm:p-6">
        <AmountDisplay
          amount={amount}
          setAmount={setAmount}
          label="Amount to charge"
          ariaLabel="Amount to charge"
        />
        <AmountKeypad setAmount={setAmount} />
        <PayerRow
          members={members}
          payer={payer}
          setPayer={setPayer}
          hint="Tap Guest to attach a guest record (or add a new one). Tap Member to attribute to a Lodgepay member and auto-attach Gift Aid."
        />
        <ExtrasSection
          category={category}
          setCategory={setCategory}
          reference={reference}
          setReference={setReference}
          description={description}
          setDescription={setDescription}
        />
        {error ? (
          <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <TriangleAlert className="h-4 w-4 flex-none" />
            <span>{error}</span>
          </div>
        ) : null}
        <Button
          type="submit"
          size="xl"
          disabled={minting || !amount || Number(amount) <= 0}
          className="w-full text-base"
        >
          {minting ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Generating QR…
            </>
          ) : (
            <>
              <Banknote className="mr-2 h-5 w-5" />
              Generate QR code
            </>
          )}
        </Button>
        {/* Phone gets a one-liner tooltip-style hint; tablet+ keeps the full
            explainer because there's space and we want the duty officer to
            know the expiry rule before they hand the QR over. */}
        <p
          className="hidden text-center text-xs text-muted-foreground sm:block"
          title="The QR is single-use and tied to the amount you typed above. If the payer doesn't scan within 24 hours it expires automatically."
        >
          The QR is single-use and tied to the amount you typed above. If the
          payer doesn&apos;t scan within 24 hours it expires automatically.
        </p>
        <p
          className="text-center text-[11px] text-muted-foreground sm:hidden"
          title="Single-use QR, tied to this amount, expires in 24h."
        >
          Single-use QR · expires in 24h
        </p>
      </form>
    </Card>
  );
}
