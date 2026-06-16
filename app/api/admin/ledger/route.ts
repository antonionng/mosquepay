import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import * as db from "@/lib/db";
import { getMosqueSlugFromRequest } from "@/lib/tenant";
import {
  requireAdminApiAuth,
  requireAdminApiPermission,
} from "@/lib/auth/api";

export async function GET(request: NextRequest) {
  const unauthorized = await requireAdminApiAuth();
  if (unauthorized) return unauthorized;

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ entries: [] });
  }

  const mosqueSlug = getMosqueSlugFromRequest(request);
  const mosqueId = await db.resolveMosqueId(mosqueSlug);
  if (!mosqueId) {
    return NextResponse.json({ error: "Mosque not found." }, { status: 404 });
  }

  const forbidden = await requireAdminApiPermission("payments:write", mosqueId);
  if (forbidden) return forbidden;

  const url = request.nextUrl;
  const from = url.searchParams.get("from") ?? undefined;
  const to = url.searchParams.get("to") ?? undefined;
  const sourceTypesParam = url.searchParams.get("source_types");
  const sourceTypes = sourceTypesParam
    ? (sourceTypesParam.split(",").filter((s) =>
        ["payment", "giving", "donation"].includes(s)
      ) as Array<"payment" | "giving" | "donation">)
    : undefined;

  const entries = await db.getTreasurerLedger(mosqueId, {
    from,
    to,
    sourceTypes,
  });

  return NextResponse.json({ entries });
}
