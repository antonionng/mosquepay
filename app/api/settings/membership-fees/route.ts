import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import * as db from "@/lib/db";
import { getLodgeSlugFromRequest } from "@/lib/tenant";
import { requireAdminApiAuth, requireAdminApiPermission } from "@/lib/auth/api";

export async function GET(request: NextRequest) {
  try {
    const unauthorized = await requireAdminApiAuth();
    if (unauthorized) return unauthorized;

    const lodgeSlug = getLodgeSlugFromRequest(request);

    if (!isSupabaseConfigured()) {
      return NextResponse.json({
        fees: {
          name: "Annual Subscription",
          amount: 150,
          currency: "gbp",
          billing_period: "annual",
          active: true,
          allow_instalments: false,
          instalment_count: 12,
          instalment_frequency: "monthly",
          charitable_amount: 0,
          charitable_label: "Charitable portion",
          gift_aid_enabled: false,
        },
      });
    }

    const lodgeId = await db.resolveLodgeId(lodgeSlug);
    if (!lodgeId) {
      return NextResponse.json({ error: "Lodge not found." }, { status: 404 });
    }
    const forbidden = await requireAdminApiPermission("payments:write", lodgeId);
    if (forbidden) return forbidden;

    const dues = await db.getLodgeDues(lodgeId);
    if (dues.length === 0) {
      return NextResponse.json({ fees: null });
    }

    return NextResponse.json({ fees: dues[0] });
  } catch (e) {
    console.error("Membership fees GET error:", e);
    return NextResponse.json({ error: "Failed to fetch fees." }, { status: 500 });
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
    const {
      name,
      amount,
      currency,
      billing_period,
      active,
      allow_instalments,
      instalment_count,
      instalment_frequency,
      charitable_amount,
      charitable_label,
      gift_aid_enabled,
    } = body;

    if (!name || amount === undefined) {
      return NextResponse.json(
        { error: "name and amount are required." },
        { status: 400 }
      );
    }

    const fees = await db.upsertLodgeDues(lodgeId, {
      name,
      amount: Number(amount),
      currency: currency ?? "gbp",
      billing_period: billing_period ?? "annual",
      active: active !== false,
      allow_instalments: allow_instalments ?? false,
      instalment_count: instalment_count ?? 12,
      instalment_frequency: instalment_frequency ?? "monthly",
      charitable_amount: Number(charitable_amount ?? 0),
      charitable_label: charitable_label ?? "Charitable portion",
      gift_aid_enabled: gift_aid_enabled ?? false,
    });

    return NextResponse.json({ fees });
  } catch (e) {
    console.error("Membership fees PUT error:", e);
    return NextResponse.json({ error: "Failed to update fees." }, { status: 500 });
  }
}
