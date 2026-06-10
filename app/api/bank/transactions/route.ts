import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import * as db from "@/lib/db";
import { getChurchSlugFromRequest } from "@/lib/tenant";
import {
  requireAdminApiAuth,
  requireAdminApiPermission,
} from "@/lib/auth/api";

export async function GET(request: NextRequest) {
  const unauthorized = await requireAdminApiAuth();
  if (unauthorized) return unauthorized;
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ transactions: [] });
  }
  const churchSlug = getChurchSlugFromRequest(request);
  const churchId = await db.resolveChurchId(churchSlug);
  if (!churchId) {
    return NextResponse.json({ error: "Church not found." }, { status: 404 });
  }
  const forbidden = await requireAdminApiPermission("payments:write", churchId);
  if (forbidden) return forbidden;

  const importId = request.nextUrl.searchParams.get("import_id") ?? undefined;
  const status = request.nextUrl.searchParams.get("status") as
    | "unmatched"
    | "matched"
    | "ignored"
    | null;

  const transactions = await db.listBankTransactions(churchId, {
    importId,
    status: status ?? undefined,
  });
  return NextResponse.json({ transactions });
}
