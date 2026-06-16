import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import * as db from "@/lib/db";
import type { IntegrationProvider } from "@/lib/db/types";
import { getMosqueSlugFromRequest } from "@/lib/tenant";
import {
  requireAdminApiAuth,
  requireAdminApiPermission,
} from "@/lib/auth/api";
import { writeAuditLog } from "@/lib/audit";

const VALID: IntegrationProvider[] = [
  "google_calendar",
  "outlook",
  "mailchimp",
  "brevo",
  "xero",
  "quickbooks",
];

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const unauthorized = await requireAdminApiAuth();
  if (unauthorized) return unauthorized;
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Database not configured." },
      { status: 503 }
    );
  }
  const { provider: providerSlug } = await params;
  if (!VALID.includes(providerSlug as IntegrationProvider)) {
    return NextResponse.json({ error: "Unknown provider." }, { status: 400 });
  }
  const provider = providerSlug as IntegrationProvider;
  const mosqueSlug = getMosqueSlugFromRequest(request);
  const mosqueId = await db.resolveMosqueId(mosqueSlug);
  if (!mosqueId) {
    return NextResponse.json({ error: "Mosque not found." }, { status: 404 });
  }
  // Integrations (Mooov, accounting, calendar, email) are owned by the
  // mosque treasurer in addition to the secretary. Gating on payments:write
  // (which treasurer has, and which admin:all implicitly grants for
  // secretary/super_admin/operator) keeps the API in lockstep with the
  // sidebar visibility gate in components/layout/admin-sidebar.tsx so the
  // treasurer doesn't see the page but get 403s on save.
  const forbidden = await requireAdminApiPermission("payments:write", mosqueId);
  if (forbidden) return forbidden;
  const body = await request.json();
  const cred = await db.upsertIntegrationCredentials(mosqueId, provider, {
    enabled: body.enabled ?? true,
    access_token: body.access_token ?? null,
    refresh_token: body.refresh_token ?? null,
    expires_at: body.expires_at ?? null,
    metadata: body.metadata ?? {},
  });
  await writeAuditLog({
    mosqueId,
    action: cred.enabled ? "integration_enabled" : "integration_disabled",
    entityType: "integration",
    entityId: cred.id,
    summary: `${provider} ${cred.enabled ? "enabled" : "disabled"}`,
  });
  return NextResponse.json({ credential: cred });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const unauthorized = await requireAdminApiAuth();
  if (unauthorized) return unauthorized;
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Database not configured." },
      { status: 503 }
    );
  }
  const { provider: providerSlug } = await params;
  if (!VALID.includes(providerSlug as IntegrationProvider)) {
    return NextResponse.json({ error: "Unknown provider." }, { status: 400 });
  }
  const provider = providerSlug as IntegrationProvider;
  const mosqueSlug = getMosqueSlugFromRequest(request);
  const mosqueId = await db.resolveMosqueId(mosqueSlug);
  if (!mosqueId) {
    return NextResponse.json({ error: "Mosque not found." }, { status: 404 });
  }
  const forbidden = await requireAdminApiPermission("payments:write", mosqueId);
  if (forbidden) return forbidden;
  await db.deleteIntegrationCredentials(mosqueId, provider);
  return NextResponse.json({ ok: true });
}
