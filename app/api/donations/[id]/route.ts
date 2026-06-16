import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import * as db from "@/lib/db";
import { getMosqueSlugFromRequest } from "@/lib/tenant";
import {
  requireAdminApiAuth,
  requireAdminApiPermission,
} from "@/lib/auth/api";
import { writeAuditLog } from "@/lib/audit";

async function resolveMosque(request: NextRequest) {
  const mosqueSlug = getMosqueSlugFromRequest(request);
  const mosqueId = await db.resolveMosqueId(mosqueSlug);
  return mosqueId;
}

export async function GET(
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
  const mosqueId = await resolveMosque(request);
  if (!mosqueId) {
    return NextResponse.json({ error: "Mosque not found." }, { status: 404 });
  }
  const forbidden = await requireAdminApiPermission("charity:write", mosqueId);
  if (forbidden) return forbidden;

  const donation = await db.getDonationById(id, mosqueId);
  if (!donation) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  return NextResponse.json({ donation });
}

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
  const mosqueId = await resolveMosque(request);
  if (!mosqueId) {
    return NextResponse.json({ error: "Mosque not found." }, { status: 404 });
  }
  const forbidden = await requireAdminApiPermission("charity:write", mosqueId);
  if (forbidden) return forbidden;

  const body = await request.json();
  const updates: Record<string, unknown> = {};
  for (const key of [
    "donor_name",
    "donor_email",
    "amount",
    "source",
    "status",
    "campaign_id",
    "gift_aid_declaration_id",
    "gift_aid_status",
    "event_id",
  ]) {
    if (body[key] !== undefined) updates[key] = body[key];
  }

  const updated = await db.updateDonation(id, mosqueId, updates);
  if (!updated) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  await writeAuditLog({
    mosqueId,
    action: "donation_updated",
    entityType: "donation",
    entityId: id,
    summary: `Updated donation from ${updated.donor_name ?? updated.donor_email}`,
    metadata: updates,
  });

  return NextResponse.json({ donation: updated });
}
