import type { NextRequest } from "next/server";

export const DEFAULT_MOSQUE_SLUG = "central-jamia-demo";
export const ADMIN_MOSQUE_COOKIE = "mosquepay_admin_mosque_slug";
const TENANT_HEADER = "x-mosque-slug";
const RESERVED_SUBDOMAINS = new Set(["www", "app", "admin", "api", "localhost"]);

function normalizeSlug(value?: string | null): string | null {
  if (!value) return null;
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/--+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized.length > 0 ? normalized : null;
}

export function getDefaultMosqueSlug() {
  return DEFAULT_MOSQUE_SLUG;
}

export function resolveMosqueSlug(value?: string | null) {
  return normalizeSlug(value) ?? DEFAULT_MOSQUE_SLUG;
}

export function getMosqueSlugFromHost(host?: string | null): string | null {
  if (!host) return null;
  const hostname = host.split(":")[0]?.toLowerCase();
  if (!hostname || hostname === "localhost") return null;
  if (hostname === "vercel.app" || hostname.endsWith(".vercel.app")) return null;
  const parts = hostname.split(".");
  if (parts.length < 3) return null;
  const subdomain = parts[0];
  if (!subdomain || RESERVED_SUBDOMAINS.has(subdomain)) return null;
  return normalizeSlug(subdomain);
}

export function getMosqueSlugFromRequest(request: NextRequest): string {
  const querySlug = normalizeSlug(request.nextUrl.searchParams.get("mosque"));
  if (querySlug) return querySlug;

  const headerSlug = normalizeSlug(request.headers.get(TENANT_HEADER));
  if (headerSlug) return headerSlug;

  const hostSlug = getMosqueSlugFromHost(request.headers.get("host"));
  if (hostSlug) return hostSlug;

  const adminCookieSlug = normalizeSlug(request.cookies.get(ADMIN_MOSQUE_COOKIE)?.value);
  if (adminCookieSlug) return adminCookieSlug;

  return DEFAULT_MOSQUE_SLUG;
}


