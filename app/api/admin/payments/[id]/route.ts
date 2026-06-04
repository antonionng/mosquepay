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
import { applyPaymentEdit } from "@/lib/payments/apply-edit";

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

  // Resolve the event change (if any). `null`/empty detaches; a uuid attaches
  // after we confirm the event belongs to this lodge.
  let changeEvent = false;
  let eventId: string | null = null;
  if ("event_id" in body) {
    changeEvent = true;
    const raw = body.event_id;
    if (raw === null || (typeof raw === "string" && raw.trim() === "")) {
      eventId = null;
    } else if (typeof raw === "string") {
      const eventRow = await db.getEventById(raw.trim(), lodgeId);
      if (!eventRow) {
        return NextResponse.json(
          { error: "Selected meeting not found in this lodge." },
          { status: 400 },
        );
      }
      eventId = eventRow.id;
    } else {
      return NextResponse.json(
        { error: "event_id must be a uuid string or null." },
        { status: 400 },
      );
    }
  }

  const category = typeof body.category === "string" ? body.category : undefined;

  const result = await applyPaymentEdit(lodgeId, payment, {
    category,
    changeEvent,
    eventId,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  await writeAuditLog({
    lodgeId,
    action: "updated",
    entityType: "payment",
    entityId: id,
    summary:
      changeEvent && category === undefined
        ? eventId
          ? `Linked payment to event ${eventId}`
          : "Detached payment from meeting"
        : "Re-categorised payment",
    metadata: {
      category: category ?? null,
      changed_event: changeEvent,
      donation: result.donationAction,
    },
  });

  return NextResponse.json({
    success: true,
    payment: result.updated,
    donation: result.donationAction,
  });
}
