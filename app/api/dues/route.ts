import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import * as db from "@/lib/db";
import { getLodgeSlugFromRequest } from "@/lib/tenant";

export async function GET(request: NextRequest) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ dues: [] });
    }

    const lodgeSlug = getLodgeSlugFromRequest(request);
    const lodgeId = await db.resolveLodgeId(lodgeSlug);
    if (!lodgeId) {
      return NextResponse.json({ error: "Lodge not found." }, { status: 404 });
    }

    const memberEmail = request.nextUrl.searchParams.get("member_email") ?? undefined;
    const status = request.nextUrl.searchParams.get("status") ?? undefined;

    const dues = await db.getMemberDues(lodgeId, { memberEmail, status });
    return NextResponse.json({ dues });
  } catch (e) {
    console.error("Dues GET error:", e);
    return NextResponse.json({ error: "Failed to fetch dues." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        { error: "Database not configured." },
        { status: 503 }
      );
    }

    const lodgeSlug = getLodgeSlugFromRequest(request);
    const lodgeId = await db.resolveLodgeId(lodgeSlug);
    if (!lodgeId) {
      return NextResponse.json({ error: "Lodge not found." }, { status: 404 });
    }

    const body = await request.json();
    const {
      member_email,
      member_name,
      dues_id,
      amount,
      currency,
      period_start,
      period_end,
    } = body;

    if (!member_email || !amount || !period_start || !period_end) {
      return NextResponse.json(
        { error: "member_email, amount, period_start, and period_end are required." },
        { status: 400 }
      );
    }

    const record = await db.createMemberDues(lodgeId, {
      member_email,
      member_name: member_name ?? null,
      dues_id: dues_id ?? null,
      amount: Number(amount),
      currency: currency ?? "gbp",
      period_start,
      period_end,
      status: "outstanding",
      payment_id: null,
      stripe_payment_intent_id: null,
      paid_at: null,
    });

    return NextResponse.json({ dues: record }, { status: 201 });
  } catch (e) {
    console.error("Dues POST error:", e);
    return NextResponse.json({ error: "Failed to create dues record." }, { status: 500 });
  }
}
