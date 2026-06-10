import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import * as db from "@/lib/db";
import { getChurchSlugFromRequest } from "@/lib/tenant";
import { requireAdminApiAuth, requireAdminApiPermission } from "@/lib/auth/api";

export async function GET(request: NextRequest) {
  try {
    const unauthorized = await requireAdminApiAuth();
    if (unauthorized) return unauthorized;

    const churchSlug = getChurchSlugFromRequest(request);

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

    const churchId = await db.resolveChurchId(churchSlug);
    if (!churchId) {
      return NextResponse.json({ error: "Church not found." }, { status: 404 });
    }
    const forbidden = await requireAdminApiPermission("payments:write", churchId);
    if (forbidden) return forbidden;

    const giving = await db.getChurchGiving(churchId);
    if (giving.length === 0) {
      return NextResponse.json({ fees: null });
    }

    return NextResponse.json({ fees: giving[0] });
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

    const churchSlug = getChurchSlugFromRequest(request);
    const churchId = await db.resolveChurchId(churchSlug);
    if (!churchId) {
      return NextResponse.json({ error: "Church not found." }, { status: 404 });
    }
    const forbidden = await requireAdminApiPermission("payments:write", churchId);
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
      // Subscription / advance settings (migration 061). All optional;
      // omitted fields fall back to migration defaults the next time
      // the row is read.
      enable_strategy_catch_up_lump,
      enable_strategy_balloon,
      enable_strategy_reslice,
      auto_renew_default,
      year_start_prompt_days,
      catch_up_max_months,
      advance_discount_percent,
    } = body;

    if (!name || amount === undefined) {
      return NextResponse.json(
        { error: "name and amount are required." },
        { status: 400 }
      );
    }

    // Clamp numeric inputs to migration check-constraints so a bad
    // form value returns a clean 400 instead of a Postgres CHECK error.
    const clampedYearStartPromptDays =
      typeof year_start_prompt_days === "number"
        ? Math.min(180, Math.max(1, Math.round(year_start_prompt_days)))
        : undefined;
    const clampedCatchUpMaxMonths =
      typeof catch_up_max_months === "number"
        ? Math.min(12, Math.max(1, Math.round(catch_up_max_months)))
        : undefined;
    const clampedAdvanceDiscount =
      typeof advance_discount_percent === "number"
        ? Math.min(50, Math.max(0, advance_discount_percent))
        : undefined;

    const fees = await db.upsertChurchGiving(churchId, {
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
      ...(typeof enable_strategy_catch_up_lump === "boolean"
        ? { enable_strategy_catch_up_lump }
        : {}),
      ...(typeof enable_strategy_balloon === "boolean"
        ? { enable_strategy_balloon }
        : {}),
      ...(typeof enable_strategy_reslice === "boolean"
        ? { enable_strategy_reslice }
        : {}),
      ...(typeof auto_renew_default === "boolean"
        ? { auto_renew_default }
        : {}),
      ...(clampedYearStartPromptDays !== undefined
        ? { year_start_prompt_days: clampedYearStartPromptDays }
        : {}),
      ...(clampedCatchUpMaxMonths !== undefined
        ? { catch_up_max_months: clampedCatchUpMaxMonths }
        : {}),
      ...(clampedAdvanceDiscount !== undefined
        ? { advance_discount_percent: clampedAdvanceDiscount }
        : {}),
    });

    return NextResponse.json({ fees });
  } catch (e) {
    console.error("Membership fees PUT error:", e);
    return NextResponse.json({ error: "Failed to update fees." }, { status: 500 });
  }
}
