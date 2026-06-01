// POST /api/dues/pay-in-advance
//
// Member portal "charge me now for next year, with the discount" flow.
// Resolves (and creates if absent) the advance dues row and hands off to
// the existing /api/dues/pay surface for the actual Mooov hosted Checkout.
//
// Auth: portal session. The legacy public dues link path uses /api/dues/pay
// directly with a known dues_id; pay-in-advance is portal-only because it
// requires a paid current-year row to confirm eligibility.
//
// All resolve+create logic lives in lib/dues/advance.ts so the in-person
// admin take-payment path can share it.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import * as db from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import {
  checkAdvanceEligibility,
  resolveOrCreateAdvanceDues,
} from "@/lib/dues/advance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Database not configured." },
      { status: 503 }
    );
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user || !user.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Resolve tenant from the authenticated member's home lodge, not from
    // URL/host/cookie. A member of lodge A on lodge B's host (or on the
    // bare lodgepayments.co.uk host) used to fail "Member not found for
    // this lodge" because the URL-derived lodge_id didn't match the
    // member row's lodge_id.
    const member =
      (await db.getMemberByAuthUserId(user.id)) ??
      (await db.getMemberByEmailAcrossLodges(user.email));
    if (!member) {
      return NextResponse.json(
        { error: "Member not found." },
        { status: 403 }
      );
    }
    const lodgeId = member.lodge_id;

    const eligibility = await checkAdvanceEligibility(lodgeId, member);
    if (!eligibility.ok) {
      return NextResponse.json(
        { error: eligibility.message, code: eligibility.code },
        { status: 409 }
      );
    }

    const result = await resolveOrCreateAdvanceDues({
      lodgeId,
      member,
    });

    if (!result.already_existed) {
      await writeAuditLog({
        lodgeId,
        action: "advance_dues_created",
        entityType: "dues",
        entityId: result.member_dues_id,
        summary: `Advance dues created for ${member.email} (${result.next_year_label})`,
        metadata: {
          next_year_label: result.next_year_label,
          base_amount: result.base_amount,
          discount_percent: result.discount_percent,
          charged_amount: result.charged_amount,
          source: "member_portal",
        },
      });
    }

    return NextResponse.json({
      member_dues_id: result.member_dues_id,
      already_existed: result.already_existed,
      next_year_label: result.next_year_label,
      base_amount: result.base_amount,
      amount: result.charged_amount,
      discount_percent: result.discount_percent,
      currency: result.currency,
      status: result.status,
    });
  } catch (e) {
    console.error("dues/pay-in-advance error:", e);
    return NextResponse.json(
      { error: "Could not start advance payment." },
      { status: 500 }
    );
  }
}
