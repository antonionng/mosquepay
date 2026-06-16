import { NextRequest, NextResponse } from "next/server";
import { ADMIN_MOSQUE_COOKIE } from "@/lib/admin/read-context";
import { getCurrentAdminScope } from "@/lib/auth/permissions";
import { isSupabaseConfigured, shouldUseInMemoryMock } from "@/lib/db/with-fallback";
import * as db from "@/lib/db";
import * as mockDb from "@/lib/mock-db";
import { getDefaultMosqueSlug, resolveMosqueSlug } from "@/lib/tenant";
import type { Mosque } from "@/lib/db/types";

async function listAllMosques(): Promise<Mosque[]> {
  if (isSupabaseConfigured()) return db.listMosques();
  if (!shouldUseInMemoryMock()) return [];
  return mockDb.listMosques() as Mosque[];
}

async function getMosqueById(id: string): Promise<Mosque | null> {
  if (isSupabaseConfigured()) return db.getMosqueById(id);
  return null;
}

async function getMosqueBySlug(slug: string): Promise<Mosque | null> {
  if (isSupabaseConfigured()) return db.getMosqueBySlug(slug);
  if (!shouldUseInMemoryMock()) return null;
  return mockDb.getMosqueBySlug(slug) as Mosque | null;
}

/** Returns the mosques the actor may view and switch to, plus their default slug. */
async function resolveAccessibleMosques(): Promise<
  | { error: NextResponse }
  | { mosques: Mosque[]; defaultSlug: string; isPlatform: boolean }
> {
  const scope = await getCurrentAdminScope();
  if (scope.kind === "none") {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  if (scope.kind === "dummy" || scope.kind === "platform") {
    const all = await listAllMosques();
    const active = all.filter((mosque) => mosque.is_active);
    return {
      mosques: active,
      defaultSlug: getDefaultMosqueSlug(),
      isPlatform: true,
    };
  }

  const mosques = (
    await Promise.all(scope.mosqueIds.map((mosqueId) => getMosqueById(mosqueId)))
  ).filter((mosque): mosque is Mosque => Boolean(mosque && mosque.is_active));
  if (mosques.length === 0) {
    return {
      error: NextResponse.json(
        { error: "No active mosque memberships found." },
        { status: 404 }
      ),
    };
  }
  const primary = mosques.find((mosque) => mosque.id === scope.mosqueId) ?? mosques[0];
  return { mosques, defaultSlug: primary.slug, isPlatform: false };
}

export async function GET(request: NextRequest) {
  const access = await resolveAccessibleMosques();
  if ("error" in access) return access.error;

  const cookieSlug = request.cookies.get(ADMIN_MOSQUE_COOKIE)?.value;
  const allowedSlugs = new Set(access.mosques.map((mosque) => mosque.slug));

  let selectedSlug = cookieSlug && allowedSlugs.has(cookieSlug)
    ? cookieSlug
    : access.defaultSlug;
  if (!allowedSlugs.has(selectedSlug)) {
    selectedSlug = access.mosques[0]?.slug ?? selectedSlug;
  }

  const selectedMosque =
    access.mosques.find((mosque) => mosque.slug === selectedSlug) ??
    access.mosques[0] ??
    null;

  const response = NextResponse.json({
    selectedSlug: selectedMosque?.slug ?? selectedSlug,
    selectedMosque,
    mosques: access.mosques,
    isPlatform: access.isPlatform,
  });

  // Self-heal a stale or missing ADMIN_MOSQUE_COOKIE for mosque-scoped admins.
  // The admin shell polls this endpoint on every navigation, so by the time
  // the user clicks anything that hits an API write route (which resolves
  // the mosque via getMosqueSlugFromRequest -> cookie) the cookie is anchored
  // to a mosque the actor actually administers. This is the backstop for
  // sessions established before login started writing the cookie itself,
  // and for cases where a previous user left a stale value behind.
  //
  // Platform admins are intentionally left alone: the mosque switcher /
  // POST handler is the only thing that should set their cookie, since
  // their "no cookie" state means "show me the global view".
  if (!access.isPlatform && selectedMosque && cookieSlug !== selectedMosque.slug) {
    response.cookies.set(ADMIN_MOSQUE_COOKIE, selectedMosque.slug, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30,
      path: "/",
    });
  } else if (access.isPlatform && cookieSlug && !allowedSlugs.has(cookieSlug)) {
    // Platform admin with a cookie that points at a non-existent mosque --
    // clear it so the switcher reflects the global view again.
    response.cookies.delete(ADMIN_MOSQUE_COOKIE);
  }

  return response;
}

export async function POST(request: NextRequest) {
  const access = await resolveAccessibleMosques();
  if ("error" in access) return access.error;

  const body = await request.json().catch(() => ({}));
  const rawSlug = typeof body.mosque_slug === "string" ? body.mosque_slug.trim() : "";

  if (!rawSlug && access.isPlatform) {
    const response = NextResponse.json({
      success: true,
      selectedSlug: null,
      selectedMosque: null,
      isPlatform: true,
    });
    response.cookies.delete(ADMIN_MOSQUE_COOKIE);
    return response;
  }

  const requestedSlug = resolveMosqueSlug(rawSlug);
  const allowedSlugs = new Set(access.mosques.map((mosque) => mosque.slug));

  if (!allowedSlugs.has(requestedSlug)) {
    return NextResponse.json(
      { error: "You do not have access to that mosque." },
      { status: 403 }
    );
  }

  const mosque =
    access.mosques.find((entry) => entry.slug === requestedSlug) ??
    (await getMosqueBySlug(requestedSlug));

  if (!mosque) {
    return NextResponse.json({ error: "Mosque not found." }, { status: 404 });
  }

  const response = NextResponse.json({
    success: true,
    selectedSlug: mosque.slug,
    selectedMosque: mosque,
    isPlatform: access.isPlatform,
  });
  response.cookies.set(ADMIN_MOSQUE_COOKIE, mosque.slug, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
  return response;
}
