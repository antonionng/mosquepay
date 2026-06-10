import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isSupabaseConfigured, shouldUseInMemoryMock } from "@/lib/db/with-fallback";
import { getDefaultChurchId, resolveChurchId } from "@/lib/db/helpers";
import { getChurchById } from "@/lib/db";
import { getCurrentAdminScope } from "@/lib/auth/permissions";
import {
  ADMIN_CHURCH_COOKIE,
  getDefaultChurchSlug,
  resolveChurchSlug,
} from "@/lib/tenant";

export { ADMIN_CHURCH_COOKIE };

/**
 * Admin server pages: use mock data only on the offline demo path (see shouldUseInMemoryMock).
 * When Supabase is configured, always scope reads with churchId; if the default church is
 * missing, use empty DB paths (never mock) to avoid cross-tenant leakage.
 */
export type AdminReadContext =
  | { mode: "mock" }
  | { mode: "database"; churchId: string | null; churchSlug: string };

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

  if (scope.kind === "church") {
    const selectedCookieSlug = cookieStore.get(ADMIN_CHURCH_COOKIE)?.value;
    const selectedSlug = selectedCookieSlug
      ? resolveChurchSlug(selectedCookieSlug)
      : null;
    const selectedChurchId = selectedSlug ? await resolveChurchId(selectedSlug) : null;
    const scopedChurchId =
      selectedChurchId && scope.churchIds.includes(selectedChurchId)
        ? selectedChurchId
        : scope.churchId;
    const church = await getChurchById(scopedChurchId);

    return {
      mode: "database",
      churchId: scopedChurchId,
      churchSlug: church?.slug ?? getDefaultChurchSlug(),
    };
  }

  const selectedSlug = resolveChurchSlug(
    cookieStore.get(ADMIN_CHURCH_COOKIE)?.value ?? getDefaultChurchSlug()
  );
  const selectedChurchId = await resolveChurchId(selectedSlug);

  if (selectedChurchId) {
    return {
      mode: "database",
      churchId: selectedChurchId,
      churchSlug: selectedSlug,
    };
  }

  return {
    mode: "database",
    churchId: await getDefaultChurchId(),
    churchSlug: getDefaultChurchSlug(),
  };
}
