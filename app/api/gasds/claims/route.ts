import { NextRequest, NextResponse } from "next/server";
import { requireAdminApiAuth, requireAdminApiPermission } from "@/lib/auth/api";
import { writeAuditLog } from "@/lib/audit";
import * as db from "@/lib/db";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import { getMosqueSlugFromRequest } from "@/lib/tenant";

const GASDS_ANNUAL_LIMIT = 8000;

export async function GET(request: NextRequest) {
  const unauthorized = await requireAdminApiAuth();
  if (unauthorized) return unauthorized;

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ claims: [] });
  }

  const mosqueId = await resolveMosque(request);
  if (!mosqueId) {
    return NextResponse.json({ error: "Mosque not found." }, { status: 404 });
  }

  const forbidden = await requireAdminApiPermission("charity:write", mosqueId);
  if (forbidden) return forbidden;

  const claims = await db.getGasdsClaims(mosqueId);
  return NextResponse.json({ claims });
}

export async function POST(request: NextRequest) {
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

  const body = await request.json().catch(() => ({}));
  const taxYear = typeof body.tax_year === "string" && body.tax_year
    ? body.tax_year
    : currentTaxYear();
  const collections = await db.getServiceCollections(mosqueId, { taxYear });
  const eligibleCashAmount = collections.reduce(
    (sum, collection) => sum + Number(collection.gasds_eligible_amount ?? 0),
    0
  );
  const claimedCashAmount = Math.min(eligibleCashAmount, GASDS_ANNUAL_LIMIT);
  const claim = await db.upsertGasdsClaim(mosqueId, {
    tax_year: taxYear,
    eligible_cash_amount: eligibleCashAmount,
    claimed_cash_amount: claimedCashAmount,
    reclaimable_amount: claimedCashAmount * 0.25,
    status: "draft",
    exported_at: null,
    filed_at: null,
    paid_at: null,
    notes: typeof body.notes === "string" ? body.notes : null,
  });

  await writeAuditLog({
    mosqueId,
    action: "gasds_claim_created",
    entityType: "gasds_claim",
    entityId: claim.id,
    summary: `Created GASDS claim for ${taxYear}`,
    metadata: {
      tax_year: taxYear,
      eligible_cash_amount: eligibleCashAmount,
      reclaimable_amount: claim.reclaimable_amount,
    },
  });

  return NextResponse.json({ claim }, { status: 201 });
}

async function resolveMosque(request: NextRequest) {
  const mosqueSlug = getMosqueSlugFromRequest(request);
  return db.resolveMosqueId(mosqueSlug);
}

function currentTaxYear() {
  const now = new Date();
  const year = now.getUTCFullYear();
  const startsNextTaxYear =
    now.getUTCMonth() > 3 || (now.getUTCMonth() === 3 && now.getUTCDate() >= 6);
  const start = startsNextTaxYear ? year : year - 1;
  return `${start}-${String(start + 1).slice(2)}`;
}
