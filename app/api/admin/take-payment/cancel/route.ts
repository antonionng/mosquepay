// POST /api/admin/take-payment/cancel
//
// Two behaviours depending on the underlying attempt's intent:
//
//   * take_payment (card QR): the QR has not been paid yet. We mark the
//     mooov.payment_attempts row as 'cancelled' so it stops showing as
//     "open" in the recent QRs panel. The hosted_url remains technically
//     scannable until upstream Mooov expires it; if a payer scans + pays
//     anyway, the standard webhook still projects correctly. We only flip a
//     row that's still in a non-terminal state, so captured/failed attempts
//     are left alone.
//
//   * take_payment_cash: the attempt was recorded as captured immediately
//     and a public.payments row already exists. "Cancel" means VOID: we
//     refund the payments row (refund_amount=total_amount,
//     refund_reason='cash_voided_by_admin', status='refunded'),
//     mark the attempt 'refunded' (refunded_at=now()), and reverse any auto-
//     logged Gift Aid donation so it does not enter the next reclaim batch.
//
// Auth: admin with payments:write on the active church.

import { NextRequest, NextResponse } from "next/server";
import { requireAdminApiAuth, requireAdminApiPermission } from "@/lib/auth/api";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import * as db from "@/lib/db";
import { getAdminReadContext } from "@/lib/admin/read-context";
import { createServiceClient } from "@/lib/supabase/server";
import { getCurrentAdminContextAny } from "@/lib/auth/permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NON_TERMINAL_QR = new Set([
  "pending",
  "authorized",
  "processing",
]);

export async function POST(request: NextRequest) {
  const unauthorized = await requireAdminApiAuth();
  if (unauthorized) return unauthorized;

  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "In-person payments are not configured." },
      { status: 503 },
    );
  }

  let body: { payment_id?: string; reason?: string };
  try {
    body = (await request.json()) as { payment_id?: string; reason?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const paymentId = typeof body.payment_id === "string" ? body.payment_id : "";
  const userReason =
    typeof body.reason === "string" && body.reason.trim()
      ? body.reason.trim().slice(0, 280)
      : null;
  if (!paymentId) {
    return NextResponse.json(
      { error: "payment_id is required." },
      { status: 400 },
    );
  }

  const ctx = await getAdminReadContext();
  if (ctx.mode !== "database" || !ctx.churchId) {
    return NextResponse.json({ error: "Church not selected." }, { status: 404 });
  }
  const churchId = ctx.churchId;

  const forbidden = await requireAdminApiPermission("payments:write", churchId);
  if (forbidden) return forbidden;

  let adminEmail: string | null = null;
  try {
    const admin = await getCurrentAdminContextAny(churchId);
    adminEmail = admin?.email ?? null;
  } catch {
    // Best effort; the refund still proceeds, audit log just lacks an email.
  }

  const supa = createServiceClient();

  const { data: existing, error: lookupErr } = await supa
    .schema("mooov")
    .from("payment_attempts")
    .select("payment_id, status, intent, captured_at, refunded_at")
    .eq("payment_id", paymentId)
    .eq("church_id", churchId)
    .maybeSingle<{
      payment_id: string;
      status: string;
      intent: string;
      captured_at: string | null;
      refunded_at: string | null;
    }>();
  if (lookupErr) {
    console.error("Take payment cancel: lookup failed", {
      payment_id: paymentId,
      church_id: churchId,
      code: lookupErr.code,
      message: lookupErr.message,
    });
    return NextResponse.json(
      { error: "Could not look up payment." },
      { status: 500 },
    );
  }
  if (!existing) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  if (existing.intent === "take_payment") {
    // QR cancel path (unpaid only).
    if (existing.captured_at || !NON_TERMINAL_QR.has(existing.status)) {
      return NextResponse.json(
        { error: "Payment already finalised; nothing to cancel." },
        { status: 409 },
      );
    }
    const { error: updateErr } = await supa
      .schema("mooov")
      .from("payment_attempts")
      .update({
        status: "cancelled",
        failure_reason: "cancelled_by_admin",
      })
      .eq("payment_id", paymentId)
      .eq("church_id", churchId);
    if (updateErr) {
      console.error("Take payment cancel: QR update failed", {
        payment_id: paymentId,
        code: updateErr.code,
        message: updateErr.message,
      });
      return NextResponse.json(
        { error: "Could not cancel payment." },
        { status: 500 },
      );
    }
    return NextResponse.json({ ok: true, action: "cancelled" });
  }

  if (existing.intent === "take_payment_cash") {
    if (existing.status === "refunded" || existing.refunded_at) {
      return NextResponse.json(
        { error: "Cash payment already voided." },
        { status: 409 },
      );
    }

    // Flip the projected payments row to refunded so all the existing
    // treasurer ledgers / reports recognise the void without new code.
    const projected = await db.getPaymentByMooovId(paymentId);
    if (projected) {
      try {
        await db.updatePayment(projected.id, churchId, {
          status: "refunded",
          refund_amount: projected.total_amount,
          refund_reason: userReason
            ? `cash_voided_by_admin: ${userReason}`
            : "cash_voided_by_admin",
        });
      } catch (err) {
        console.error("Take payment cancel: payments refund failed", {
          payment_id: paymentId,
          ledger_id: projected.id,
          message: err instanceof Error ? err.message : String(err),
        });
        return NextResponse.json(
          { error: "Could not void the cash payment." },
          { status: 500 },
        );
      }

      // Reverse any auto-logged Gift Aid donation so the reclaim batch does
      // not pick it up. Best-effort; a manual donations cleanup is always
      // possible and the payments row is already refunded.
      try {
        const { data: relatedDonations } = await supa
          .from("donations")
          .select("id, status")
          .eq("payment_id", projected.id)
          .eq("church_id", churchId);
        for (const d of relatedDonations ?? []) {
          if (d.status === "completed") {
            await db.updateDonation(d.id as string, churchId, {
              status: "voided",
            });
          }
        }
      } catch (err) {
        console.error(
          "Take payment cancel: donations void best-effort failed",
          {
            payment_id: paymentId,
            message: err instanceof Error ? err.message : String(err),
          },
        );
      }
    }

    const { error: attemptErr } = await supa
      .schema("mooov")
      .from("payment_attempts")
      .update({
        status: "refunded",
        refunded_at: new Date().toISOString(),
        failure_reason: userReason
          ? `cash_voided_by_admin: ${userReason}`
          : "cash_voided_by_admin",
      })
      .eq("payment_id", paymentId)
      .eq("church_id", churchId);
    if (attemptErr) {
      console.error("Take payment cancel: cash attempt update failed", {
        payment_id: paymentId,
        code: attemptErr.code,
        message: attemptErr.message,
      });
      // Don't return 500 — the ledger is already refunded which is what the
      // user sees. Log loudly so we can clean up later.
    }

    console.log("Take payment cancel: cash voided", {
      payment_id: paymentId,
      church_id: churchId,
      admin: adminEmail,
    });
    return NextResponse.json({ ok: true, action: "voided" });
  }

  return NextResponse.json(
    { error: "Only in-person take-payment entries can be cancelled here." },
    { status: 400 },
  );
}
