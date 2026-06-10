import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import * as db from "@/lib/db";
import { getChurchSlugFromRequest } from "@/lib/tenant";
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

    const churchSlug = getChurchSlugFromRequest(request);

    if (!isSupabaseConfigured()) {
      return NextResponse.json({ fees: DEFAULTS });
    }

    const churchId = await db.resolveChurchId(churchSlug);
    if (!churchId) {
      return NextResponse.json({ error: "Church not found." }, { status: 404 });
    }
    const forbidden = await requireAdminApiPermission("payments:write", churchId);
    if (forbidden) return forbidden;

    const fees = await db.getChurchFeeDefaults(churchId);
    return NextResponse.json({
      fees: fees ?? { ...DEFAULTS, church_id: churchId },
    });
  } catch (e) {
    console.error("Church fees GET error:", e);
    return NextResponse.json({ error: "Failed to fetch church fees." }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
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
    const forbidden = await requireAdminApiPermission("payments:write", churchId);
    if (forbidden) return forbidden;

    const body = await request.json();
    const nullableAmount = (value: unknown) =>
      value === null || value === "" || value === undefined
        ? null
        : Number(value);

    const fees = await db.upsertChurchFeeDefaults(churchId, {
      default_member_levy_amount: nullableAmount(body.default_member_levy_amount),
      default_member_dining_amount: nullableAmount(body.default_member_dining_amount),
      default_guest_dining_amount: nullableAmount(body.default_guest_dining_amount),
      currency: body.currency ?? "gbp",
    });

    await writeAuditLog({
      churchId,
      action: "updated",
      entityType: "church_fee_defaults",
      entityId: churchId,
      summary: "Updated church fee defaults",
      metadata: fees as unknown as Record<string, unknown>,
    });

    return NextResponse.json({ fees });
  } catch (e) {
    console.error("Church fees PUT error:", e);
    return NextResponse.json({ error: "Failed to update church fees." }, { status: 500 });
  }
}
