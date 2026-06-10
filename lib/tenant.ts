import type { NextRequest } from "next/server";

export const DEFAULT_CHURCH_SLUG = "st-marys-demo";
export const ADMIN_CHURCH_COOKIE = "churchpay_admin_church_slug";
const TENANT_HEADER = "x-church-slug";
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

export function getDefaultChurchSlug() {
  return DEFAULT_CHURCH_SLUG;
}

export function resolveChurchSlug(value?: string | null) {
  return normalizeSlug(value) ?? DEFAULT_CHURCH_SLUG;
}

export function getChurchSlugFromHost(host?: string | null): string | null {
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

export function getChurchSlugFromRequest(request: NextRequest): string {
  const querySlug = normalizeSlug(request.nextUrl.searchParams.get("church"));
  if (querySlug) return querySlug;

  const headerSlug = normalizeSlug(request.headers.get(TENANT_HEADER));
  if (headerSlug) return headerSlug;

  const hostSlug = getChurchSlugFromHost(request.headers.get("host"));
  if (hostSlug) return hostSlug;

  const adminCookieSlug = normalizeSlug(request.cookies.get(ADMIN_CHURCH_COOKIE)?.value);
  if (adminCookieSlug) return adminCookieSlug;

  return DEFAULT_CHURCH_SLUG;
}


