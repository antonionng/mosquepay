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

export async function GET(
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
  const items = await db.getGiftAidClaimItems(mosqueId, id);
  return NextResponse.json({ items });
}

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

  const now = new Date().toISOString();
  const updates: Parameters<typeof db.updateGiftAidClaimBatch>[2] = {
    status: status as "draft" | "exported" | "filed" | "paid",
  };
  if (typeof body.claim_reference === "string") {
    updates.claim_reference = body.claim_reference;
  }
  if (typeof body.notes === "string") {
    updates.notes = body.notes;
  }
  if (status in STATUS_DATES) {
    updates[STATUS_DATES[status as keyof typeof STATUS_DATES]] = now;
  }

  const claim = await db.updateGiftAidClaimBatch(id, mosqueId, updates);
  if (!claim) {
    return NextResponse.json({ error: "Claim not found." }, { status: 404 });
  }

  if (status === "exported" || status === "filed" || status === "paid") {
    const items = await db.getGiftAidClaimItems(mosqueId, id);
    await Promise.all(
      items
        .filter((item) => item.donation_id)
        .map((item) =>
          db.updateDonation(item.donation_id as string, mosqueId, {
            gift_aid_claimed_at: now,
          })
        )
    );
  }

  await writeAuditLog({
    mosqueId,
    action: "gift_aid_claim_batch_updated",
    entityType: "gift_aid_claim_batch",
    entityId: id,
    summary: `Gift Aid claim marked ${status}`,
    metadata: updates,
  });

  return NextResponse.json({ claim });
}

async function resolveMosque(request: NextRequest) {
  const mosqueSlug = getMosqueSlugFromRequest(request);
  return db.resolveMosqueId(mosqueSlug);
}
