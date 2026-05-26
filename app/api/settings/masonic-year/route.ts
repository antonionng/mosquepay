import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import * as db from "@/lib/db";
import { getLodgeSlugFromRequest } from "@/lib/tenant";
import { requireAdminApiAuth, requireAdminApiPermission } from "@/lib/auth/api";
import { writeAuditLog } from "@/lib/audit";
import { defaultMasonicYearBounds } from "@/lib/dues/pro-rata";

export async function GET(request: NextRequest) {
  try {
    const unauthorized = await requireAdminApiAuth();
    if (unauthorized) return unauthorized;

    const lodgeSlug = getLodgeSlugFromRequest(request);

    if (!isSupabaseConfigured()) {
      const bounds = defaultMasonicYearBounds();
      return NextResponse.json({
        current: {
          label: bounds.label,
          start_date: bounds.startDate,
          end_date: bounds.endDate,
          annual_dues_amount: 200,
          is_current: true,
        },
        years: [],
      });
    }

    const lodgeId = await db.resolveLodgeId(lodgeSlug);
    if (!lodgeId) {
      return NextResponse.json({ error: "Lodge not found." }, { status: 404 });
    }
    const forbidden = await requireAdminApiPermission("payments:write", lodgeId);
    if (forbidden) return forbidden;

    const [current, years, lodgeDues] = await Promise.all([
      db.getCurrentMasonicYear(lodgeId),
      db.listLodgeMasonicYears(lodgeId),
      db.getLodgeDues(lodgeId),
    ]);

    return NextResponse.json({
      current,
      years,
      suggested_annual_amount: lodgeDues[0]?.amount ?? null,
    });
  } catch (e) {
    console.error("Masonic year GET error:", e);
    return NextResponse.json({ error: "Failed to fetch masonic year." }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const unauthorized = await requireAdminApiAuth();
    if (unauthorized) return unauthorized;

    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: "Database not configured." }, { status: 503 });
    }

    const lodgeSlug = getLodgeSlugFromRequest(request);
    const lodgeId = await db.resolveLodgeId(lodgeSlug);
    if (!lodgeId) {
      return NextResponse.json({ error: "Lodge not found." }, { status: 404 });
    }
    const forbidden = await requireAdminApiPermission("payments:write", lodgeId);
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

    const year = await db.upsertLodgeMasonicYear(lodgeId, {
      id: body.id ?? undefined,
      label,
      start_date: startDate,
      end_date: endDate,
      annual_dues_amount:
        body.annual_dues_amount != null && body.annual_dues_amount !== ""
          ? Number(body.annual_dues_amount)
          : null,
      is_current: body.is_current !== false,
    });

    await writeAuditLog({
      lodgeId,
      action: "updated",
      entityType: "masonic_year",
      entityId: year.id,
      summary: `Set masonic year ${year.label}`,
    });

    return NextResponse.json({ year });
  } catch (e) {
    console.error("Masonic year PUT error:", e);
    return NextResponse.json({ error: "Failed to save masonic year." }, { status: 500 });
  }
}
