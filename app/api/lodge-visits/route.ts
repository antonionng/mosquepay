import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import * as db from "@/lib/db";
import { getLodgeSlugFromRequest } from "@/lib/tenant";
import {
  requireAdminApiAuth,
  requireAdminApiPermission,
} from "@/lib/auth/api";

export async function GET(request: NextRequest) {
  const unauthorized = await requireAdminApiAuth();
  if (unauthorized) return unauthorized;
  if (!isSupabaseConfigured()) return NextResponse.json({ visits: [] });
  const lodgeSlug = getLodgeSlugFromRequest(request);
  const lodgeId = await db.resolveLodgeId(lodgeSlug);
  if (!lodgeId) {
    return NextResponse.json({ error: "Lodge not found." }, { status: 404 });
  }
  const forbidden = await requireAdminApiPermission("members:read", lodgeId);
  if (forbidden) return forbidden;
  const limit = Number(request.nextUrl.searchParams.get("limit") ?? 200);
  return NextResponse.json({
    visits: await db.listLodgeVisits(lodgeId, { limit }),
  });
}

export async function POST(request: NextRequest) {
  const unauthorized = await requireAdminApiAuth();
  if (unauthorized) return unauthorized;
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
  const forbidden = await requireAdminApiPermission("members:write", lodgeId);
  if (forbidden) return forbidden;
  const body = await request.json();
  const visit = await db.createLodgeVisit({
    visiting_lodge_id: lodgeId,
    host_lodge_id: body.host_lodge_id ?? null,
    host_lodge_name: body.host_lodge_name ?? null,
    member_id: body.member_id ?? null,
    member_name: body.member_name ?? null,
    visit_date: body.visit_date,
    occasion: body.occasion ?? null,
    notes: body.notes ?? null,
    recorded_by_admin_user_id: null,
  });
  return NextResponse.json({ visit }, { status: 201 });
}
