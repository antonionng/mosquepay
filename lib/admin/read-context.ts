import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import { getDefaultLodgeId } from "@/lib/db/helpers";

/**
 * Admin server pages: use mock data only when Supabase is not configured.
 * When configured, always scope reads with lodgeId; if the default lodge is
 * missing, use empty DB paths (never mock) to avoid cross-tenant leakage.
 */
export type AdminReadContext =
  | { mode: "mock" }
  | { mode: "database"; lodgeId: string | null };

export async function getAdminReadContext(): Promise<AdminReadContext> {
  if (!isSupabaseConfigured()) {
    return { mode: "mock" };
  }
  return { mode: "database", lodgeId: await getDefaultLodgeId() };
}
