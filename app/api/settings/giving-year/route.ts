import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import * as db from "@/lib/db";
import { getMosqueSlugFromRequest } from "@/lib/tenant";
import { requireAdminApiAuth, requireAdminApiPermission } from "@/lib/auth/api";
import { writeAuditLog } from "@/lib/audit";
import { defaultMosqueYearBounds } from "@/lib/giving/pro-rata";

export async function GET(request: NextRequest) {
  try {
    const unauthorized = await requireAdminApiAuth();
    if (unauthorized) return unauthorized;

    const mosqueSlug = getMosqueSlugFromRequest(request);

    if (!isSupabaseConfigured()) {
      const bounds = defaultMosqueYearBounds();
      return NextResponse.json({
        current: {
          label: bounds.label,
          start_date: bounds.startDate,
          end_date: bounds.endDate,
          annual_giving_amount: 200,
          is_current: true,
        },
        years: [],
      });
    }

    const mosqueId = await db.resolveMosqueId(mosqueSlug);
    if (!mosqueId) {
      return NextResponse.json({ error: "Mosque not found." }, { status: 404 });
    }
    const forbidden = await requireAdminApiPermission("payments:write", mosqueId);
    if (forbidden) return forbidden;

    const [current, years, mosqueGiving] = await Promise.all([
      db.getCurrentMosqueYear(mosqueId),
      db.listMosqueGivingYears(mosqueId),
      db.getMosqueGiving(mosqueId),
    ]);

    return NextResponse.json({
      current,
      years,
      suggested_annual_amount: mosqueGiving[0]?.amount ?? null,
    });
  } catch (e) {
    console.error("Giving year GET error:", e);
    return NextResponse.json({ error: "Failed to fetch giving year." }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const unauthorized = await requireAdminApiAuth();
    if (unauthorized) return unauthorized;

    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: "Database not configured." }, { status: 503 });
    }

    const mosqueSlug = getMosqueSlugFromRequest(request);
    const mosqueId = await db.resolveMosqueId(mosqueSlug);
    if (!mosqueId) {
      return NextResponse.json({ error: "Mosque not found." }, { status: 404 });
    }
    const forbidden = await requireAdminApiPermission("payments:write", mosqueId);
    if (forbidden) return forbidden;

    const body = await request.json();
    const label = String(body.label ?? "").trim();
    const startDate = String(body.start_date ?? "").trim();
    const endDate = String(body.end_date ?? "").trim();

    if (!label || !startDate || !endDate) {
      return NextResponse.json(
        { error: "label, start_date, and end_date are required." },
        { status: 400 }
      );
    }

    const year = await db.upsertMosqueGivingYear(mosqueId, {
      id: body.id ?? undefined,
      label,
      start_date: startDate,
      end_date: endDate,
      annual_giving_amount:
        body.annual_giving_amount != null && body.annual_giving_amount !== ""
          ? Number(body.annual_giving_amount)
          : null,
      is_current: body.is_current !== false,
    });

    await writeAuditLog({
      mosqueId,
      action: "updated",
      entityType: "giving_year",
      entityId: year.id,
      summary: `Set giving year ${year.label}`,
    });

    return NextResponse.json({ year });
  } catch (e) {
    console.error("Giving year PUT error:", e);
    return NextResponse.json({ error: "Failed to save giving year." }, { status: 500 });
  }
}
