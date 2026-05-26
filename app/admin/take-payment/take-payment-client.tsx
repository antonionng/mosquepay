"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import {
  Banknote,
  CheckCircle2,
  Loader2,
  RotateCcw,
  ScanLine,
  ShieldAlert,
  TriangleAlert,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Props = {
  lodgeSlug: string;
  connected: boolean;
  mooovStatus: string | null;
};

type StatusPhase = "pending" | "awaiting_payment" | "succeeded" | "failed";

type StatusResponse = {
  payment_id: string;
  phase: StatusPhase;
  raw_status: string;
  amount_minor: number;
  currency: string;
  failure_reason: string | null;
  projected: {
    id: string;
    total: number;
    refunded_total: number;
    completed_at: string | null;
  } | null;
};

type MintResponse =
  | {
      url: string;
      payment_id: string;
      amount: number;
      currency: string;
    }
  | { error: string; code?: string };

const CATEGORIES = [
  { id: "general", label: "General lodge payment" },
  { id: "charity", label: "Charity collection" },
  { id: "raffle", label: "Raffle" },
  { id: "dining", label: "Dining / festive board" },
  { id: "subscriptions", label: "Subscriptions / dues top-up" },
  { id: "other", label: "Other" },
] as const;

const PRESET_AMOUNTS = [5, 10, 20, 50] as const;

export function TakePaymentClient({ lodgeSlug, connected, mooovStatus }: Props) {
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]["id"]>(
    "general",
  );
  const [reference, setReference] = useState("");
  const [description, setDescription] = useState("");
  const [minting, setMinting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<{
    paymentId: string;
    url: string;
    qrDataUrl: string;
    amountMinor: number;
    currency: string;
  } | null>(null);
  const [status, setStatus] = useState<StatusResponse | null>(null);

  const reset = useCallback(() => {
    setAmount("");
    setReference("");
    setDescription("");
    setCategory("general");
    setSession(null);
    setStatus(null);
    setError(null);
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
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
          }),
        });
        const body = (await res.json()) as MintResponse;
        if (!res.ok || "error" in body) {
          const message = "error" in body ? body.error : "Could not mint payment.";
          setError(message);
          setMinting(false);
          return;
        }
        const qrDataUrl = await QRCode.toDataURL(body.url, {
          width: 720,
          margin: 1,
          color: { dark: "#0f172a", light: "#ffffff" },
        });
        setSession({
          paymentId: body.payment_id,
          url: body.url,
          qrDataUrl,
          amountMinor: body.amount,
          currency: body.currency,
        });
      } catch (err) {
        console.error("take-payment mint failed", err);
        setError("Network error. Try again.");
      } finally {
        setMinting(false);
      }
    },
    [amount, category, reference, description],
  );

  return (
    <div className="space-y-6">
      <div className="admin-page-head">
        <div>
          <h1 className="admin-page-title">Take payment</h1>
          <p className="admin-page-copy">
            Type the amount, show the QR code on the iPad. The payer scans
            with their phone camera and pays via card, Apple Pay, or Google
            Pay on Mooov&apos;s branded page. No reader, no app install.
          </p>
        </div>
        {session ? (
          <Button variant="outline" size="sm" onClick={reset}>
            <RotateCcw className="mr-2 h-4 w-4" />
            New payment
          </Button>
        ) : null}
      </div>

      {!connected ? (
        <Card className="border-amber-200 bg-amber-50/60 p-6 text-amber-900">
          <div className="flex items-start gap-3">
            <ShieldAlert className="h-5 w-5 flex-none" />
            <div className="space-y-2">
              <p className="font-medium">
                This lodge has not connected its payment processor yet.
              </p>
              <p className="text-sm">
                {mooovStatus === "needs_repair"
                  ? "Your Mooov connection needs repairing before you can take new payments. Visit Integrations to reconnect."
                  : "Connect Mooov from the Integrations page before taking in-person payments."}
              </p>
              <Button asChild size="sm">
                <Link href="/admin/integrations">Open Integrations</Link>
              </Button>
            </div>
          </div>
        </Card>
      ) : session ? (
        <ActiveSession
          session={session}
          lodgeSlug={lodgeSlug}
          onStatusChange={setStatus}
          status={status}
          onReset={reset}
        />
      ) : (
        <Card className="p-6">
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="amount">Amount (£)</Label>
              <Input
                id="amount"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0.01"
                max="5000"
                placeholder="45.00"
                value={amount}
                autoFocus
                onChange={(e) => setAmount(e.target.value)}
                required
                className="text-3xl font-semibold h-16 px-4"
              />
              <div className="flex flex-wrap gap-2 pt-2">
                {PRESET_AMOUNTS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    className="rounded-full border px-3 py-1 text-sm hover:bg-muted"
                    onClick={() => setAmount(String(preset))}
                  >
                    £{preset}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select
                  value={category}
                  onValueChange={(v) =>
                    setCategory(v as (typeof CATEGORIES)[number]["id"])
                  }
                >
                  <SelectTrigger id="category">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="reference">Reference (optional)</Label>
                <Input
                  id="reference"
                  type="text"
                  placeholder="Bro. Smith — raffle prize"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  maxLength={120}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">
                Description on receipt (optional)
              </Label>
              <Input
                id="description"
                type="text"
                placeholder="Festive Board top-up — 5 June"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={140}
              />
            </div>

            {error ? (
              <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                <TriangleAlert className="h-4 w-4 flex-none" />
                <span>{error}</span>
              </div>
            ) : null}

            <Button
              type="submit"
              size="lg"
              disabled={minting}
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
            <p className="text-xs text-muted-foreground">
              The QR is single-use and tied to the amount you typed above. If
              the payer doesn&apos;t scan within 24 hours it expires
              automatically.
            </p>
          </form>
        </Card>
      )}
    </div>
  );
}

