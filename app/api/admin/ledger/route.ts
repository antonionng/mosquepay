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

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ entries: [] });
  }

  const lodgeSlug = getLodgeSlugFromRequest(request);
  const lodgeId = await db.resolveLodgeId(lodgeSlug);
  if (!lodgeId) {
    return NextResponse.json({ error: "Lodge not found." }, { status: 404 });
  }

  const forbidden = await requireAdminApiPermission("payments:write", lodgeId);
  if (forbidden) return forbidden;

  const url = request.nextUrl;
  const from = url.searchParams.get("from") ?? undefined;
  const to = url.searchParams.get("to") ?? undefined;
  const sourceTypesParam = url.searchParams.get("source_types");
  const sourceTypes = sourceTypesParam
    ? (sourceTypesParam.split(",").filter((s) =>
        ["payment", "dues", "donation"].includes(s)
      ) as Array<"payment" | "dues" | "donation">)
    : undefined;

  const entries = await db.getTreasurerLedger(lodgeId, {
    from,
    to,
    sourceTypes,
  });

  return NextResponse.json({ entries });
}
