import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import * as db from "@/lib/db";
import { getLodgeSlugFromRequest } from "@/lib/tenant";
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

    const lodgeSlug = getLodgeSlugFromRequest(request);

    if (!isSupabaseConfigured()) {
      return NextResponse.json({ fees: DEFAULTS });
    }

    const lodgeId = await db.resolveLodgeId(lodgeSlug);
    if (!lodgeId) {
      return NextResponse.json({ error: "Lodge not found." }, { status: 404 });
    }
    const forbidden = await requireAdminApiPermission("payments:write", lodgeId);
    if (forbidden) return forbidden;

    const fees = await db.getLodgeFeeDefaults(lodgeId);
    return NextResponse.json({
      fees: fees ?? { ...DEFAULTS, lodge_id: lodgeId },
    });
  } catch (e) {
    console.error("Lodge fees GET error:", e);
    return NextResponse.json({ error: "Failed to fetch lodge fees." }, { status: 500 });
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
    const nullableAmount = (value: unknown) =>
      value === null || value === "" || value === undefined
        ? null
        : Number(value);

    const fees = await db.upsertLodgeFeeDefaults(lodgeId, {
      default_member_levy_amount: nullableAmount(body.default_member_levy_amount),
      default_member_dining_amount: nullableAmount(body.default_member_dining_amount),
      default_guest_dining_amount: nullableAmount(body.default_guest_dining_amount),
      currency: body.currency ?? "gbp",
    });

    await writeAuditLog({
      lodgeId,
      action: "updated",
      entityType: "lodge_fee_defaults",
      entityId: lodgeId,
      summary: "Updated lodge fee defaults",
      metadata: fees as unknown as Record<string, unknown>,
    });

    return NextResponse.json({ fees });
  } catch (e) {
    console.error("Lodge fees PUT error:", e);
    return NextResponse.json({ error: "Failed to update lodge fees." }, { status: 500 });
  }
}
