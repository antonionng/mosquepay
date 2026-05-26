// POST /api/admin/take-payment/cancel
//
// Marks an in-person take-payment QR as cancelled so it stops showing up as
// "open" in the recent QRs panel. The QR's hosted_url remains technically
// scannable on Mooov's side until the upstream session expires; the
// cancellation here is purely an LP-side hygiene action (treasurer made a
// typo, generated the wrong amount, etc.). If the payer happens to scan and
// pay anyway, the standard mooov-webhook handler will still project the
// payment correctly — we only flip a row that's still in a non-terminal
// state, so a captured/failed attempt is left alone.

import { NextRequest, NextResponse } from "next/server";
import { requireAdminApiAuth, requireAdminApiPermission } from "@/lib/auth/api";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import * as db from "@/lib/db";
import { getLodgeSlugFromRequest } from "@/lib/tenant";
import { createServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NON_TERMINAL = new Set([
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

  let body: { payment_id?: string };
  try {
    body = (await request.json()) as { payment_id?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const paymentId = typeof body.payment_id === "string" ? body.payment_id : "";
  if (!paymentId) {
    return NextResponse.json(
      { error: "payment_id is required." },
      { status: 400 },
    );
  }

  const lodgeSlug = getLodgeSlugFromRequest(request);
  const lodgeId = await db.resolveLodgeId(lodgeSlug);
  if (!lodgeId) {
    return NextResponse.json({ error: "Lodge not found." }, { status: 404 });
  }

  const forbidden = await requireAdminApiPermission("payments:write", lodgeId);
  if (forbidden) return forbidden;

  const supa = createServiceClient();

  const { data: existing, error: lookupErr } = await supa
    .schema("mooov")
    .from("payment_attempts")
    .select("payment_id, status, intent, captured_at")
    .eq("payment_id", paymentId)
    .eq("lodge_id", lodgeId)
    .maybeSingle<{
      payment_id: string;
      status: string;
      intent: string;
      captured_at: string | null;
    }>();
  if (lookupErr) {
    console.error("Take payment cancel: lookup failed", {
      payment_id: paymentId,
      lodge_id: lodgeId,
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
  if (existing.intent !== "take_payment") {
    return NextResponse.json(
      { error: "Only in-person take-payment QRs can be cancelled here." },
      { status: 400 },
    );
  }
  if (existing.captured_at || !NON_TERMINAL.has(existing.status)) {
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
    .eq("lodge_id", lodgeId);
  if (updateErr) {
    console.error("Take payment cancel: update failed", {
      payment_id: paymentId,
      code: updateErr.code,
      message: updateErr.message,
    });
    return NextResponse.json(
      { error: "Could not cancel payment." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
