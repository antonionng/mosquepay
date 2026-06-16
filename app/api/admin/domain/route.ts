import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import * as db from "@/lib/db";
import { getMosqueSlugFromRequest } from "@/lib/tenant";
import {
  requireAdminApiAuth,
  requireAdminApiPermission,
} from "@/lib/auth/api";
import { writeAuditLog } from "@/lib/audit";

const DOMAIN_PATTERN = /^(?!:\/\/)([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}$/;
const PRODUCTION_PLATFORM_HOSTNAME = "mosque-pay.com";

function normalizeHostname(value?: string | null): string | null {
  if (!value) return null;
  try {
    return new URL(value.startsWith("http") ? value : `https://${value}`).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function isLocalHostname(hostname: string | null) {
  if (!hostname) return true;
  return (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname === "127.0.0.1" ||
    hostname === "0.0.0.0"
  );
}

function platformHostname(): string {
  const newcomers = [
    process.env.CUSTOM_DOMAIN_CNAME_TARGET,
    process.env.NEXT_PUBLIC_CUSTOM_DOMAIN_CNAME_TARGET,
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
    PRODUCTION_PLATFORM_HOSTNAME,
  ];
  for (const newcomer of newcomers) {
    const hostname = normalizeHostname(newcomer);
    if (hostname && !isLocalHostname(hostname)) {
      return hostname;
    }
  }
  return PRODUCTION_PLATFORM_HOSTNAME;
}

function freshToken(): string {
  return `mosquepay-domain-verify-${crypto.randomBytes(12).toString("hex")}`;
}

export async function GET(request: NextRequest) {
  const unauthorized = await requireAdminApiAuth();
  if (unauthorized) return unauthorized;
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Database not configured." }, { status: 503 });
  }
  const mosqueSlug = getMosqueSlugFromRequest(request);
  const mosque = await db.getMosqueBySlug(mosqueSlug);
  if (!mosque) {
    return NextResponse.json({ error: "Mosque not found." }, { status: 404 });
  }
  const forbidden = await requireAdminApiPermission("admin:all", mosque.id);
  if (forbidden) return forbidden;

  return NextResponse.json({
    custom_domain: mosque.custom_domain,
    custom_domain_verified_at: mosque.custom_domain_verified_at,
    custom_domain_verification_token: mosque.custom_domain_verification_token,
    cname_target: platformHostname(),
  });
}

export async function PATCH(request: NextRequest) {
  const unauthorized = await requireAdminApiAuth();
  if (unauthorized) return unauthorized;
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Database not configured." }, { status: 503 });
  }
  const mosqueSlug = getMosqueSlugFromRequest(request);
  const mosque = await db.getMosqueBySlug(mosqueSlug);
  if (!mosque) {
    return NextResponse.json({ error: "Mosque not found." }, { status: 404 });
  }
  const forbidden = await requireAdminApiPermission("admin:all", mosque.id);
  if (forbidden) return forbidden;

  const body = await request.json().catch(() => ({}));
  const action = typeof body.action === "string" ? body.action : "";
  const domainRaw = typeof body.domain === "string" ? body.domain.trim().toLowerCase() : "";

  if (action === "remove") {
    const updated = await db.updateMosque(mosque.id, {
      custom_domain: null,
      custom_domain_verified_at: null,
      custom_domain_verification_token: null,
    });
    await writeAuditLog({
      mosqueId: mosque.id,
      action: "custom_domain_removed",
      entityType: "mosque",
      entityId: mosque.id,
      summary: "Custom domain removed",
    });
    return NextResponse.json({ ok: true, mosque: updated });
  }

  if (action === "verify") {
    if (!mosque.custom_domain) {
      return NextResponse.json({ error: "No domain to verify." }, { status: 400 });
    }
    let target = "";
    try {
      const dns = await import("node:dns/promises");
      const records = await dns.resolveCname(mosque.custom_domain);
      target = records[0] ?? "";
    } catch {
      target = "";
    }
    const expected = platformHostname();
    const verified = target.toLowerCase().endsWith(expected.toLowerCase());
    if (!verified) {
      return NextResponse.json(
        {
          ok: false,
          error: `CNAME for ${mosque.custom_domain} should point to ${expected}. Resolved to: ${target || "(no record)"}`,
        },
        { status: 400 }
      );
    }
    const updated = await db.updateMosque(mosque.id, {
      custom_domain_verified_at: new Date().toISOString(),
    });
    await writeAuditLog({
      mosqueId: mosque.id,
      action: "custom_domain_verified",
      entityType: "mosque",
      entityId: mosque.id,
      summary: `Custom domain ${mosque.custom_domain} verified`,
    });
    return NextResponse.json({ ok: true, mosque: updated });
  }

  // Default action: set domain
  if (!domainRaw || !DOMAIN_PATTERN.test(domainRaw)) {
    return NextResponse.json(
      { error: "Enter a valid domain like mosque.example.com." },
      { status: 400 }
    );
  }

  const updated = await db.updateMosque(mosque.id, {
    custom_domain: domainRaw,
    custom_domain_verification_token: freshToken(),
    custom_domain_verified_at: null,
  });

  await writeAuditLog({
    mosqueId: mosque.id,
    action: "custom_domain_added",
    entityType: "mosque",
    entityId: mosque.id,
    summary: `Custom domain set to ${domainRaw}`,
  });

  return NextResponse.json({
    ok: true,
    mosque: updated,
    cname_target: platformHostname(),
  });
}
