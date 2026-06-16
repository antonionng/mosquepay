import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import * as db from "@/lib/db";
import { getMosqueSlugFromRequest } from "@/lib/tenant";
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

  const mosqueSlug = getMosqueSlugFromRequest(request);
  const mosqueId = await db.resolveMosqueId(mosqueSlug);
  if (!mosqueId) {
    return NextResponse.json({ error: "Mosque not found." }, { status: 404 });
  }
  const forbidden = await requireAdminApiPermission("members:write", mosqueId);
  if (forbidden) return forbidden;

  const settings = await db.listAutomationSettings(mosqueId);
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
  const mosqueSlug = getMosqueSlugFromRequest(request);
  const mosqueId = await db.resolveMosqueId(mosqueSlug);
  if (!mosqueId) {
    return NextResponse.json({ error: "Mosque not found." }, { status: 404 });
  }
  const forbidden = await requireAdminApiPermission("members:write", mosqueId);
  if (forbidden) return forbidden;

  const body = await request.json();
  if (!isAutomationKey(body.automation_key)) {
    return NextResponse.json(
      { error: "Invalid automation_key." },
      { status: 400 }
    );
  }
  const setting = await db.upsertAutomationSetting(
    mosqueId,
    body.automation_key,
    Boolean(body.enabled),
    body.config ?? {}
  );
  await writeAuditLog({
    mosqueId,
    action: "automation_toggled",
    entityType: "automation",
    entityId: mosqueId,
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
  const mosqueSlug = getMosqueSlugFromRequest(request);
  const mosqueId = await db.resolveMosqueId(mosqueSlug);
  if (!mosqueId) {
    return NextResponse.json({ error: "Mosque not found." }, { status: 404 });
  }
  const forbidden = await requireAdminApiPermission("members:write", mosqueId);
  if (forbidden) return forbidden;

  const results = await runAllAutomations(mosqueId);
  await writeAuditLog({
    mosqueId,
    action: "automations_run",
    entityType: "automation",
    entityId: mosqueId,
    summary: `Ran ${results.filter((r) => r.attempted > 0).length} active automations`,
    metadata: { results },
  });
  return NextResponse.json({ results });
}
