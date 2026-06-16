import { NextRequest, NextResponse } from "next/server";
import { requireAdminApiAuth, requireAdminApiPermission } from "@/lib/auth/api";
import { writeAuditLog } from "@/lib/audit";
import * as db from "@/lib/db";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import { getMosqueSlugFromRequest } from "@/lib/tenant";

const STATUS_DATES = {
  exported: "exported_at",
  filed: "filed_at",
  paid: "paid_at",
} as const;

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const unauthorized = await requireAdminApiAuth();
  if (unauthorized) return unauthorized;

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Database not configured." }, { status: 503 });
  }

  const mosqueId = await resolveMosque(request);
  if (!mosqueId) {
    return NextResponse.json({ error: "Mosque not found." }, { status: 404 });
  }

  const forbidden = await requireAdminApiPermission("charity:write", mosqueId);
  if (forbidden) return forbidden;

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const status = typeof body.status === "string" ? body.status : "";
  if (!["draft", "exported", "filed", "paid"].includes(status)) {
    return NextResponse.json({ error: "Valid status is required." }, { status: 400 });
  }

  const existing = (await db.getGasdsClaims(mosqueId)).find((claim) => claim.id === id);
  if (!existing) {
    return NextResponse.json({ error: "GASDS claim not found." }, { status: 404 });
  }

  const now = new Date().toISOString();
  const updates = {
    ...existing,
    status: status as "draft" | "exported" | "filed" | "paid",
    notes: typeof body.notes === "string" ? body.notes : existing.notes,
  };
  if (status in STATUS_DATES) {
    updates[STATUS_DATES[status as keyof typeof STATUS_DATES]] = now;
  }

  const claim = await db.upsertGasdsClaim(mosqueId, {
    tax_year: updates.tax_year,
    eligible_cash_amount: updates.eligible_cash_amount,
    claimed_cash_amount: updates.claimed_cash_amount,
    reclaimable_amount: updates.reclaimable_amount,
    status: updates.status,
    exported_at: updates.exported_at,
    filed_at: updates.filed_at,
    paid_at: updates.paid_at,
    notes: updates.notes,
  });

  await writeAuditLog({
    mosqueId,
    action: "gasds_claim_updated",
    entityType: "gasds_claim",
    entityId: claim.id,
    summary: `GASDS claim marked ${status}`,
    metadata: { status },
  });

  return NextResponse.json({ claim });
}

async function resolveMosque(request: NextRequest) {
  const mosqueSlug = getMosqueSlugFromRequest(request);
  return db.resolveMosqueId(mosqueSlug);
}
