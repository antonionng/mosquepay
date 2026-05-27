import { NextRequest, NextResponse } from "next/server";
import { ADMIN_LODGE_COOKIE } from "@/lib/admin/read-context";
import { getCurrentAdminScope } from "@/lib/auth/permissions";
import { isSupabaseConfigured, shouldUseInMemoryMock } from "@/lib/db/with-fallback";
import * as db from "@/lib/db";
import * as mockDb from "@/lib/mock-db";
import { getDefaultLodgeSlug, resolveLodgeSlug } from "@/lib/tenant";
import type { Lodge } from "@/lib/db/types";

async function listAllLodges(): Promise<Lodge[]> {
  if (isSupabaseConfigured()) return db.listLodges();
  if (!shouldUseInMemoryMock()) return [];
  return mockDb.listLodges() as Lodge[];
}

async function getLodgeById(id: string): Promise<Lodge | null> {
  if (isSupabaseConfigured()) return db.getLodgeById(id);
  return null;
}

async function getLodgeBySlug(slug: string): Promise<Lodge | null> {
  if (isSupabaseConfigured()) return db.getLodgeBySlug(slug);
  if (!shouldUseInMemoryMock()) return null;
  return mockDb.getLodgeBySlug(slug) as Lodge | null;
}

/** Returns the lodges the actor may view and switch to, plus their default slug. */
async function resolveAccessibleLodges(): Promise<
  | { error: NextResponse }
  | { lodges: Lodge[]; defaultSlug: string; isPlatform: boolean }
> {
  const scope = await getCurrentAdminScope();
  if (scope.kind === "none") {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  if (scope.kind === "dummy" || scope.kind === "platform") {
    const all = await listAllLodges();
    const active = all.filter((lodge) => lodge.is_active);
    return {
      lodges: active,
      defaultSlug: getDefaultLodgeSlug(),
      isPlatform: true,
    };
  }

  const lodges = (
    await Promise.all(scope.lodgeIds.map((lodgeId) => getLodgeById(lodgeId)))
  ).filter((lodge): lodge is Lodge => Boolean(lodge && lodge.is_active));
  if (lodges.length === 0) {
    return {
      error: NextResponse.json(
        { error: "No active lodge memberships found." },
        { status: 404 }
      ),
    };
  }
  const primary = lodges.find((lodge) => lodge.id === scope.lodgeId) ?? lodges[0];
  return { lodges, defaultSlug: primary.slug, isPlatform: false };
}

export async function GET(request: NextRequest) {
  const access = await resolveAccessibleLodges();
  if ("error" in access) return access.error;

  const cookieSlug = request.cookies.get(ADMIN_LODGE_COOKIE)?.value;
  const allowedSlugs = new Set(access.lodges.map((lodge) => lodge.slug));

  let selectedSlug = cookieSlug && allowedSlugs.has(cookieSlug)
    ? cookieSlug
    : access.defaultSlug;
  if (!allowedSlugs.has(selectedSlug)) {
    selectedSlug = access.lodges[0]?.slug ?? selectedSlug;
  }

  const selectedLodge =
    access.lodges.find((lodge) => lodge.slug === selectedSlug) ??
    access.lodges[0] ??
    null;

  const response = NextResponse.json({
    selectedSlug: selectedLodge?.slug ?? selectedSlug,
    selectedLodge,
    lodges: access.lodges,
    isPlatform: access.isPlatform,
  });

  // Self-heal a stale or missing ADMIN_LODGE_COOKIE for lodge-scoped admins.
  // The admin shell polls this endpoint on every navigation, so by the time
  // the user clicks anything that hits an API write route (which resolves
  // the lodge via getLodgeSlugFromRequest -> cookie) the cookie is anchored
  // to a lodge the actor actually administers. This is the backstop for
  // sessions established before login started writing the cookie itself,
  // and for cases where a previous user left a stale value behind.
  //
  // Platform admins are intentionally left alone: the lodge switcher /
  // POST handler is the only thing that should set their cookie, since
  // their "no cookie" state means "show me the global view".
  if (!access.isPlatform && selectedLodge && cookieSlug !== selectedLodge.slug) {
    response.cookies.set(ADMIN_LODGE_COOKIE, selectedLodge.slug, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30,
      path: "/",
    });
  } else if (access.isPlatform && cookieSlug && !allowedSlugs.has(cookieSlug)) {
    // Platform admin with a cookie that points at a non-existent lodge --
    // clear it so the switcher reflects the global view again.
    response.cookies.delete(ADMIN_LODGE_COOKIE);
  }

  return response;
}

export async function POST(request: NextRequest) {
  const access = await resolveAccessibleLodges();
  if ("error" in access) return access.error;

  const body = await request.json().catch(() => ({}));
  const rawSlug = typeof body.lodge_slug === "string" ? body.lodge_slug.trim() : "";

  if (!rawSlug && access.isPlatform) {
    const response = NextResponse.json({
      success: true,
      selectedSlug: null,
      selectedLodge: null,
      isPlatform: true,
    });
    response.cookies.delete(ADMIN_LODGE_COOKIE);
    return response;
  }

  const requestedSlug = resolveLodgeSlug(rawSlug);
  const allowedSlugs = new Set(access.lodges.map((lodge) => lodge.slug));

  if (!allowedSlugs.has(requestedSlug)) {
    return NextResponse.json(
      { error: "You do not have access to that lodge." },
      { status: 403 }
    );
  }

  const lodge =
    access.lodges.find((entry) => entry.slug === requestedSlug) ??
    (await getLodgeBySlug(requestedSlug));

  if (!lodge) {
    return NextResponse.json({ error: "Lodge not found." }, { status: 404 });
  }

  const response = NextResponse.json({
    success: true,
    selectedSlug: lodge.slug,
    selectedLodge: lodge,
    isPlatform: access.isPlatform,
  });
  response.cookies.set(ADMIN_LODGE_COOKIE, lodge.slug, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
  return response;
}
