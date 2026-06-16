// /giving/schedules/[id]/resume
//
// SCA resume page. Member-facing landing page when a saved-charge cycle
// returns status=requires_action (Mooov 2026-05-28 reply, Q-B/Q-E).
//
// Flow:
//   1. Fetch /api/giving/schedules/[id]/sca → publishable_key,
//      connected_account_id, client_secret.
//   2. loadStripe(publishable_key, { stripeAccount: connected_account_id }).
//   3. stripe.handleNextAction({ clientSecret }) opens the issuer's
//      3DS challenge sheet.
//   4. Per Mooov's 2026-05-28 reply Q-E: do NOT poll. Show
//      "verification submitted, you'll get an email shortly". The
//      payment_intent.succeeded webhook is the source of truth and
//      flips the schedule back to active.
//
// loadStripe is called per-session (no cache across visits) because
// Mooov rotates publishable_key on rare ops events; the response is the
// canonical value for the current session.

"use client";

import { useEffect, useState, use } from "react";
import { Button } from "@/components/ui/button";

type ScaPayload = {
  schedule_id: string;
  member_email: string;
  publishable_key: string;
  connected_account_id: string;
  client_secret: string;
  expires_at: string | null;
};

type ScaError = {
  error: string;
  code?: string;
  status?: string;
};

export default function ScaResumePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [phase, setPhase] = useState<
    "loading" | "ready" | "challenging" | "submitted" | "error"
  >("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [payload, setPayload] = useState<ScaPayload | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/giving/schedules/${id}/sca`, {
          method: "GET",
          credentials: "include",
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as ScaError;
          if (!cancelled) {
            setErrorMessage(
              body.error ?? "Could not load verification details."
            );
            setPhase("error");
          }
          return;
        }
        const data = (await res.json()) as ScaPayload;
        if (!cancelled) {
          setPayload(data);
          setPhase("ready");
        }
      } catch (err) {
        if (!cancelled) {
          setErrorMessage(
            err instanceof Error
              ? err.message
              : "Could not load verification details."
          );
          setPhase("error");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function startChallenge() {
    if (!payload) return;
    setPhase("challenging");
    setErrorMessage(null);
    try {
      const { loadStripe } = await import("@stripe/stripe-js");
      const stripe = await loadStripe(payload.publishable_key, {
        stripeAccount: payload.connected_account_id,
      });
      if (!stripe) {
        setErrorMessage(
          "Could not load Stripe. Please refresh and try again."
        );
        setPhase("error");
        return;
      }
      const result = await stripe.handleNextAction({
        clientSecret: payload.client_secret,
      });
      if (result.error) {
        setErrorMessage(
          result.error.message ??
            "Verification could not be completed. Please try again."
        );
        setPhase("error");
        return;
      }
      setPhase("submitted");
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : "Verification could not be started."
      );
      setPhase("error");
    }
  }

  return (
    <main className="mx-auto max-w-xl px-4 py-12">
      <h1 className="mb-2 text-2xl font-semibold">Verify your card</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Your bank has asked us to verify this month&apos;s giving charge before
        it goes through. This usually takes about a minute.
      </p>

      {phase === "loading" && (
        <p className="text-sm text-muted-foreground">Loading…</p>
      )}

      {phase === "ready" && payload && (
        <div className="space-y-4">
          <div className="rounded-md border p-4 text-sm">
            <div className="text-muted-foreground">Account</div>
            <div className="font-medium">{payload.member_email}</div>
          </div>
          <Button onClick={startChallenge} className="w-full">
            Start verification
          </Button>
          <p className="text-xs text-muted-foreground">
            You may be asked to approve the payment in your banking app or
            enter a one-time code from a text message.
          </p>
        </div>
      )}

      {phase === "challenging" && (
        <p className="text-sm text-muted-foreground">
          Opening verification with your bank…
        </p>
      )}

      {phase === "submitted" && (
        <div className="space-y-3 rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm">
          <p className="font-medium text-emerald-900">Verification submitted</p>
          <p className="text-emerald-800">
            We&apos;re processing the payment with your bank. You&apos;ll get
            an email confirmation shortly. You can safely close this page.
          </p>
        </div>
      )}

      {phase === "error" && (
        <div className="space-y-3 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm">
          <p className="font-medium text-amber-900">
            We couldn&apos;t complete verification
          </p>
          <p className="text-amber-800">
            {errorMessage ??
              "Please try again, or contact your mosque secretary if the problem persists."}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setPhase("loading");
              setErrorMessage(null);
              fetch(`/api/giving/schedules/${id}/sca`, {
                method: "GET",
                credentials: "include",
              })
                .then((r) => r.json().then((b) => ({ ok: r.ok, body: b })))
                .then(({ ok, body }) => {
                  if (ok) {
                    setPayload(body as ScaPayload);
                    setPhase("ready");
                  } else {
                    setErrorMessage(
                      (body as ScaError).error ??
                        "Could not reload verification details."
                    );
                    setPhase("error");
                  }
                })
                .catch((err: unknown) => {
                  setErrorMessage(
                    err instanceof Error ? err.message : String(err)
                  );
                  setPhase("error");
                });
            }}
          >
            Try again
          </Button>
        </div>
      )}
    </main>
  );
}
