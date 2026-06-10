import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import * as db from "@/lib/db";
import { getChurchSlugFromRequest } from "@/lib/tenant";
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
  const churchSlug = getChurchSlugFromRequest(request);
  const churchId = await db.resolveChurchId(churchSlug);
  if (!churchId) {
    return NextResponse.json({ error: "Church not found." }, { status: 404 });
  }
  const forbidden = await requireAdminApiPermission("pastoral:write", churchId);
  if (forbidden) return forbidden;

  const result = await generatePastoralCareAlerts(churchId);
  await writeAuditLog({
    churchId,
    action: "pastoral_alerts_regenerated",
    entityType: "pastoral_alerts",
    entityId: churchId,
    summary: `Regenerated ${result.upserted.length} pastoral alerts`,
    metadata: { count: result.upserted.length },
  });

  return NextResponse.json({
    generated: result.upserted.length,
    alerts: result.upserted,
  });
}
