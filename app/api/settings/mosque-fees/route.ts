import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import * as db from "@/lib/db";
import { getMosqueSlugFromRequest } from "@/lib/tenant";
import { requireAdminApiAuth, requireAdminApiPermission } from "@/lib/auth/api";
import { writeAuditLog } from "@/lib/audit";

const DEFAULTS = {
  default_member_levy_amount: 10,
  default_member_dining_amount: null as number | null,
  default_guest_dining_amount: 30,
  currency: "gbp",
};

export async function GET(request: NextRequest) {
  try {
    const unauthorized = await requireAdminApiAuth();
    if (unauthorized) return unauthorized;

    const mosqueSlug = getMosqueSlugFromRequest(request);

    if (!isSupabaseConfigured()) {
      return NextResponse.json({ fees: DEFAULTS });
    }

    const mosqueId = await db.resolveMosqueId(mosqueSlug);
    if (!mosqueId) {
      return NextResponse.json({ error: "Mosque not found." }, { status: 404 });
    }
    const forbidden = await requireAdminApiPermission("payments:write", mosqueId);
    if (forbidden) return forbidden;

    const fees = await db.getMosqueFeeDefaults(mosqueId);
    return NextResponse.json({
      fees: fees ?? { ...DEFAULTS, mosque_id: mosqueId },
    });
  } catch (e) {
    console.error("Mosque fees GET error:", e);
    return NextResponse.json({ error: "Failed to fetch mosque fees." }, { status: 500 });
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
    const nullableAmount = (value: unknown) =>
      value === null || value === "" || value === undefined
        ? null
        : Number(value);

    const fees = await db.upsertMosqueFeeDefaults(mosqueId, {
      default_member_levy_amount: nullableAmount(body.default_member_levy_amount),
      default_member_dining_amount: nullableAmount(body.default_member_dining_amount),
      default_guest_dining_amount: nullableAmount(body.default_guest_dining_amount),
      currency: body.currency ?? "gbp",
    });

    await writeAuditLog({
      mosqueId,
      action: "updated",
      entityType: "mosque_fee_defaults",
      entityId: mosqueId,
      summary: "Updated mosque fee defaults",
      metadata: fees as unknown as Record<string, unknown>,
    });

    return NextResponse.json({ fees });
  } catch (e) {
    console.error("Mosque fees PUT error:", e);
    return NextResponse.json({ error: "Failed to update mosque fees." }, { status: 500 });
  }
}
