import {
  DEFAULT_LODGE_SLUG,
  getLodgeSlugFromHost,
  resolveLodgeSlug,
} from "@/lib/tenant";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import * as db from "@/lib/db";

/**
 * Server-only helper. Resolves a request hostname to a lodge slug, including
 * custom domain lookups. Do NOT import from middleware; use only from server
 * components and route handlers.
 */
export async function resolveLodgeSlugForHost(
  host?: string | null,
  fallback?: string | null
): Promise<string> {
  if (!host) return fallback ? resolveLodgeSlug(fallback) : DEFAULT_LODGE_SLUG;
  const hostname = host.split(":")[0]?.toLowerCase();
  if (!hostname) return fallback ? resolveLodgeSlug(fallback) : DEFAULT_LODGE_SLUG;
  const subdomainSlug = getLodgeSlugFromHost(host);
  if (subdomainSlug) return subdomainSlug;
  if (!isSupabaseConfigured()) {
    return fallback ? resolveLodgeSlug(fallback) : DEFAULT_LODGE_SLUG;
  }
  try {
    const lodge = await db.getLodgeByCustomDomain(hostname);
    if (lodge?.slug) return lodge.slug;
  } catch {
    // ignore and fall through
  }
  return fallback ? resolveLodgeSlug(fallback) : DEFAULT_LODGE_SLUG;
}
