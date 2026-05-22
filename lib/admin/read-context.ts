import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isSupabaseConfigured, shouldUseInMemoryMock } from "@/lib/db/with-fallback";
import { getDefaultLodgeId, resolveLodgeId } from "@/lib/db/helpers";
import { getLodgeById } from "@/lib/db";
import { getCurrentAdminScope } from "@/lib/auth/permissions";
import {
  ADMIN_LODGE_COOKIE,
  getDefaultLodgeSlug,
  resolveLodgeSlug,
} from "@/lib/tenant";

export { ADMIN_LODGE_COOKIE };

/**
 * Admin server pages: use mock data only on the offline demo path (see shouldUseInMemoryMock).
 * When Supabase is configured, always scope reads with lodgeId; if the default lodge is
 * missing, use empty DB paths (never mock) to avoid cross-tenant leakage.
 */
export type AdminReadContext =
  | { mode: "mock" }
  | { mode: "database"; lodgeId: string | null; lodgeSlug: string };

export async function getAdminReadContext(): Promise<AdminReadContext> {
  const scope = await getCurrentAdminScope();
  if (scope.kind === "none") {
    redirect("/admin/login");
  }

  if (shouldUseInMemoryMock()) {
    return { mode: "mock" };
  }

  if (!isSupabaseConfigured()) {
    throw new Error(
      "Supabase is not configured but in-memory mock is disabled (ALLOW_IN_MEMORY_MOCK=false). " +
        "Set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY, " +
        "or set ALLOW_IN_MEMORY_MOCK=true for offline demo mode."
    );
  }

  const cookieStore = await cookies();

  if (scope.kind === "lodge") {
    const selectedCookieSlug = cookieStore.get(ADMIN_LODGE_COOKIE)?.value;
    const selectedSlug = selectedCookieSlug
      ? resolveLodgeSlug(selectedCookieSlug)
      : null;
    const selectedLodgeId = selectedSlug ? await resolveLodgeId(selectedSlug) : null;
    const scopedLodgeId =
      selectedLodgeId && scope.lodgeIds.includes(selectedLodgeId)
        ? selectedLodgeId
        : scope.lodgeId;
    const lodge = await getLodgeById(scopedLodgeId);

    return {
      mode: "database",
      lodgeId: scopedLodgeId,
      lodgeSlug: lodge?.slug ?? getDefaultLodgeSlug(),
    };
  }

  const selectedSlug = resolveLodgeSlug(
    cookieStore.get(ADMIN_LODGE_COOKIE)?.value ?? getDefaultLodgeSlug()
  );
  const selectedLodgeId = await resolveLodgeId(selectedSlug);

  if (selectedLodgeId) {
    return {
      mode: "database",
      lodgeId: selectedLodgeId,
      lodgeSlug: selectedSlug,
    };
  }

  return {
    mode: "database",
    lodgeId: await getDefaultLodgeId(),
    lodgeSlug: getDefaultLodgeSlug(),
  };
}