type ActiveSessionProps = {
  session: {
    paymentId: string;
    url: string;
    qrDataUrl: string;
    amountMinor: number;
    currency: string;
  };
  lodgeSlug: string;
  status: StatusResponse | null;
  onStatusChange: (s: StatusResponse | null) => void;
  onReset: () => void;
};

function ActiveSession({
  session,
  status,
  onStatusChange,
  onReset,
}: ActiveSessionProps) {
  const stopRef = useRef(false);
  const phase: StatusPhase = status?.phase ?? "pending";

  useEffect(() => {
    stopRef.current = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const poll = async () => {
      if (stopRef.current) return;
      try {
        const res = await fetch(
          `/api/admin/take-payment/status/${encodeURIComponent(session.paymentId)}`,
          { cache: "no-store" },
        );
        if (res.ok) {
          const body = (await res.json()) as StatusResponse;
          onStatusChange(body);
          if (body.phase === "succeeded" || body.phase === "failed") {
            return;
          }
        }
      } catch {
        // Swallow transient errors; next tick will retry.
      }
      timer = setTimeout(poll, 2000);
    };

    void poll();
    return () => {
      stopRef.current = true;
      if (timer) clearTimeout(timer);
    };
  }, [session.paymentId, onStatusChange]);

  const amountLabel = useMemo(
    () => formatMoney(session.amountMinor, session.currency),
    [session.amountMinor, session.currency],
  );

  if (phase === "succeeded") {
    const completedAt = status?.projected?.completed_at;
    return (
      <Card className="p-8 text-center space-y-4 border-emerald-200 bg-emerald-50/40">
        <CheckCircle2 className="mx-auto h-16 w-16 text-emerald-600" />
        <div>
          <h2 className="text-2xl font-semibold text-emerald-900">
            Paid {amountLabel}
          </h2>
          {completedAt ? (
            <p className="text-sm text-emerald-800">
              {new Date(completedAt).toLocaleString("en-GB")}
            </p>
          ) : (
            <p className="text-sm text-emerald-800">
              Payment captured. Receipt sent by Mooov.
            </p>
          )}
          <p className="mt-1 text-xs text-emerald-700">
            Ref: {session.paymentId}
          </p>
        </div>
        <div className="flex justify-center gap-2">
          <Button onClick={onReset} size="lg">
            <RotateCcw className="mr-2 h-5 w-5" />
            Take another payment
          </Button>
        </div>
      </Card>
    );
  }

  if (phase === "failed") {
    return (
      <Card className="p-8 text-center space-y-4 border-red-200 bg-red-50/40">
        <TriangleAlert className="mx-auto h-16 w-16 text-red-600" />
        <div>
          <h2 className="text-2xl font-semibold text-red-900">
            Payment did not complete
          </h2>
          <p className="text-sm text-red-800">
            {status?.failure_reason ?? "The payer cancelled or the card was declined."}
          </p>
          <p className="mt-1 text-xs text-red-700">
            Ref: {session.paymentId}
          </p>
        </div>
        <Button onClick={onReset} size="lg">
          <RotateCcw className="mr-2 h-5 w-5" />
          Start over
        </Button>
      </Card>
    );
  }

  return (
    <Card className="p-6 space-y-6">
      <div className="text-center space-y-1">
        <p className="text-sm uppercase tracking-wide text-muted-foreground">
          Show this QR to the payer
        </p>
        <h2 className="text-3xl font-semibold">{amountLabel}</h2>
      </div>

      <div className="mx-auto max-w-md">
        {/* Plain img avoids next/image sizing overhead; QR is a data URL. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={session.qrDataUrl}
          alt={`Payment QR code for ${amountLabel}`}
          className="block w-full h-auto rounded-md border bg-white p-2"
        />
      </div>

      <div className="rounded-md border bg-muted/40 p-4 text-sm">
        <div className="flex items-start gap-2">
          <ScanLine className="h-5 w-5 flex-none text-muted-foreground" />
          <div className="space-y-1">
            <p className="font-medium">How to pay</p>
            <ol className="list-decimal space-y-0.5 pl-5 text-muted-foreground">
              <li>Open the camera app on your phone.</li>
              <li>Point it at this QR code.</li>
              <li>Tap the link to pay with card, Apple Pay, or Google Pay.</li>
            </ol>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
        {phase === "awaiting_payment" ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Card entered — waiting for confirmation…
          </>
        ) : (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Waiting for scan…
          </>
        )}
      </div>

      <details className="text-xs text-muted-foreground">
        <summary className="cursor-pointer">Open link manually</summary>
        <p className="mt-2 break-all rounded border bg-background p-2 font-mono">
          {session.url}
        </p>
      </details>

      <div className="flex justify-center gap-2">
        <Button variant="outline" onClick={onReset}>
          Cancel and start over
        </Button>
      </div>
    </Card>
  );
}

function formatMoney(minor: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: currency || "GBP",
      minimumFractionDigits: 2,
    }).format(minor / 100);
  } catch {
    return `£${(minor / 100).toFixed(2)}`;
  }
}
