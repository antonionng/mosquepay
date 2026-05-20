// crud-audit:ignore-update crud-audit:ignore-delete
// Manual donation entry. Edits and deletions go through /api/donations/[id].
import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import * as db from "@/lib/db";
import { getLodgeSlugFromRequest } from "@/lib/tenant";
import {
  requireAdminApiAuth,
  requireAdminApiPermission,
} from "@/lib/auth/api";
import { writeAuditLog } from "@/lib/audit";

export async function POST(request: NextRequest) {
  const unauthorized = await requireAdminApiAuth();
  if (unauthorized) return unauthorized;
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Database not configured." },
      { status: 503 }
    );
  }
  const lodgeSlug = getLodgeSlugFromRequest(request);
  const lodgeId = await db.resolveLodgeId(lodgeSlug);
  if (!lodgeId) {
    return NextResponse.json({ error: "Lodge not found." }, { status: 404 });
  }
  const forbidden = await requireAdminApiPermission("charity:write", lodgeId);
  if (forbidden) return forbidden;

  const body = await request.json();
  const amount = Number(body.amount);
  const donorEmail = (body.donor_email ?? "").toString().trim().toLowerCase();
  if (!Number.isFinite(amount) || amount <= 0 || !donorEmail) {
    return NextResponse.json(
      { error: "Donor email and a positive amount are required." },
      { status: 400 }
    );
  }

  const source = (body.source ?? "manual").toString();
  const status = (body.status ?? "completed").toString();
  const giftAidStatus = (body.gift_aid_status ?? "unknown") as
    | "unknown"
    | "eligible"
    | "declared"
    | "declined";

  const donation = await db.addDonation(lodgeId, {
    event_id: body.event_id ?? null,
    payment_id: body.payment_id ?? null,
    donor_name: body.donor_name?.toString().trim() || null,
    donor_email: donorEmail,
    amount,
    currency: (body.currency ?? "GBP").toString().toUpperCase(),
    source,
    status,
    gift_aid_declaration_id: body.gift_aid_declaration_id ?? null,
    campaign_id: body.campaign_id ?? null,
    gift_aid_status: giftAidStatus,
  });

  await writeAuditLog({
    lodgeId,
    action: "donation_created",
    entityType: "donation",
    entityId: donation.id,
    summary: `Manual donation £${amount.toFixed(2)} from ${donation.donor_name ?? donation.donor_email}`,
    metadata: {
      source,
      status,
      campaign_id: donation.campaign_id,
      gift_aid_status: giftAidStatus,
    },
  });

  return NextResponse.json({ donation }, { status: 201 });
}
