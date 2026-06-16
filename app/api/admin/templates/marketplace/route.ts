import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import * as db from "@/lib/db";
import { getMosqueSlugFromRequest } from "@/lib/tenant";
import {
  requireAdminApiAuth,
  requireAdminApiPermission,
} from "@/lib/auth/api";
import { writeAuditLog } from "@/lib/audit";
import { SYSTEM_TEMPLATES } from "@/lib/communications/templates";

export async function GET() {
  return NextResponse.json({ templates: SYSTEM_TEMPLATES });
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

  const body = await request.json().catch(() => ({}));
  const keys: string[] = Array.isArray(body.keys)
    ? body.keys.filter((k: unknown): k is string => typeof k === "string")
    : [];

  if (keys.length === 0) {
    return NextResponse.json({ error: "No template keys provided." }, { status: 400 });
  }

  const installed: Array<{ template_key: string; id: string }> = [];
  for (const key of keys) {
    const tpl = SYSTEM_TEMPLATES.find((t) => t.template_key === key);
    if (!tpl) continue;
    try {
      const row = await db.upsertMessageTemplate(mosqueId, {
        template_key: tpl.template_key,
        name: tpl.name,
        subject: tpl.subject,
        html_body: tpl.html_body,
        channel: "email",
        merge_tags: [...tpl.merge_tags],
        is_system: false,
      });
      installed.push({ template_key: tpl.template_key, id: row.id });
    } catch {
      // ignore individual failures, keep going
    }
  }

  await writeAuditLog({
    mosqueId,
    action: "templates_installed",
    entityType: "message_template",
    entityId: mosqueId,
    summary: `Installed ${installed.length} templates from the marketplace`,
    metadata: { keys },
  });

  return NextResponse.json({ ok: true, installed });
}
