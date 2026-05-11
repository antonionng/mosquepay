import { NextResponse } from "next/server";
import { hasDummySession } from "@/lib/auth/dummy";
import { isPlatformOwnerEmail } from "@/lib/auth/platform-owner";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import * as db from "@/lib/db";

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
  secretary: [
    "members:read",
    "members:write",
    "meetings:write",
    "summons:write",
    "website:write",
    "audit:read",
    "welfare:read",
  ],
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

export function roleHasPermission(
  role: string | null | undefined,
  permission: AdminPermission
) {
  const normalized = (role ?? "secretary") as AdminRole;
  const permissions = ROLE_PERMISSIONS[normalized] ?? ROLE_PERMISSIONS.secretary;
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
  if (!isSupabaseConfigured()) return null;

  try {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error || !user?.email) return null;

    const admin = await db.getAdminUserByEmail(user.email, lodgeId);
    if (!admin && isPlatformOwnerEmail(user.email)) {
      return {
        email: user.email,
        role: "super_admin",
        permissions: [],
      };
    }
    if (!admin) return null;

    return {
      email: admin.email,
      role: admin.role,
      permissions: admin.permissions ?? [],
    };
  } catch {
    return null;
  }
}

export async function getCurrentAdminContextAny(lodgeId?: string | null) {
  return (
    (await getCurrentAdminContext(lodgeId)) ??
    (await getCurrentStaffAdminContext(lodgeId))
  );
}

export async function requireAdminPermission(
  permission: AdminPermission,
  lodgeId?: string | null
) {
  const admin = await getCurrentAdminContextAny(lodgeId);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!roleHasPermission(admin.role, permission)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
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

  try {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error || !user?.email) return { kind: "none" };

    const memberships = await db.listAdminUsersByEmail(user.email);
    if (memberships.length === 0 && isPlatformOwnerEmail(user.email)) {
      return {
        kind: "platform",
        email: user.email,
        role: "super_admin",
      };
    }
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
  } catch {
    return { kind: "none" };
  }
}
