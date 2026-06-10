// GET /api/give/kiosk/status/:paymentId
//
// Public status poll for the self-service giving kiosk. Polled every ~2s
// while the QR is on screen so the kiosk can flip to "Thank you" the moment
// the Mooov payment.succeeded webhook lands.
//
// Auth: none. Payment ids are unguessable (kio_<churchId>_<ts>_<rand>) and
// the response is intentionally minimal: phase + amount only, no payer PII.
// Only kiosk-minted attempts (kio_ prefix, intent kiosk_giving) resolve here
// so this can't be used to probe other payment channels.

import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import { createServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ paymentId: string }> },
) {
  const { paymentId } = await params;
  if (!paymentId || !paymentId.startsWith("kio_")) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Self-service giving is not configured." },
      { status: 503 },
    );
  }

  const supa = createServiceClient();

  const { data: attempt, error: attemptError } = await supa
    .schema("mooov")
    .from("payment_attempts")
    .select("payment_id, intent, status, amount, currency")
    .eq("payment_id", paymentId)
    .eq("intent", "kiosk_giving")
    .maybeSingle<{
      payment_id: string;
      intent: string;
      status: string;
      amount: number;
      currency: string;
    }>();
  if (attemptError) {
    console.error("kiosk status: attempt lookup failed", {
      payment_id: paymentId,
      message: attemptError.message,
    });
    return NextResponse.json(
      { error: "Could not look up payment status." },
      { status: 500 },
    );
  }
  if (!attempt) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  // The projected public.payments row is the canonical success signal once
  // the webhook has fired; fall back to the attempt status before then.
  const { data: projected } = await supa
    .from("payments")
    .select("status")
    .eq("mooov_payment_id", paymentId)
    .maybeSingle<{ status: string }>();

  const rawStatus = projected?.status ?? attempt.status;

  return NextResponse.json({
    payment_id: paymentId,
    phase: normalizePhase(rawStatus),
    amount_minor: attempt.amount,
    currency: attempt.currency,
  });
}

function normalizePhase(
  status: string,
): "pending" | "awaiting_payment" | "succeeded" | "failed" {
  switch (status) {
    case "succeeded":
    case "captured":
    case "completed":
      return "succeeded";
    case "failed":
    case "cancelled":
    case "canceled":
    case "expired":
      return "failed";
    case "authorized":
    case "processing":
      return "awaiting_payment";
    default:
      return "pending";
  }
}
