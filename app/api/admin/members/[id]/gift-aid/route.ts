// GET the active Gift Aid declaration for a single member.
//
// Used by the admin member profile's Gift Aid panel to refresh state
// after a paper upload without re-rendering the whole page. Returns
// `{ declaration: null }` when nothing is on file -- never 404s so the
// client can drive the empty state without special-casing.

import { NextRequest, NextResponse } from "next/server";
import * as db from "@/lib/db";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import { getLodgeSlugFromRequest } from "@/lib/tenant";
import {
  requireAdminApiAuth,
  requireAdminApiPermission,
} from "@/lib/auth/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const unauthorized = await requireAdminApiAuth();
  if (unauthorized) return unauthorized;
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ declaration: null });
  }
  const { id: memberId } = await params;
  const lodgeSlug = getLodgeSlugFromRequest(request);
  const lodgeId = await db.resolveLodgeId(lodgeSlug);
  if (!lodgeId) {
    return NextResponse.json({ error: "Lodge not found." }, { status: 404 });
  }
  // Read-only against members -- members:read is the right scope. Charity
  // scope is required only for write surfaces (upload / revoke).
  const forbidden = await requireAdminApiPermission("members:read", lodgeId);
  if (forbidden) return forbidden;

  const member = await db.getMemberById(memberId, lodgeId);
  if (!member) {
    return NextResponse.json({ error: "Member not found." }, { status: 404 });
  }

  const declaration = await db.getActiveGiftAidDeclarationByMember(lodgeId, {
    id: member.id,
    email: member.email,
  });

  return NextResponse.json({ declaration });
}
