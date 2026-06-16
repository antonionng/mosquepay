import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isSupabaseConfigured, shouldUseInMemoryMock } from "@/lib/db/with-fallback";
import { getDefaultMosqueId, resolveMosqueId } from "@/lib/db/helpers";
import { getMosqueById } from "@/lib/db";
import { getCurrentAdminScope } from "@/lib/auth/permissions";
import {
  ADMIN_MOSQUE_COOKIE,
  getDefaultMosqueSlug,
  resolveMosqueSlug,
} from "@/lib/tenant";

export { ADMIN_MOSQUE_COOKIE };

/**
 * Admin server pages: use mock data only on the offline demo path (see shouldUseInMemoryMock).
 * When Supabase is configured, always scope reads with mosqueId; if the default mosque is
 * missing, use empty DB paths (never mock) to avoid cross-tenant leakage.
 */
export type AdminReadContext =
  | { mode: "mock" }
  | { mode: "database"; mosqueId: string | null; mosqueSlug: string };

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

  if (scope.kind === "mosque") {
    const selectedCookieSlug = cookieStore.get(ADMIN_MOSQUE_COOKIE)?.value;
    const selectedSlug = selectedCookieSlug
      ? resolveMosqueSlug(selectedCookieSlug)
      : null;
    const selectedMosqueId = selectedSlug ? await resolveMosqueId(selectedSlug) : null;
    const scopedMosqueId =
      selectedMosqueId && scope.mosqueIds.includes(selectedMosqueId)
        ? selectedMosqueId
        : scope.mosqueId;
    const mosque = await getMosqueById(scopedMosqueId);

    return {
      mode: "database",
      mosqueId: scopedMosqueId,
      mosqueSlug: mosque?.slug ?? getDefaultMosqueSlug(),
    };
  }

  const selectedSlug = resolveMosqueSlug(
    cookieStore.get(ADMIN_MOSQUE_COOKIE)?.value ?? getDefaultMosqueSlug()
  );
  const selectedMosqueId = await resolveMosqueId(selectedSlug);

  if (selectedMosqueId) {
    return {
      mode: "database",
      mosqueId: selectedMosqueId,
      mosqueSlug: selectedSlug,
    };
  }

  return {
    mode: "database",
    mosqueId: await getDefaultMosqueId(),
    mosqueSlug: getDefaultMosqueSlug(),
  };
}
