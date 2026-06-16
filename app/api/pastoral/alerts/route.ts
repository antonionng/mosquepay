import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import * as db from "@/lib/db";
import { getMosqueSlugFromRequest } from "@/lib/tenant";
import {
  requireAdminApiAuth,
  requireAdminApiPermission,
} from "@/lib/auth/api";
import { generatePastoralCareAlerts } from "@/lib/pastoral/alerts";
import { writeAuditLog } from "@/lib/audit";

export async function POST(request: NextRequest) {
  const unauthorized = await requireAdminApiAuth();
  if (unauthorized) return unauthorized;
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Database not configured." },
      { status: 503 }
    );
  }
  const mosqueSlug = getMosqueSlugFromRequest(request);
  const mosqueId = await db.resolveMosqueId(mosqueSlug);
  if (!mosqueId) {
    return NextResponse.json({ error: "Mosque not found." }, { status: 404 });
  }
  const forbidden = await requireAdminApiPermission("pastoral:write", mosqueId);
  if (forbidden) return forbidden;

  const result = await generatePastoralCareAlerts(mosqueId);
  await writeAuditLog({
    mosqueId,
    action: "pastoral_alerts_regenerated",
    entityType: "pastoral_alerts",
    entityId: mosqueId,
    summary: `Regenerated ${result.upserted.length} pastoral alerts`,
    metadata: { count: result.upserted.length },
  });

  return NextResponse.json({
    generated: result.upserted.length,
    alerts: result.upserted,
  });
}
