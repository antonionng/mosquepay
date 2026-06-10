import { NextRequest, NextResponse } from "next/server";
import { requireAdminApiAuth, requireAdminApiPermission } from "@/lib/auth/api";
import { getCurrentAdminScope } from "@/lib/auth/permissions";
import { writeAuditLog } from "@/lib/audit";
import * as db from "@/lib/db";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import { getChurchSlugFromRequest } from "@/lib/tenant";

const GASDS_ANNUAL_LIMIT = 8000;

export async function GET(request: NextRequest) {
  const unauthorized = await requireAdminApiAuth();
  if (unauthorized) return unauthorized;

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ collections: [], gasds: summary([], null) });
  }

  const churchSlug = getChurchSlugFromRequest(request);
  const churchId = await db.resolveChurchId(churchSlug);
  if (!churchId) {
    return NextResponse.json({ error: "Church not found." }, { status: 404 });
  }

  const forbidden = await requireAdminApiPermission("charity:write", churchId);
  if (forbidden) return forbidden;

  const taxYear = request.nextUrl.searchParams.get("tax_year") ?? undefined;
  const collections = await db.getServiceCollections(churchId, { taxYear });
  return NextResponse.json({ collections, gasds: summary(collections, taxYear ?? null) });
}

export async function POST(request: NextRequest) {
  const unauthorized = await requireAdminApiAuth();
  if (unauthorized) return unauthorized;

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Database not configured." }, { status: 503 });
  }

  const churchSlug = getChurchSlugFromRequest(request);
  const churchId = await db.resolveChurchId(churchSlug);
  if (!churchId) {
    return NextResponse.json({ error: "Church not found." }, { status: 404 });
  }

  const forbidden = await requireAdminApiPermission("charity:write", churchId);
  if (forbidden) return forbidden;

  const body = await request.json().catch(() => ({}));
  const collectionDate = typeof body.collection_date === "string"
    ? body.collection_date
    : new Date().toISOString().slice(0, 10);
  const taxYear = typeof body.gasds_tax_year === "string" && body.gasds_tax_year
    ? body.gasds_tax_year
    : taxYearForDate(collectionDate);
  const anonymousCashAmount = money(body.anonymous_cash_amount ?? body.cash_amount);
  const existingCollections = await db.getServiceCollections(churchId, { taxYear });
  const usedAllowance = existingCollections.reduce(
    (sum, collection) => sum + Number(collection.gasds_eligible_amount ?? 0),
    0
  );
  const gasdsEligibleAmount = Math.min(
    anonymousCashAmount,
    Math.max(0, GASDS_ANNUAL_LIMIT - usedAllowance)
  );
  const scope = await getCurrentAdminScope();

  const collection = await db.createServiceCollection(churchId, {
    event_id: typeof body.event_id === "string" ? body.event_id : null,
    campaign_id: typeof body.campaign_id === "string" ? body.campaign_id : null,
    collection_date: collectionDate,
    collection_type: typeof body.collection_type === "string" ? body.collection_type : "festive_board",
    title: typeof body.title === "string" && body.title.trim() ? body.title.trim() : "Service collection",
    cash_amount: money(body.cash_amount),
    card_amount: money(body.card_amount),
    donor_linked_amount: money(body.donor_linked_amount),
    anonymous_cash_amount: anonymousCashAmount,
    gift_aid_reclaimable_amount: money(body.gift_aid_reclaimable_amount),
    gasds_eligible_amount: gasdsEligibleAmount,
    gasds_tax_year: taxYear,
    notes: typeof body.notes === "string" ? body.notes.trim() || null : null,
    recorded_by_email:
      scope.kind === "dummy" || scope.kind === "platform" || scope.kind === "church"
        ? scope.email
        : null,
  });

  await writeAuditLog({
    churchId,
    action: "service_collection_created",
    entityType: "service_collection",
    entityId: collection.id,
    summary: `Recorded service collection ${collection.title}`,
    metadata: {
      event_id: collection.event_id,
      cash_amount: collection.cash_amount,
      gasds_eligible_amount: collection.gasds_eligible_amount,
      gasds_tax_year: collection.gasds_tax_year,
    },
  });

  return NextResponse.json({ collection }, { status: 201 });
}

function money(value: unknown) {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount) || amount < 0) return 0;
  return Number(amount.toFixed(2));
}

function taxYearForDate(value: string) {
  const date = new Date(value);
  const year = date.getUTCFullYear();
  const startsNextTaxYear =
    date.getUTCMonth() > 3 || (date.getUTCMonth() === 3 && date.getUTCDate() >= 6);
  const start = startsNextTaxYear ? year : year - 1;
  return `${start}-${String(start + 1).slice(2)}`;
}

function summary(collections: Array<{ gasds_eligible_amount: number }>, taxYear: string | null) {
  const eligibleCashAmount = collections.reduce(
    (sum, collection) => sum + Number(collection.gasds_eligible_amount ?? 0),
    0
  );
  const cappedEligibleAmount = Math.min(eligibleCashAmount, GASDS_ANNUAL_LIMIT);
  return {
    tax_year: taxYear,
    annual_limit: GASDS_ANNUAL_LIMIT,
    eligible_cash_amount: eligibleCashAmount,
    capped_eligible_amount: cappedEligibleAmount,
    remaining_allowance: Math.max(0, GASDS_ANNUAL_LIMIT - cappedEligibleAmount),
    reclaimable_amount: cappedEligibleAmount * 0.25,
  };
}
