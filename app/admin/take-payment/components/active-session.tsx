"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  CheckCircle2,
  Copy,
  HeartHandshake,
  Loader2,
  Maximize2,
  Minimize2,
  RotateCcw,
  ScanLine,
  Share2,
  TriangleAlert,
  User,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  formatElapsed,
  formatMoney,
  humanizeFailureReason,
} from "./helpers";
import type { StatusPhase, StatusResponse } from "./types";

// QR / awaiting-payment view for the Charge tab. Same behaviour as before
// the refactor: polls every 2s, wake-lock to keep the screen on, web-share +
// copy-link affordances, honest "waiting for payment" status (no fake "card
// entered" claim because Mooov doesn't emit that event).

export type ActiveSessionState = {
  paymentId: string;
  url: string;
  qrDataUrl: string;
  amountMinor: number;
  currency: string;
  reference: string;
  description: string;
  memberName: string | null;
  giftAidEligible: boolean;
};

export function ActiveSession({
  session,
  status,
  onStatusChange,
  onReset,
}: {
  session: ActiveSessionState;
  status: StatusResponse | null;
  onStatusChange: (s: StatusResponse | null) => void;
  onReset: () => void;
}) {
  const stopRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const phase: StatusPhase = status?.phase ?? "pending";
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [shareError, setShareError] = useState<string | null>(null);

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
        // Transient errors are swallowed; the next tick retries.
      }
      timer = setTimeout(poll, 2000);
    };

    void poll();
    return () => {
      stopRef.current = true;
      if (timer) clearTimeout(timer);
    };
  }, [session.paymentId, onStatusChange]);

  useEffect(() => {
    if (phase === "succeeded" || phase === "failed") return;
    const id = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, [phase]);

  useEffect(() => {
    if (phase === "succeeded" || phase === "failed") return;
    let sentinel: WakeLockSentinel | null = null;
    let cancelled = false;

    const acquire = async () => {
      try {
        const nav = navigator as Navigator & {
          wakeLock?: {
            request: (type: "screen") => Promise<WakeLockSentinel>;
          };
        };
        if (!nav.wakeLock) return;
        const lock = await nav.wakeLock.request("screen");
        if (cancelled) {
          await lock.release().catch(() => {});
          return;
        }
        sentinel = lock;
      } catch {
        // Permission denied or unsupported; ignore.
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible" && !sentinel) {
        void acquire();
      }
    };

    void acquire();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      sentinel?.release().catch(() => {});
      sentinel = null;
    };
  }, [phase]);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    const el = containerRef.current;
    if (!el) return;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await el.requestFullscreen();
      }
    } catch {
      // iOS Safari sometimes refuses; fall back gracefully.
    }
  }, []);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(session.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setShareError("Could not copy the link.");
    }
  }, [session.url]);

  const handleShare = useCallback(async () => {
    setShareError(null);
    const text =
      `Pay ${formatMoney(session.amountMinor, session.currency)} via secure ` +
      `card link${session.description ? ` (${session.description})` : ""}`;
    try {
      if (typeof navigator !== "undefined" && "share" in navigator) {
        await (navigator as Navigator & {
          share: (data: {
            title: string;
            text: string;
            url: string;
          }) => Promise<void>;
        }).share({
          title: "Payment link",
          text,
          url: session.url,
        });
        return;
      }
      const sms = `sms:?&body=${encodeURIComponent(`${text}\n${session.url}`)}`;
      window.location.href = sms;
    } catch {
      // User likely cancelled the share sheet; ignore.
    }
  }, [
    session.amountMinor,
    session.currency,
    session.description,
    session.url,
  ]);

  const amountLabel = useMemo(
    () => formatMoney(session.amountMinor, session.currency),
    [session.amountMinor, session.currency],
  );

  if (phase === "succeeded") {
    const completedAt = status?.projected?.completed_at;
    return (
      <Card className="space-y-4 border-emerald-200 bg-emerald-50/40 p-6 text-center sm:p-10">
        <CheckCircle2 className="mx-auto h-16 w-16 text-emerald-600 sm:h-20 sm:w-20" />
        <div>
          <h2 className="text-3xl font-semibold text-emerald-900 sm:text-4xl">
            Paid {amountLabel}
          </h2>
          {completedAt ? (
            <p className="mt-1 text-sm text-emerald-800">
              {new Date(completedAt).toLocaleString("en-GB")}
            </p>
          ) : (
            <p className="mt-1 text-sm text-emerald-800">
              Payment captured. Receipt sent by Mooov.
            </p>
          )}
          <p className="mt-2 text-xs text-emerald-700/80">
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
      <Card className="space-y-4 border-red-200 bg-red-50/40 p-6 text-center sm:p-10">
        <TriangleAlert className="mx-auto h-16 w-16 text-red-600 sm:h-20 sm:w-20" />
        <div>
          <h2 className="text-2xl font-semibold text-red-900 sm:text-3xl">
            Payment did not complete
          </h2>
          <p className="mt-1 text-sm text-red-800">
            {humanizeFailureReason(status?.failure_reason)}
          </p>
          <p className="mt-2 text-xs text-red-700/80">
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
    <Card
      ref={containerRef}
      className={cn(
        "space-y-5 p-4 sm:p-6",
        isFullscreen &&
          "fixed inset-0 z-50 m-0 h-[100dvh] max-h-none max-w-none rounded-none border-0 bg-white pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="text-center sm:text-left">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Show this QR to the payer
          </p>
          <h2 className="text-3xl font-semibold leading-tight sm:text-4xl">
            {amountLabel}
          </h2>
          {(session.reference || session.description) && (
            <p className="mt-1 text-xs text-muted-foreground">
              {session.description || session.reference}
            </p>
          )}
          {(session.memberName || session.giftAidEligible) && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {session.memberName ? (
                <Badge variant="outline" className="gap-1 border-slate-300">
                  <User className="h-3 w-3" />
                  {session.memberName}
                </Badge>
              ) : null}
              {session.giftAidEligible ? (
                <Badge variant="success" className="gap-1">
                  <HeartHandshake className="h-3 w-3" />
                  Gift Aid auto-logged
                </Badge>
              ) : null}
            </div>
          )}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={toggleFullscreen}
          aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
          className="shrink-0"
        >
          {isFullscreen ? (
            <Minimize2 className="h-5 w-5" />
          ) : (
            <Maximize2 className="h-5 w-5" />
          )}
        </Button>
      </div>

      <div
        className={cn(
          "mx-auto w-full",
          isFullscreen ? "max-w-2xl" : "max-w-sm sm:max-w-md",
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={session.qrDataUrl}
          alt={`Payment QR code for ${amountLabel}`}
          className="block aspect-square w-full h-auto rounded-2xl border-4 border-white bg-white shadow-md"
        />
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button
          type="button"
          variant="secondary"
          size="lg"
          onClick={handleShare}
          className="flex-1 sm:flex-initial"
        >
          <Share2 className="mr-2 h-4 w-4" />
          Share link
        </Button>
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={handleCopy}
          className="flex-1 sm:flex-initial"
        >
          <Copy className="mr-2 h-4 w-4" />
          {copied ? "Copied!" : "Copy link"}
        </Button>
      </div>

      {shareError ? (
        <p className="text-center text-xs text-red-700">{shareError}</p>
      ) : null}

      <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 text-sm">
        <div className="flex items-start gap-2">
          <ScanLine className="h-5 w-5 flex-none text-slate-500" />
          <div className="space-y-1">
            <p className="font-medium text-slate-800">How to pay</p>
            <ol className="list-decimal space-y-0.5 pl-5 text-slate-600">
              <li>Open the camera on a phone.</li>
              <li>Point it at this QR code.</li>
              <li>Tap the link to pay with card, Apple Pay, or Google Pay.</li>
            </ol>
          </div>
        </div>
      </div>

      <div className="flex flex-col items-center gap-1.5 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          Waiting for payment…
        </div>
        <p className="text-xs text-muted-foreground/80">
          Elapsed {formatElapsed(elapsed)}
          {" · "}
          Auto-checks every 2&nbsp;seconds
        </p>
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
