import { NextRequest, NextResponse } from "next/server";
import { ADMIN_CHURCH_COOKIE } from "@/lib/admin/read-context";
import { getCurrentAdminScope } from "@/lib/auth/permissions";
import { isSupabaseConfigured, shouldUseInMemoryMock } from "@/lib/db/with-fallback";
import * as db from "@/lib/db";
import * as mockDb from "@/lib/mock-db";
import { getDefaultChurchSlug, resolveChurchSlug } from "@/lib/tenant";
import type { Church } from "@/lib/db/types";

async function listAllChurches(): Promise<Church[]> {
  if (isSupabaseConfigured()) return db.listChurches();
  if (!shouldUseInMemoryMock()) return [];
  return mockDb.listChurches() as Church[];
}

async function getChurchById(id: string): Promise<Church | null> {
  if (isSupabaseConfigured()) return db.getChurchById(id);
  return null;
}

async function getChurchBySlug(slug: string): Promise<Church | null> {
  if (isSupabaseConfigured()) return db.getChurchBySlug(slug);
  if (!shouldUseInMemoryMock()) return null;
  return mockDb.getChurchBySlug(slug) as Church | null;
}

/** Returns the churches the actor may view and switch to, plus their default slug. */
async function resolveAccessibleChurches(): Promise<
  | { error: NextResponse }
  | { churches: Church[]; defaultSlug: string; isPlatform: boolean }
> {
  const scope = await getCurrentAdminScope();
  if (scope.kind === "none") {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  if (scope.kind === "dummy" || scope.kind === "platform") {
    const all = await listAllChurches();
    const active = all.filter((church) => church.is_active);
    return {
      churches: active,
      defaultSlug: getDefaultChurchSlug(),
      isPlatform: true,
    };
  }

  const churches = (
    await Promise.all(scope.churchIds.map((churchId) => getChurchById(churchId)))
  ).filter((church): church is Church => Boolean(church && church.is_active));
  if (churches.length === 0) {
    return {
      error: NextResponse.json(
        { error: "No active church memberships found." },
        { status: 404 }
      ),
    };
  }
  const primary = churches.find((church) => church.id === scope.churchId) ?? churches[0];
  return { churches, defaultSlug: primary.slug, isPlatform: false };
}

export async function GET(request: NextRequest) {
  const access = await resolveAccessibleChurches();
  if ("error" in access) return access.error;

  const cookieSlug = request.cookies.get(ADMIN_CHURCH_COOKIE)?.value;
  const allowedSlugs = new Set(access.churches.map((church) => church.slug));

  let selectedSlug = cookieSlug && allowedSlugs.has(cookieSlug)
    ? cookieSlug
    : access.defaultSlug;
  if (!allowedSlugs.has(selectedSlug)) {
    selectedSlug = access.churches[0]?.slug ?? selectedSlug;
  }

  const selectedChurch =
    access.churches.find((church) => church.slug === selectedSlug) ??
    access.churches[0] ??
    null;

  const response = NextResponse.json({
    selectedSlug: selectedChurch?.slug ?? selectedSlug,
    selectedChurch,
    churches: access.churches,
    isPlatform: access.isPlatform,
  });

  // Self-heal a stale or missing ADMIN_CHURCH_COOKIE for church-scoped admins.
  // The admin shell polls this endpoint on every navigation, so by the time
  // the user clicks anything that hits an API write route (which resolves
  // the church via getChurchSlugFromRequest -> cookie) the cookie is anchored
  // to a church the actor actually administers. This is the backstop for
  // sessions established before login started writing the cookie itself,
  // and for cases where a previous user left a stale value behind.
  //
  // Platform admins are intentionally left alone: the church switcher /
  // POST handler is the only thing that should set their cookie, since
  // their "no cookie" state means "show me the global view".
  if (!access.isPlatform && selectedChurch && cookieSlug !== selectedChurch.slug) {
    response.cookies.set(ADMIN_CHURCH_COOKIE, selectedChurch.slug, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30,
      path: "/",
    });
  } else if (access.isPlatform && cookieSlug && !allowedSlugs.has(cookieSlug)) {
    // Platform admin with a cookie that points at a non-existent church --
    // clear it so the switcher reflects the global view again.
    response.cookies.delete(ADMIN_CHURCH_COOKIE);
  }

  return response;
}

export async function POST(request: NextRequest) {
  const access = await resolveAccessibleChurches();
  if ("error" in access) return access.error;

  const body = await request.json().catch(() => ({}));
  const rawSlug = typeof body.church_slug === "string" ? body.church_slug.trim() : "";

  if (!rawSlug && access.isPlatform) {
    const response = NextResponse.json({
      success: true,
      selectedSlug: null,
      selectedChurch: null,
      isPlatform: true,
    });
    response.cookies.delete(ADMIN_CHURCH_COOKIE);
    return response;
  }

  const requestedSlug = resolveChurchSlug(rawSlug);
  const allowedSlugs = new Set(access.churches.map((church) => church.slug));

  if (!allowedSlugs.has(requestedSlug)) {
    return NextResponse.json(
      { error: "You do not have access to that church." },
      { status: 403 }
    );
  }

  const church =
    access.churches.find((entry) => entry.slug === requestedSlug) ??
    (await getChurchBySlug(requestedSlug));

  if (!church) {
    return NextResponse.json({ error: "Church not found." }, { status: 404 });
  }

  const response = NextResponse.json({
    success: true,
    selectedSlug: church.slug,
    selectedChurch: church,
    isPlatform: access.isPlatform,
  });
  response.cookies.set(ADMIN_CHURCH_COOKIE, church.slug, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
  return response;
}
