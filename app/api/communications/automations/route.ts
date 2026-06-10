import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import * as db from "@/lib/db";
import { getChurchSlugFromRequest } from "@/lib/tenant";
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

  const churchSlug = getChurchSlugFromRequest(request);
  const churchId = await db.resolveChurchId(churchSlug);
  if (!churchId) {
    return NextResponse.json({ error: "Church not found." }, { status: 404 });
  }
  const forbidden = await requireAdminApiPermission("members:write", churchId);
  if (forbidden) return forbidden;

  const settings = await db.listAutomationSettings(churchId);
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
  const churchSlug = getChurchSlugFromRequest(request);
  const churchId = await db.resolveChurchId(churchSlug);
  if (!churchId) {
    return NextResponse.json({ error: "Church not found." }, { status: 404 });
  }
  const forbidden = await requireAdminApiPermission("members:write", churchId);
  if (forbidden) return forbidden;

  const body = await request.json();
  if (!isAutomationKey(body.automation_key)) {
    return NextResponse.json(
      { error: "Invalid automation_key." },
      { status: 400 }
    );
  }
  const setting = await db.upsertAutomationSetting(
    churchId,
    body.automation_key,
    Boolean(body.enabled),
    body.config ?? {}
  );
  await writeAuditLog({
    churchId,
    action: "automation_toggled",
    entityType: "automation",
    entityId: churchId,
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
  const churchSlug = getChurchSlugFromRequest(request);
  const churchId = await db.resolveChurchId(churchSlug);
  if (!churchId) {
    return NextResponse.json({ error: "Church not found." }, { status: 404 });
  }
  const forbidden = await requireAdminApiPermission("members:write", churchId);
  if (forbidden) return forbidden;

  const results = await runAllAutomations(churchId);
  await writeAuditLog({
    churchId,
    action: "automations_run",
    entityType: "automation",
    entityId: churchId,
    summary: `Ran ${results.filter((r) => r.attempted > 0).length} active automations`,
    metadata: { results },
  });
  return NextResponse.json({ results });
}
