import { NextRequest, NextResponse } from "next/server";
import { getCurrentAdminScope } from "@/lib/auth/permissions";
import { requireAdminApiAuth, requireAdminApiPermission } from "@/lib/auth/api";
import { PLAN_DEFINITIONS, isPlanCode } from "@/lib/billing/plans";
import { writeAuditLog } from "@/lib/audit";
import * as db from "@/lib/db";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import { getLodgeSlugFromRequest } from "@/lib/tenant";

export async function POST(request: NextRequest) {
  const unauthorized = await requireAdminApiAuth();
  if (unauthorized) return unauthorized;

  const body = await request.json().catch(() => ({}));
  const targetPlan = typeof body.target_plan === "string" ? body.target_plan : "";
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";

  if (!isPlanCode(targetPlan)) {
    return NextResponse.json(
      { error: "A valid target plan is required." },
      { status: 400 }
    );
  }

  const lodgeSlug = getLodgeSlugFromRequest(request);
  const scope = await getCurrentAdminScope();

  if (!isSupabaseConfigured()) {
    return NextResponse.json({
      ok: true,
      message: "Upgrade request captured in demo mode.",
    });
  }

  const lodgeId = await db.resolveLodgeId(lodgeSlug);
  if (!lodgeId) {
    return NextResponse.json({ error: "Lodge not found." }, { status: 404 });
  }

  const forbidden = await requireAdminApiPermission("admin:all", lodgeId);
  if (forbidden) return forbidden;

  const subscription = await db.getLodgeSubscription(lodgeId);
  const target = PLAN_DEFINITIONS[targetPlan];

  await writeAuditLog({
    lodgeId,
    action: "upgrade_requested",
    entityType: "lodge_subscription",
    entityId: subscription?.id ?? lodgeId,
    summary: `Requested upgrade to ${target.name}`,
    metadata: {
      current_plan: subscription?.plan_code ?? null,
      target_plan: targetPlan,
      reason,
      requested_by:
        scope.kind === "dummy" || scope.kind === "platform" || scope.kind === "lodge"
          ? scope.email
          : null,
    },
  });

  return NextResponse.json({
    ok: true,
    message: `Upgrade request sent for ${target.name}.`,
  });
}
