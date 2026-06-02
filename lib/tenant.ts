import type { NextRequest } from "next/server";

export const DEFAULT_LODGE_SLUG = "covenant-4344";
export const ADMIN_LODGE_COOKIE = "covenant_admin_lodge_slug";
const TENANT_HEADER = "x-lodge-slug";
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

export function getDefaultLodgeSlug() {
  return DEFAULT_LODGE_SLUG;
}

export function resolveLodgeSlug(value?: string | null) {
  return normalizeSlug(value) ?? DEFAULT_LODGE_SLUG;
}

export function getLodgeSlugFromHost(host?: string | null): string | null {
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

export function getLodgeSlugFromRequest(request: NextRequest): string {
  const querySlug = normalizeSlug(request.nextUrl.searchParams.get("lodge"));
  if (querySlug) return querySlug;

  const headerSlug = normalizeSlug(request.headers.get(TENANT_HEADER));
  if (headerSlug) return headerSlug;

  const hostSlug = getLodgeSlugFromHost(request.headers.get("host"));
  if (hostSlug) return hostSlug;

  const adminCookieSlug = normalizeSlug(request.cookies.get(ADMIN_LODGE_COOKIE)?.value);
  if (adminCookieSlug) return adminCookieSlug;

  return DEFAULT_LODGE_SLUG;
}


