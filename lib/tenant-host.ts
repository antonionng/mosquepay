import {
  DEFAULT_CHURCH_SLUG,
  getChurchSlugFromHost,
  resolveChurchSlug,
} from "@/lib/tenant";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import * as db from "@/lib/db";

/**
 * Server-only helper. Resolves a request hostname to a church slug, including
 * custom domain lookups. Do NOT import from middleware; use only from server
 * components and route handlers.
 */
export async function resolveChurchSlugForHost(
  host?: string | null,
  fallback?: string | null
): Promise<string> {
  if (!host) return fallback ? resolveChurchSlug(fallback) : DEFAULT_CHURCH_SLUG;
  const hostname = host.split(":")[0]?.toLowerCase();
  if (!hostname) return fallback ? resolveChurchSlug(fallback) : DEFAULT_CHURCH_SLUG;
  const subdomainSlug = getChurchSlugFromHost(host);
  if (subdomainSlug) return subdomainSlug;
  if (!isSupabaseConfigured()) {
    return fallback ? resolveChurchSlug(fallback) : DEFAULT_CHURCH_SLUG;
  }
  try {
    const church = await db.getChurchByCustomDomain(hostname);
    if (church?.slug) return church.slug;
  } catch {
    // ignore and fall through
  }
  return fallback ? resolveChurchSlug(fallback) : DEFAULT_CHURCH_SLUG;
}
