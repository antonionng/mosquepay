import {
  DEFAULT_MOSQUE_SLUG,
  getMosqueSlugFromHost,
  resolveMosqueSlug,
} from "@/lib/tenant";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import * as db from "@/lib/db";

/**
 * Server-only helper. Resolves a request hostname to a mosque slug, including
 * custom domain lookups. Do NOT import from middleware; use only from server
 * components and route handlers.
 */
export async function resolveMosqueSlugForHost(
  host?: string | null,
  fallback?: string | null
): Promise<string> {
  if (!host) return fallback ? resolveMosqueSlug(fallback) : DEFAULT_MOSQUE_SLUG;
  const hostname = host.split(":")[0]?.toLowerCase();
  if (!hostname) return fallback ? resolveMosqueSlug(fallback) : DEFAULT_MOSQUE_SLUG;
  const subdomainSlug = getMosqueSlugFromHost(host);
  if (subdomainSlug) return subdomainSlug;
  if (!isSupabaseConfigured()) {
    return fallback ? resolveMosqueSlug(fallback) : DEFAULT_MOSQUE_SLUG;
  }
  try {
    const mosque = await db.getMosqueByCustomDomain(hostname);
    if (mosque?.slug) return mosque.slug;
  } catch {
    // ignore and fall through
  }
  return fallback ? resolveMosqueSlug(fallback) : DEFAULT_MOSQUE_SLUG;
}
