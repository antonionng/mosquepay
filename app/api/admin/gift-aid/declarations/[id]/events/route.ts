// Append-only event log for a declaration. GET-only -- mutation is
// impossible at the database layer (see migration 059's triggers + REVOKE
// statements). This endpoint exists so the admin Gift Aid detail page can
// render the chain-of-custody timeline.

import { NextRequest, NextResponse } from "next/server";
import * as db from "@/lib/db";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import { getChurchSlugFromRequest } from "@/lib/tenant";
import {
  requireAdminApiAuth,
  requireAdminApiPermission,
} from "@/lib/auth/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const unauthorized = await requireAdminApiAuth();
  if (unauthorized) return unauthorized;
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ events: [] });
  }
  const { id } = await params;
  const churchSlug = getChurchSlugFromRequest(request);
  const churchId = await db.resolveChurchId(churchSlug);
  if (!churchId) {
    return NextResponse.json({ error: "Church not found." }, { status: 404 });
  }
  const forbidden = await requireAdminApiPermission("charity:write", churchId);
  if (forbidden) return forbidden;

  try {
    const events = await db.listGiftAidDeclarationEvents(churchId, id);
    return NextResponse.json({ events });
  } catch (err) {
    console.error("gift-aid declaration events GET failed", {
      declaration_id: id,
      message: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: "Could not load events." },
      { status: 500 }
    );
  }
}
