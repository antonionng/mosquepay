import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import * as db from "@/lib/db";
import { getLodgeSlugFromRequest } from "@/lib/tenant";
import {
  requireAdminApiAuth,
  requireAdminApiPermission,
} from "@/lib/auth/api";
import { generateWelfareAlerts } from "@/lib/welfare/alerts";
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
  const lodgeSlug = getLodgeSlugFromRequest(request);
  const lodgeId = await db.resolveLodgeId(lodgeSlug);
  if (!lodgeId) {
    return NextResponse.json({ error: "Lodge not found." }, { status: 404 });
  }
  const forbidden = await requireAdminApiPermission("welfare:write", lodgeId);
  if (forbidden) return forbidden;

  const result = await generateWelfareAlerts(lodgeId);
  await writeAuditLog({
    lodgeId,
    action: "welfare_alerts_regenerated",
    entityType: "welfare_alerts",
    entityId: lodgeId,
    summary: `Regenerated ${result.upserted.length} welfare alerts`,
    metadata: { count: result.upserted.length },
  });

  return NextResponse.json({
    generated: result.upserted.length,
    alerts: result.upserted,
  });
}
