import { NextRequest, NextResponse } from "next/server";
import { requireAdminApiAuth, requireAdminApiPermission } from "@/lib/auth/api";
import { getCurrentAdminScope } from "@/lib/auth/permissions";
import { writeAuditLog } from "@/lib/audit";
import * as db from "@/lib/db";
import type { Donation, GiftAidDeclaration } from "@/lib/db/types";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import { getLodgeSlugFromRequest } from "@/lib/tenant";
import { isSuccessfulPaymentStatus } from "@/lib/reports";

export async function GET(request: NextRequest) {
  const unauthorized = await requireAdminApiAuth();
  if (unauthorized) return unauthorized;

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ claims: [], eligible: [] });
  }

  const lodgeId = await resolveLodge(request);
  if (!lodgeId) {
    return NextResponse.json({ error: "Lodge not found." }, { status: 404 });
  }

  const forbidden = await requireAdminApiPermission("charity:write", lodgeId);
  if (forbidden) return forbidden;

  const [claims, donations, declarations] = await Promise.all([
    db.getGiftAidClaimBatches(lodgeId),
    db.getDonations(lodgeId),
    db.getGiftAidDeclarations(lodgeId),
  ]);

  return NextResponse.json({
    claims,
    eligible: eligibleDonationRows(donations, declarations),
  });
}

export async function POST(request: NextRequest) {
  const unauthorized = await requireAdminApiAuth();
  if (unauthorized) return unauthorized;

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Database not configured." }, { status: 503 });
  }

  const lodgeId = await resolveLodge(request);
  if (!lodgeId) {
    return NextResponse.json({ error: "Lodge not found." }, { status: 404 });
  }

  const forbidden = await requireAdminApiPermission("charity:write", lodgeId);
  if (forbidden) return forbidden;

  const body = await request.json().catch(() => ({}));
  const periodStart = typeof body.period_start === "string"
    ? body.period_start
    : new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10);
  const periodEnd = typeof body.period_end === "string"
    ? body.period_end
    : new Date().toISOString().slice(0, 10);
  const scope = await getCurrentAdminScope();

  const [donations, declarations] = await Promise.all([
    db.getDonations(lodgeId),
    db.getGiftAidDeclarations(lodgeId),
  ]);
  const eligible = eligibleDonationRows(donations, declarations).filter(
    (row) => row.created_at.slice(0, 10) >= periodStart && row.created_at.slice(0, 10) <= periodEnd
  );

  if (eligible.length === 0) {
    return NextResponse.json(
      { error: "No unclaimed Gift Aid eligible donations found for this period." },
      { status: 400 }
    );
  }

  const eligibleAmount = eligible.reduce((sum, row) => sum + row.eligible_amount, 0);
  const batch = await db.createGiftAidClaimBatch(lodgeId, {
    claim_reference: `GA-${periodStart}-${periodEnd}`,
    period_start: periodStart,
    period_end: periodEnd,
    status: "draft",
    donation_count: eligible.length,
    eligible_amount: eligibleAmount,
    reclaimable_amount: eligibleAmount * 0.25,
    exported_at: null,
    filed_at: null,
    paid_at: null,
    notes: typeof body.notes === "string" ? body.notes : null,
    created_by_email:
      scope.kind === "dummy" || scope.kind === "platform" || scope.kind === "lodge"
        ? scope.email
        : null,
  });

  await db.createGiftAidClaimItems(
    lodgeId,
    eligible.map((row) => ({
      claim_batch_id: batch.id,
      donation_id: row.id,
      gift_aid_declaration_id: row.gift_aid_declaration_id,
      donor_name: row.donor_name,
      donor_email: row.donor_email,
      donation_date: row.created_at.slice(0, 10),
      source: row.source,
      eligible_amount: row.eligible_amount,
      reclaimable_amount: row.eligible_amount * 0.25,
    }))
  );

  await Promise.all(
    eligible.map((row) =>
      db.updateDonation(row.id, lodgeId, {
        gift_aid_claim_batch_id: batch.id,
      })
    )
  );

  await writeAuditLog({
    lodgeId,
    action: "gift_aid_claim_batch_created",
    entityType: "gift_aid_claim_batch",
    entityId: batch.id,
    summary: `Created Gift Aid claim batch for ${eligible.length} donations`,
    metadata: {
      period_start: periodStart,
      period_end: periodEnd,
      eligible_amount: eligibleAmount,
      reclaimable_amount: eligibleAmount * 0.25,
    },
  });

  return NextResponse.json({ claim: batch }, { status: 201 });
}

async function resolveLodge(request: NextRequest) {
  const lodgeSlug = getLodgeSlugFromRequest(request);
  return db.resolveLodgeId(lodgeSlug);
}

function eligibleDonationRows(
  donations: Donation[],
  declarations: GiftAidDeclaration[]
) {
  const declarationByEmail = new Map(
    declarations
      .filter((declaration) => !declaration.revoked_at && declaration.declaration_confirmed && declaration.hmrc_eligible)
      .map((declaration) => [declaration.donor_email.toLowerCase(), declaration])
  );

  return donations
    .filter((donation) => isSuccessfulPaymentStatus(donation.status))
    .filter((donation) => !donation.gift_aid_claim_batch_id)
    .map((donation) => {
      const declaration = donation.gift_aid_declaration_id
        ? declarations.find((item) => item.id === donation.gift_aid_declaration_id)
        : declarationByEmail.get(donation.donor_email.toLowerCase());
      const declared =
        donation.gift_aid_status === "declared" ||
        Boolean(declaration && !declaration.revoked_at);
      const eligibleAmount =
        donation.gift_aid_eligible_amount && donation.gift_aid_eligible_amount > 0
          ? donation.gift_aid_eligible_amount
          : declared
            ? donation.amount
            : 0;
      return {
        ...donation,
        gift_aid_declaration_id: declaration?.id ?? donation.gift_aid_declaration_id,
        eligible_amount: eligibleAmount,
      };
    })
    .filter((donation) => donation.eligible_amount > 0);
}
