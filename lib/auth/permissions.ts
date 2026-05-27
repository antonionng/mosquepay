import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { hasDummySession } from "@/lib/auth/dummy";
import { isPlatformOwnerEmail } from "@/lib/auth/platform-owner";
import {
  STAFF_ADMIN_COOKIE,
  verifyStaffAdminCookie,
} from "@/lib/auth/staff-cookie";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import * as db from "@/lib/db";

async function getStaffAdminCookieEmail(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(STAFF_ADMIN_COOKIE)?.value;
    return verifyStaffAdminCookie(token)?.email ?? null;
  } catch {
    return null;
  }
}

export type AdminPermission =
  | "admin:all"
  | "members:read"
  | "members:write"
  | "meetings:write"
  | "summons:write"
  | "payments:write"
  | "charity:write"
  | "website:write"
  | "audit:read"
  | "welfare:read"
  | "welfare:write";

export type AdminRole =
  | "super_admin"
  | "operator"
  | "secretary"
  | "treasurer"
  | "charity_steward"
  | "membership_officer"
  | "almoner"
  | "master";

const ROLE_PERMISSIONS: Record<AdminRole, AdminPermission[]> = {
  super_admin: ["admin:all"],
  operator: ["admin:all"],
  // Secretary is the de facto owner of a lodge: the person who provisions
  // the LodgePay account and is accountable for everything that happens
  // under it (members, meetings, payments, charity, welfare, settings).
  // Tenant isolation is still enforced by admin_users.lodge_id, so this
  // "admin:all" is scoped to the secretary's own lodge -- not platform-wide.
  // Platform-wide god mode lives on super_admin / operator rows with
  // lodge_id == null (see getCurrentAdminScope).
  secretary: ["admin:all"],
  treasurer: ["payments:write", "audit:read"],
  charity_steward: ["charity:write", "audit:read"],
  membership_officer: ["members:read", "members:write", "audit:read"],
  almoner: ["members:read", "welfare:read", "welfare:write", "audit:read"],
  master: [
    "members:read",
    "meetings:write",
    "summons:write",
    "website:write",
    "audit:read",
  ],
};

/**
 * Returns the canonical permission set for a role. The default fallback
 * matches what roleHasPermission used to do implicitly -- unknown role
 * strings get treated as secretary so a misconfigured admin_users row
 * doesn't accidentally lock a real lodge owner out of their own lodge.
 */
export function getRolePermissions(role: string | null | undefined): AdminPermission[] {
  const normalized = (role ?? "secretary") as AdminRole;
  return ROLE_PERMISSIONS[normalized] ?? ROLE_PERMISSIONS.secretary;
}

/**
 * Combines the role-derived permissions with any per-row overrides stored
 * on admin_users.permissions. This is the set the client sidebar uses to
 * decide what to render, and it should always agree with what the server
 * actually allows (see requireAdminPermission).
 */
export function getEffectivePermissions(
  role: string | null | undefined,
  extras: readonly string[] | null | undefined
): AdminPermission[] {
  const base = getRolePermissions(role);
  if (!extras || extras.length === 0) return base;
  return Array.from(new Set<AdminPermission>([
    ...base,
    ...(extras as AdminPermission[]),
  ]));
}

export function roleHasPermission(
  role: string | null | undefined,
  permission: AdminPermission
) {
  const permissions = getRolePermissions(role);
  return permissions.includes("admin:all") || permissions.includes(permission);
}

export async function getCurrentAdminContext(lodgeId?: string | null) {
  const hasSession = await hasDummySession();
  if (!hasSession) return null;

  const email = process.env.ADMIN_EMAIL ?? "admin@covenantlodge.org.uk";
  const fallbackRole = (process.env.ADMIN_ROLE ?? "super_admin") as AdminRole;
  try {
    const admin = await db.getAdminUserByEmail(email, lodgeId);
    return {
      email,
      role: admin?.role ?? fallbackRole,
      permissions: admin?.permissions ?? [],
    };
  } catch {
    return { email, role: fallbackRole, permissions: [] };
  }
}

