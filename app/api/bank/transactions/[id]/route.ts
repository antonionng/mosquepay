import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import * as db from "@/lib/db";
import { getLodgeSlugFromRequest } from "@/lib/tenant";
import {
  requireAdminApiAuth,
  requireAdminApiPermission,
} from "@/lib/auth/api";
import { writeAuditLog } from "@/lib/audit";

const ALLOWED_SOURCE_TYPES = ["payment", "dues", "donation", "manual"] as const;
type SourceType = (typeof ALLOWED_SOURCE_TYPES)[number];

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const unauthorized = await requireAdminApiAuth();
  if (unauthorized) return unauthorized;
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Database not configured." },
      { status: 503 }
    );
  }

  const { id } = await params;
  const lodgeSlug = getLodgeSlugFromRequest(request);
  const lodgeId = await db.resolveLodgeId(lodgeSlug);
  if (!lodgeId) {
    return NextResponse.json({ error: "Lodge not found." }, { status: 404 });
  }
  const forbidden = await requireAdminApiPermission("payments:write", lodgeId);
  if (forbidden) return forbidden;

  const body = await request.json();
  const action: "match" | "unmatch" | "ignore" = body.action;

  let updated = null;
  if (action === "match") {
    const sourceType: SourceType = body.source_type;
    const sourceId: string | undefined = body.source_id;
    if (!ALLOWED_SOURCE_TYPES.includes(sourceType)) {
      return NextResponse.json(
        { error: "Invalid source_type." },
        { status: 400 }
      );
    }
    if (sourceType !== "manual" && !sourceId) {
      return NextResponse.json(
        { error: "source_id is required." },
        { status: 400 }
      );
    }
    updated = await db.updateBankTransaction(id, lodgeId, {
      status: "matched",
      matched_source_type: sourceType,
      matched_source_id: sourceType === "manual" ? null : (sourceId ?? null),
      matched_confidence: 1,
      matched_at: new Date().toISOString(),
      notes: body.notes ?? null,
    });
  } else if (action === "unmatch") {
    updated = await db.updateBankTransaction(id, lodgeId, {
      status: "unmatched",
      matched_source_type: null,
      matched_source_id: null,
      matched_confidence: null,
      matched_at: null,
    });
  } else if (action === "ignore") {
    updated = await db.updateBankTransaction(id, lodgeId, {
      status: "ignored",
      notes: body.notes ?? null,
    });
  } else {
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  }

  if (!updated) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  await writeAuditLog({
    lodgeId,
    action: `bank_transaction_${action}`,
    entityType: "bank_transaction",
    entityId: id,
    summary: `Bank transaction ${action} for ${updated.description}`,
    metadata: {
      amount: updated.amount,
      posted_date: updated.posted_date,
      source_type: updated.matched_source_type,
      source_id: updated.matched_source_id,
    },
  });

  return NextResponse.json({ transaction: updated });
}
