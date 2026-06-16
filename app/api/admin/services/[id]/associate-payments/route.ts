// POST /api/admin/services/[id]/associate-payments
//
// Bulk-link a set of payments to this service. Used by the service page's
// "payments taken the same day as this service" reconciliation panel so a
// treasurer can confirm a batch of untagged takings in one tap. Each payment
// is routed through the shared applyPaymentEdit helper so the charity
// donation / Gift Aid ledger stays in step, and so a payment whose donation
// is already in a claim batch is skipped (reported back) rather than diverged.
//
// Amounts, refunds and status are never touched.

import { NextRequest, NextResponse } from "next/server";
import * as db from "@/lib/db";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import { rejectIfMockDisabled } from "@/lib/db/reject-mock";
import { getAdminReadContext } from "@/lib/admin/read-context";
import {
  requireAdminApiAuth,
  requireAdminApiPermission,
} from "@/lib/auth/api";
import { writeAuditLog } from "@/lib/audit";
import { applyPaymentEdit } from "@/lib/payments/apply-edit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
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

  const { id: eventId } = await params;
  const ctx = await getAdminReadContext();
  if (ctx.mode !== "database" || !ctx.mosqueId) {
    return NextResponse.json({ error: "Mosque not selected." }, { status: 404 });
  }
  const mosqueId = ctx.mosqueId;

  const forbidden = await requireAdminApiPermission("payments:write", mosqueId);
  if (forbidden) return forbidden;

  let body: { payment_ids?: unknown; detach?: unknown };
  try {
    body = (await request.json()) as { payment_ids?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const ids = Array.isArray(body.payment_ids)
    ? body.payment_ids.filter((v): v is string => typeof v === "string")
    : [];
  if (ids.length === 0) {
    return NextResponse.json(
      { error: "No payments provided." },
      { status: 400 },
    );
  }
  // Cap to a sane batch size to avoid an accidental runaway loop.
  if (ids.length > 200) {
    return NextResponse.json(
      { error: "Too many payments in one request (max 200)." },
      { status: 400 },
    );
  }

  // detach=true unlinks instead of links (eventId becomes null). Default links
  // every payment to this service.
  const detach = body.detach === true;
  if (!detach) {
    const event = await db.getEventById(eventId, mosqueId);
    if (!event) {
      return NextResponse.json(
        { error: "Service not found." },
        { status: 404 },
      );
    }
  }

  const associated: string[] = [];
  const skipped: { id: string; reason: string }[] = [];

  for (const paymentId of ids) {
    const payment = await db.getPaymentById(paymentId, mosqueId).catch(() => null);
    if (!payment) {
      skipped.push({ id: paymentId, reason: "not_found" });
      continue;
    }
    const result = await applyPaymentEdit(mosqueId, payment, {
      changeEvent: true,
      eventId: detach ? null : eventId,
    });
    if (result.ok) {
      associated.push(paymentId);
    } else {
      skipped.push({
        id: paymentId,
        reason: result.status === 409 ? "in_claim_batch" : "error",
      });
    }
  }

  await writeAuditLog({
    mosqueId,
    action: detach ? "payments_detached_bulk" : "payments_associated_bulk",
    entityType: "event",
    entityId: eventId,
    summary: detach
      ? `Detached ${associated.length} payment${associated.length === 1 ? "" : "s"} from service.`
      : `Associated ${associated.length} payment${associated.length === 1 ? "" : "s"} with service.`,
    metadata: {
      associated_count: associated.length,
      skipped_count: skipped.length,
    },
  });

  return NextResponse.json({
    success: true,
    associated: associated.length,
    skipped,
  });
}