export async function getCurrentStaffAdminContext(lodgeId?: string | null) {
  // Prefer the signed staff session cookie as the authoritative identity:
  // it is issued by /api/auth/login only after a successful Supabase auth
  // and matched admin_users row, so its email is trustworthy. Using it as
  // the source of truth means an expired/missing Supabase access token does
  // not break admin API access -- which previously caused 401s on /api/*
  // even though the proxy still allowed the page to render.
  const cookieEmail = await getStaffAdminCookieEmail();

  // Platform owner short-circuit. Platform-owner status is determined purely
  // from env config (PLATFORM_OWNER_EMAILS), not the database, so we can
  // grant god mode without touching admin_users. This makes the env-listed
  // platform owner immune to transient admin_users lookup failures (RLS
  // misconfig, network blips, malformed `.or()` filter, etc) which used to
  // silently strip super_admin and surface as a generic 401 on every admin
  // write endpoint.
  if (cookieEmail && isPlatformOwnerEmail(cookieEmail)) {
    return {
      email: cookieEmail,
      role: "super_admin" as AdminRole,
      permissions: [] as AdminPermission[],
    };
  }

  if (cookieEmail && isSupabaseConfigured()) {
    try {
      const admin = await db.getAdminUserByEmail(cookieEmail, lodgeId);
      if (admin) {
        return {
          email: admin.email,
          role: admin.role as AdminRole,
          permissions: (admin.permissions ?? []) as AdminPermission[],
        };
      }
    } catch (error) {
      // Log so this stops manifesting as a silent 401 in production. We
      // intentionally fall through to the broader membership lookup below
      // so a non-platform admin with a still-valid Supabase access token
      // isn't locked out by a transient cookie-path failure.
      console.error(
        "[permissions] getAdminUserByEmail failed for staff cookie",
        { email: cookieEmail, lodgeId, error }
      );
    }

    // Fallback: ask the DB for every active admin_users row matching this
    // email and pick the one that proves access for the requested scope.
    // listAdminUsersByEmail uses the simpler email + active query without
    // the ordered-by-lodge_id-desc-limit-1 shape that getAdminUserByEmail
    // uses, so it's the safer source of truth for "does this email have
    // admin access here?".
    //
    // Tenant safety: when a lodgeId is supplied we ONLY accept a membership
    // that either matches that lodge or is a platform-wide row. We never
    // silently swap in a different-lodge membership -- doing so would let a
    // lodge-scoped admin pass a permission check against a lodge they don't
    // administer, even though downstream queries would still target the
    // mismatched lodge. When no lodgeId is supplied we just need to confirm
    // they're an admin somewhere (callers like requireAdminApiAuth use this
    // for the "is the user an admin at all?" question).
    try {
      const memberships = await db.listAdminUsersByEmail(cookieEmail);
      if (memberships.length > 0) {
        const preferred = lodgeId
          ? memberships.find((m) => m.lodge_id === lodgeId) ??
            memberships.find(
              (m) => m.lodge_id == null && isPlatformRole(m.role)
            )
          : memberships.find((m) => m.lodge_id == null) ?? memberships[0];
        if (preferred) {
          return {
            email: preferred.email,
            role: preferred.role as AdminRole,
            permissions: (preferred.permissions ?? []) as AdminPermission[],
          };
        }
      }
    } catch (error) {
      console.error(
        "[permissions] listAdminUsersByEmail fallback failed",
        { email: cookieEmail, lodgeId, error }
      );
    }
  }

  if (!isSupabaseConfigured()) return null;

  try {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error || !user?.email) {
      if (cookieEmail) {
        // Useful breadcrumb: the staff cookie was present, but the cookie
        // email did not match any active admin_users row above AND there is
        // no Supabase session to fall back on. Most common cause is the
        // admin row was deactivated/deleted while the cookie was still in
        // effect; less common is a stale-cookie + signed-out-of-Supabase
        // pair after a member-side logout.
        console.warn(
          "[permissions] staff cookie present but unresolvable to an admin",
          { email: cookieEmail, lodgeId, supabaseError: error?.message }
        );
      }
      return null;
    }

    if (isPlatformOwnerEmail(user.email)) {
      return {
        email: user.email,
        role: "super_admin" as AdminRole,
        permissions: [] as AdminPermission[],
      };
    }

    const admin = await db.getAdminUserByEmail(user.email, lodgeId);
    if (admin) {
      return {
        email: admin.email,
        role: admin.role as AdminRole,
        permissions: (admin.permissions ?? []) as AdminPermission[],
      };
    }

    // Same list-based fallback for the Supabase-session path. Tenant
    // safety mirrors the staff-cookie path above: with a lodgeId we only
    // accept a row that matches that lodge or is a platform-wide row.
    const memberships = await db.listAdminUsersByEmail(user.email);
    if (memberships.length === 0) return null;
    const preferred = lodgeId
      ? memberships.find((m) => m.lodge_id === lodgeId) ??
        memberships.find(
          (m) => m.lodge_id == null && isPlatformRole(m.role)
        )
      : memberships.find((m) => m.lodge_id == null) ?? memberships[0];
    if (!preferred) return null;
    return {
      email: preferred.email,
      role: preferred.role as AdminRole,
      permissions: (preferred.permissions ?? []) as AdminPermission[],
    };
  } catch (error) {
    console.error(
      "[permissions] supabase-session admin lookup failed",
      { lodgeId, error }
    );
    return null;
  }
}

