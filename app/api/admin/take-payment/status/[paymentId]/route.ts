// GET /api/admin/take-payment/status/:paymentId
//
// Polled every ~2 seconds by the iPad client while the QR is on screen, so
// the page can flip from "Waiting for scan…" to "Paid £45.00 ✓" the moment
// the Mooov payment.succeeded webhook lands.
//
// We poll the LP-side projection (public.payments) first because that's the
// canonical source of truth once the webhook has fired; we fall back to
// mooov.payment_attempts so a payment that hasn't been projected yet still
// shows the right amount + currency on the page.

import { NextRequest, NextResponse } from "next/server";
import { requireAdminApiAuth, requireAdminApiPermission } from "@/lib/auth/api";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import { getAdminReadContext } from "@/lib/admin/read-context";
import { createServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ paymentId: string }> },
) {
  const unauthorized = await requireAdminApiAuth();
  if (unauthorized) return unauthorized;

  const { paymentId } = await params;
  if (!paymentId) {
    return NextResponse.json({ error: "Missing payment id." }, { status: 400 });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "In-person payments are not configured." },
      { status: 503 },
    );
  }

  // Anchor to the admin's scoped lodge (same logic as the page) so an
  // unset ADMIN_LODGE_COOKIE doesn't silently swap us onto the platform
  // default lodge and 401 a polling tablet mid-payment.
  const ctx = await getAdminReadContext();
  if (ctx.mode !== "database" || !ctx.lodgeId) {
    return NextResponse.json({ error: "Lodge not selected." }, { status: 404 });
  }
  const lodgeId = ctx.lodgeId;

  const forbidden = await requireAdminApiPermission("payments:write", lodgeId);
  if (forbidden) return forbidden;

  const supa = createServiceClient();

  const { data: attempt, error: attemptError } = await supa
    .schema("mooov")
    .from("payment_attempts")
    .select("payment_id, status, amount, currency, failure_reason, lodge_id")
    .eq("payment_id", paymentId)
    .eq("lodge_id", lodgeId)
    .maybeSingle<{
      payment_id: string;
      status: string;
      amount: number;
      currency: string;
      failure_reason: string | null;
      lodge_id: string;
    }>();
  if (attemptError) {
    console.error("Take payment status GET: attempt lookup failed", {
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

  const { data: projected } = await supa
    .from("payments")
    .select(
      "id, status, total_amount, refund_amount, currency, completed_at, mooov_payment_id",
    )
    .eq("mooov_payment_id", paymentId)
    .maybeSingle<{
      id: string;
      status: string;
      total_amount: number;
      refund_amount: number | null;
      currency: string | null;
      completed_at: string | null;
      mooov_payment_id: string;
    }>();

  const projectedStatus = projected?.status ?? null;
  const rawStatus = projectedStatus ?? attempt.status;
  const phase = normalizePhase(rawStatus);

  return NextResponse.json({
    payment_id: paymentId,
    phase,
    raw_status: rawStatus,
    amount_minor: attempt.amount,
    currency: attempt.currency,
    failure_reason: attempt.failure_reason,
    projected: projected
      ? {
          id: projected.id,
          total: projected.total_amount,
          refunded_total: projected.refund_amount ?? 0,
          completed_at: projected.completed_at,
        }
      : null,
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
