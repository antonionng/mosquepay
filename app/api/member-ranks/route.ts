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
  if (!isSupabaseConfigured()) return NextResponse.json({ ranks: [] });
  const lodgeSlug = getLodgeSlugFromRequest(request);
  const lodgeId = await db.resolveLodgeId(lodgeSlug);
  if (!lodgeId) {
    return NextResponse.json({ error: "Lodge not found." }, { status: 404 });
  }
  const forbidden = await requireAdminApiPermission("members:read", lodgeId);
  if (forbidden) return forbidden;
  const memberId = request.nextUrl.searchParams.get("member_id") ?? undefined;
  return NextResponse.json({
    ranks: await db.listMemberRanks(lodgeId, { memberId }),
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
  const rank = await db.createMemberRank(lodgeId, {
    member_id: body.member_id,
    scope: body.scope ?? "lodge",
    rank_label: body.rank_label,
    conferred_on: body.conferred_on ?? null,
    conferred_by: body.conferred_by ?? null,
    notes: body.notes ?? null,
  });
  return NextResponse.json({ rank }, { status: 201 });
}
