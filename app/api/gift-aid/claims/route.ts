import { NextRequest, NextResponse } from "next/server";
import { requireAdminApiAuth, requireAdminApiPermission } from "@/lib/auth/api";
import { getCurrentAdminScope } from "@/lib/auth/permissions";
import { writeAuditLog } from "@/lib/audit";
import * as db from "@/lib/db";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import { getLodgeSlugFromRequest } from "@/lib/tenant";
import { eligibleDonationRows } from "@/lib/gift-aid/eligible";
import { resolveDeclarationsForBatch } from "@/lib/gift-aid/new-declarations";

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

  // Sweep + attach declarations created since the previous batch so the
  // pack we ship to UGLE includes copies. Per-period batches share this
  // logic with per-meeting close (see lib/gift-aid/new-declarations.ts).
  let newDeclarationsCount = 0;
  try {
    const resolved = await resolveDeclarationsForBatch({
      lodgeId,
      newBatch: { created_at: batch.created_at, id: batch.id },
      donorDeclarationIds: eligible
        .map((row) => row.gift_aid_declaration_id)
        .filter((id): id is string => Boolean(id)),
    });
    if (resolved.links.length > 0) {
      await db.linkDeclarationsToClaimBatch(lodgeId, batch.id, resolved.links);
      // declarations_count = NEW declarations only (what UGLE retains this
      // cycle). donor_in_batch links are still persisted for the pack's
      // previously-supplied folder, but don't inflate the headline count.
      const newCount = resolved.links.filter(
        (link) => link.inclusion_reason === "new_in_window"
      ).length;
      await db.setClaimBatchDeclarationsCount(batch.id, lodgeId, newCount);
      newDeclarationsCount = newCount;
    }
  } catch (err) {
    console.error("gift-aid claims POST: declaration linkage failed", {
      batch_id: batch.id,
      message: err instanceof Error ? err.message : String(err),
    });
  }

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
      new_declarations_count: newDeclarationsCount,
    },
  });

  return NextResponse.json(
    { claim: batch, new_declarations_count: newDeclarationsCount },
    { status: 201 }
  );
}

async function resolveLodge(request: NextRequest) {
  const lodgeSlug = getLodgeSlugFromRequest(request);
  return db.resolveLodgeId(lodgeSlug);
}
