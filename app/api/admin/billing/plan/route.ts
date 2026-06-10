import { NextRequest, NextResponse } from "next/server";
import { requireAdminApiAuth, requireAdminApiPermission } from "@/lib/auth/api";
import {
  ENTITLEMENT_KEYS,
  PLAN_DEFINITIONS,
  entitlementsForPlan,
  getPlanDefinition,
  normalizePlanCode,
  requiredPlanForEntitlement,
} from "@/lib/billing/plans";
import * as db from "@/lib/db";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import { getChurchSlugFromRequest } from "@/lib/tenant";

export async function GET(request: NextRequest) {
  const unauthorized = await requireAdminApiAuth();
  if (unauthorized) return unauthorized;

  const churchSlug = getChurchSlugFromRequest(request);

  if (!isSupabaseConfigured()) {
    const plan = getPlanDefinition("church_essentials");
    const entitlements = entitlementsForPlan(plan.code);
    return NextResponse.json({
      plan,
      subscription: null,
      entitlements,
      locked: lockedEntitlements(plan.code),
      plans: Object.values(PLAN_DEFINITIONS),
    });
  }

  const churchId = await db.resolveChurchId(churchSlug);
  if (!churchId) {
    return NextResponse.json({ error: "Church not found." }, { status: 404 });
  }

  const forbidden = await requireAdminApiPermission("admin:all", churchId);
  if (forbidden) return forbidden;

  const subscription = await db.getChurchSubscription(churchId);
  const planCode = normalizePlanCode(subscription?.plan_code);
  const plan = getPlanDefinition(planCode);
  const entitlements = entitlementsForPlan(planCode);
  const overrides = await db.listChurchFeatureFlags(churchId).catch(() => []);

  for (const override of overrides) {
    entitlements[override.flag_key as keyof typeof entitlements] = override.enabled;
  }

  entitlements.charity =
    entitlements.charity ??
    (entitlements.charity_campaigns || entitlements.gift_aid || entitlements.gasds);

  return NextResponse.json({
    plan,
    subscription,
    entitlements,
    locked: lockedEntitlements(planCode),
    plans: Object.values(PLAN_DEFINITIONS),
  });
}

function lockedEntitlements(planCode: string) {
  const entitlements = entitlementsForPlan(planCode);
  return ENTITLEMENT_KEYS.filter((key) => !entitlements[key]).map((key) => ({
    key,
    requiredPlan: requiredPlanForEntitlement(key),
  }));
}
