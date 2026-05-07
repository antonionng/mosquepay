import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import * as db from "@/lib/db";
import { getLodgeSlugFromRequest } from "@/lib/tenant";
import {
  requireAdminApiAuth,
  requireAdminApiPermission,
} from "@/lib/auth/api";
import { writeAuditLog } from "@/lib/audit";
import {
  AUTOMATION_KEYS,
  runAllAutomations,
  type AutomationKey,
} from "@/lib/communications/automations";

function isAutomationKey(value: string): value is AutomationKey {
  return (AUTOMATION_KEYS as readonly string[]).includes(value);
}

export async function GET(request: NextRequest) {
  const unauthorized = await requireAdminApiAuth();
  if (unauthorized) return unauthorized;
  if (!isSupabaseConfigured()) return NextResponse.json({ settings: [] });

  const lodgeSlug = getLodgeSlugFromRequest(request);
  const lodgeId = await db.resolveLodgeId(lodgeSlug);
  if (!lodgeId) {
    return NextResponse.json({ error: "Lodge not found." }, { status: 404 });
  }
  const forbidden = await requireAdminApiPermission("members:write", lodgeId);
  if (forbidden) return forbidden;

  const settings = await db.listAutomationSettings(lodgeId);
  return NextResponse.json({ settings });
}

export async function PATCH(request: NextRequest) {
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
  const forbidden = await requireAdminApiPermission("members:write", lodgeId);
  if (forbidden) return forbidden;

  const body = await request.json();
  if (!isAutomationKey(body.automation_key)) {
    return NextResponse.json(
      { error: "Invalid automation_key." },
      { status: 400 }
    );
  }
  const setting = await db.upsertAutomationSetting(
    lodgeId,
    body.automation_key,
    Boolean(body.enabled),
    body.config ?? {}
  );
  await writeAuditLog({
    lodgeId,
    action: "automation_toggled",
    entityType: "automation",
    entityId: lodgeId,
    summary: `Automation ${body.automation_key} ${setting.enabled ? "enabled" : "disabled"}`,
    metadata: { key: setting.automation_key, enabled: setting.enabled },
  });
  return NextResponse.json({ setting });
}

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
  const forbidden = await requireAdminApiPermission("members:write", lodgeId);
  if (forbidden) return forbidden;

  const results = await runAllAutomations(lodgeId);
  await writeAuditLog({
    lodgeId,
    action: "automations_run",
    entityType: "automation",
    entityId: lodgeId,
    summary: `Ran ${results.filter((r) => r.attempted > 0).length} active automations`,
    metadata: { results },
  });
  return NextResponse.json({ results });
}
