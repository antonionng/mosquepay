// PATCH /api/admin/payments/[id]
//
// Lightweight admin edit endpoint for an existing payments row. Currently
// supports two adjustments treasurers ask for after the fact:
//
//   1. Attach (or detach) the payment to a meeting (event_id).
//   2. Re-categorise the payment (category) — this also re-runs the
//      category->sub-amount splitter so the per-fee breakdown stays
//      consistent. The total_amount is never changed.
//
// We deliberately do NOT support changing the user_email, amount, or
// status here. Refunds go through the dedicated refund flow; amount edits
// would invalidate any Mooov/Stripe ledger we projected from, which is
// the wrong direction. If a wrong amount lands, void and re-take.

import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import { rejectIfMockDisabled } from "@/lib/db/reject-mock";
import * as db from "@/lib/db";
import { getAdminReadContext } from "@/lib/admin/read-context";
import {
  requireAdminApiAuth,
  requireAdminApiPermission,
} from "@/lib/auth/api";
import { writeAuditLog } from "@/lib/audit";
import { splitAmountByCategory } from "@/lib/take-payment/categorize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const _rejectMock = rejectIfMockDisabled();
  if (_rejectMock) return _rejectMock;

  const unauthorized = await requireAdminApiAuth();
  if (unauthorized) return unauthorized;

  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Database not configured." },
      { status: 503 },
    );
  }

  const { id } = await params;
  const ctx = await getAdminReadContext();
  if (ctx.mode !== "database" || !ctx.lodgeId) {
    return NextResponse.json({ error: "Lodge not selected." }, { status: 404 });
  }
  const lodgeId = ctx.lodgeId;

  const forbidden = await requireAdminApiPermission("payments:write", lodgeId);
  if (forbidden) return forbidden;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const payment = await db.getPaymentById(id, lodgeId);
  if (!payment) {
    return NextResponse.json({ error: "Payment not found." }, { status: 404 });
  }

  const updates: Record<string, unknown> = {};

  // Attach / detach event. `null` (or empty string) detaches; a uuid attaches
  // after we confirm the event belongs to this lodge.
  if ("event_id" in body) {
    const raw = body.event_id;
    if (raw === null || (typeof raw === "string" && raw.trim() === "")) {
      updates.event_id = null;
    } else if (typeof raw === "string") {
      const eventRow = await db.getEventById(raw.trim(), lodgeId);
      if (!eventRow) {
        return NextResponse.json(
          { error: "Selected meeting not found in this lodge." },
          { status: 400 },
        );
      }
      updates.event_id = eventRow.id;
    } else {
      return NextResponse.json(
        { error: "event_id must be a uuid string or null." },
        { status: 400 },
      );
    }
  }

  // Optional re-categorise. We rebuild the sub-amounts from total_amount so
  // the breakdown stays consistent with the new category. This deliberately
  // does NOT touch refund_amount — refunds remain attached however they
  // were originally recorded.
  if (typeof body.category === "string") {
    const splits = splitAmountByCategory(payment.total_amount, body.category);
    updates.dining_amount = splits.dining_amount;
    updates.charity_amount = splits.charity_amount;
    updates.raffle_amount = splits.raffle_amount;
    updates.meeting_fee_amount = splits.meeting_fee_amount;
    updates.guest_ticket_amount = splits.guest_ticket_amount;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: "No supported fields provided." },
      { status: 400 },
    );
  }

  const updated = await db.updatePayment(id, lodgeId, updates);
  if (!updated) {
    return NextResponse.json(
      { error: "Could not update payment." },
      { status: 500 },
    );
  }

  await writeAuditLog({
    lodgeId,
    action: "updated",
    entityType: "payment",
    entityId: id,
    summary:
      "event_id" in updates
        ? updates.event_id
          ? `Linked payment to event ${updates.event_id as string}`
          : "Detached payment from meeting"
        : "Re-categorised payment",
    metadata: { fields: Object.keys(updates) },
  });

  return NextResponse.json({ success: true, payment: updated });
}
