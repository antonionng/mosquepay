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

  // Anchor to the admin's scoped mosque (same logic as the page) so an
  // unset ADMIN_MOSQUE_COOKIE doesn't silently swap us onto the platform
  // default mosque and 401 a polling tablet mid-payment.
  const ctx = await getAdminReadContext();
  if (ctx.mode !== "database" || !ctx.mosqueId) {
    return NextResponse.json({ error: "Mosque not selected." }, { status: 404 });
  }
  const mosqueId = ctx.mosqueId;

  const forbidden = await requireAdminApiPermission("payments:write", mosqueId);
  if (forbidden) return forbidden;

  const supa = createServiceClient();

  const { data: attempt, error: attemptError } = await supa
    .schema("mooov")
    .from("payment_attempts")
    .select("payment_id, status, amount, currency, failure_reason, mosque_id")
    .eq("payment_id", paymentId)
    .eq("mosque_id", mosqueId)
    .maybeSingle<{
      payment_id: string;
      status: string;
      amount: number;
      currency: string;
      failure_reason: string | null;
      mosque_id: string;
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
      "id, status, total_amount, refund_amount, currency, completed_at, mooov_payment_id, charity_amount, category, user_name, user_email, user_id",
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
      charity_amount: number | null;
      category: string | null;
      user_name: string | null;
      user_email: string | null;
      user_id: string | null;
    }>();

  // Lift gift-aid status from the projected donation row so the polling UI
  // can decide whether to nudge the treasurer to capture a paper slip.
  // Most payments won't have a donation row (non-charity income); we treat
  // "no donation row" as "no Gift Aid on file" which is the worst-case
  // we want to surface anyway.
  let giftAidEligible = false;
  let giftAidDeclarationId: string | null = null;
  if (projected?.id) {
    const { data: donation } = await supa
      .from("donations")
      .select("id, gift_aid_declaration_id")
      .eq("payment_id", projected.id)
      .eq("mosque_id", mosqueId)
      .maybeSingle<{
        id: string;
        gift_aid_declaration_id: string | null;
      }>();
    if (donation?.gift_aid_declaration_id) {
      giftAidEligible = true;
      giftAidDeclarationId = donation.gift_aid_declaration_id;
    }
  }

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
          charity_amount: projected.charity_amount ?? 0,
          category: projected.category,
          user_name: projected.user_name,
          user_email: projected.user_email,
          user_id: projected.user_id,
        }
      : null,
    gift_aid_eligible: giftAidEligible,
    gift_aid_declaration_id: giftAidDeclarationId,
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
