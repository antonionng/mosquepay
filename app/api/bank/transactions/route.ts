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
    return NextResponse.json({ transactions: [] });
  }
  const mosqueSlug = getMosqueSlugFromRequest(request);
  const mosqueId = await db.resolveMosqueId(mosqueSlug);
  if (!mosqueId) {
    return NextResponse.json({ error: "Mosque not found." }, { status: 404 });
  }
  const forbidden = await requireAdminApiPermission("payments:write", mosqueId);
  if (forbidden) return forbidden;

  const importId = request.nextUrl.searchParams.get("import_id") ?? undefined;
  const status = request.nextUrl.searchParams.get("status") as
    | "unmatched"
    | "matched"
    | "ignored"
    | null;

  const transactions = await db.listBankTransactions(mosqueId, {
    importId,
    status: status ?? undefined,
  });
  return NextResponse.json({ transactions });
}