export async function getCurrentAdminContextAny(lodgeId?: string | null) {
  return (
    (await getCurrentAdminContext(lodgeId)) ??
    (await getCurrentStaffAdminContext(lodgeId))
  );
}

/**
 * Authorize an admin API action against (optionally) a specific lodge.
 *
 * Authority model:
 *   1. Identity comes from getCurrentAdminScope() -- the same resolver the
 *      page side uses. As long as a user can render /admin/* the API agrees
 *      they are an admin. This closes the class of bugs where the page
 *      rendered but the API returned 401 because a single-row admin lookup
 *      (getAdminUserByEmail) couldn't reconcile the requested lodgeId.
 *   2. Tenant isolation is enforced against scope.lodgeIds. A lodge-scoped
 *      admin can never act on a lodge they don't administer, no matter what
 *      lodgeId the request resolved to.
 *   3. Permission is checked against the role first, then against per-row
 *      admin_users.permissions overrides loaded best-effort.
 *
 * Failures distinguish 401 (not signed in as an admin) from 403 (signed in
 * but lacking permission or out of tenant) so the client can route them to
 * the right UX.
 */
export async function requireAdminPermission(
  permission: AdminPermission,
  lodgeId?: string | null
) {
  const scope = await getCurrentAdminScope();

  if (scope.kind === "none") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (scope.kind === "lodge" && lodgeId != null && !scope.lodgeIds.includes(lodgeId)) {
    // Cross-tenant attempt. Usually means the route resolved the lodge via
    // getLodgeSlugFromRequest's default-slug fallback while the admin's
    // ADMIN_LODGE_COOKIE was missing or stale. We log it to make the next
    // recurrence trivially diagnosable.
    console.warn(
      "[permissions] admin attempted action on out-of-scope lodge",
      {
        email: scope.email,
        role: scope.role,
        permission,
        requestedLodgeId: lodgeId,
        scopeLodgeIds: scope.lodgeIds,
      }
    );
    return NextResponse.json(
      { error: "This action is not available for the selected lodge." },
      { status: 403 }
    );
  }

  if (roleHasPermission(scope.role, permission)) {
    return null;
  }

  // The role doesn't grant the permission, but admin_users rows can carry
  // per-row overrides in the permissions[] column. Honor those before
  // returning 403.
  try {
    const overrides = await db.getAdminUserByEmail(scope.email, lodgeId);
    if (overrides?.permissions?.includes(permission)) {
      return null;
    }
  } catch (error) {
    // Fall through to 403 -- we already know the actor is a real admin,
    // just one whose role doesn't include this permission and whose
    // per-row overrides couldn't be loaded.
    console.error(
      "[permissions] per-row permission override lookup failed",
      { email: scope.email, lodgeId, permission, error }
    );
  }

  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

export type AdminScope =
  | { kind: "none" }
  | { kind: "dummy"; email: string; role: AdminRole }
  | { kind: "platform"; email: string; role: AdminRole }
  | {
      kind: "lodge";
      email: string;
      role: AdminRole;
      lodgeId: string;
      lodgeIds: string[];
    };

function isPlatformRole(role: string | null | undefined): role is AdminRole {
  return role === "super_admin" || role === "operator";
}

/**
 * Resolves the current admin actor into a scope describing whether they are
 * the dev dummy admin, a platform-wide admin (lodge_id null with a platform
 * role), or a lodge-scoped admin. Used to gate cross-lodge actions like the
 * lodge switcher.
 */
export async function getCurrentAdminScope(): Promise<AdminScope> {
  if (await hasDummySession()) {
    const email = process.env.ADMIN_EMAIL ?? "admin@covenantlodge.org.uk";
    const role = (process.env.ADMIN_ROLE ?? "super_admin") as AdminRole;
    return { kind: "dummy", email, role };
  }

  if (!isSupabaseConfigured()) return { kind: "none" };

  // Resolve the actor email from the signed staff cookie when present.
  // This decouples admin scope resolution from the Supabase access token
  // lifetime; a lapsed token no longer flips the scope to "none" while a
  // valid staff session cookie is still in effect.
  const cookieEmail = await getStaffAdminCookieEmail();

  let actorEmail: string | null = cookieEmail;
  if (!actorEmail) {
    try {
      const supabase = await createClient();
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();
      if (error || !user?.email) return { kind: "none" };
      actorEmail = user.email;
    } catch (error) {
      console.error(
        "[permissions] supabase getUser failed while resolving admin scope",
        { error }
      );
      return { kind: "none" };
    }
  }

  // Platform owner short-circuit: matches the same env-config check used in
  // getCurrentStaffAdminContext. Doing this before the admin_users lookup
  // means a thrown listAdminUsersByEmail (RLS, network, etc) can no longer
  // silently downgrade the env-listed platform owner to `kind: "none"`,
  // which previously cascaded into 401s across every admin write endpoint.
  if (isPlatformOwnerEmail(actorEmail)) {
    return {
      kind: "platform",
      email: actorEmail,
      role: "super_admin",
    };
  }

  try {
    const memberships = await db.listAdminUsersByEmail(actorEmail);
    if (memberships.length === 0) return { kind: "none" };

    const platformAdmin = memberships.find(
      (admin) => admin.lodge_id == null && isPlatformRole(admin.role)
    );

    if (platformAdmin) {
      return {
        kind: "platform",
        email: platformAdmin.email,
        role: platformAdmin.role as AdminRole,
      };
    }

    const lodgeMemberships = memberships.filter((admin) => admin.lodge_id);
    const primary = lodgeMemberships[0];
    if (primary?.lodge_id) {
      return {
        kind: "lodge",
        email: primary.email,
        role: primary.role as AdminRole,
        lodgeId: primary.lodge_id,
        lodgeIds: Array.from(
          new Set(lodgeMemberships.flatMap((admin) => admin.lodge_id ?? []))
        ),
      };
    }

    return { kind: "none" };
  } catch (error) {
    console.error(
      "[permissions] listAdminUsersByEmail failed while resolving admin scope",
      { email: actorEmail, error }
    );
    return { kind: "none" };
  }
}
