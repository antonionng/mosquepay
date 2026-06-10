import { NextResponse } from "next/server";
import {
  getCurrentAdminScope,
  requireAdminPermission,
  type AdminPermission,
} from "@/lib/auth/permissions";

/**
 * Gate an admin-only API route on "is this caller an admin?".
 *
 * Uses the same scope resolver the page side uses (getCurrentAdminScope),
 * so the API can never reject an actor the proxy + admin layout already
 * accepted. If you also need to check a specific permission or a tenant
 * boundary, use requireAdminApiPermission instead -- this helper only
 * answers the identity question.
 */
export async function requireAdminApiAuth() {
  const scope = await getCurrentAdminScope();
  if (scope.kind !== "none") {
    return null;
  }
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function requireOperatorApiAuth() {
  const scope = await getCurrentAdminScope();
  if (scope.kind === "none") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (
    (scope.kind === "dummy" || scope.kind === "platform") &&
    (scope.role === "super_admin" || scope.role === "operator")
  ) {
    return null;
  }
  return NextResponse.json(
    { error: "Platform-level access required." },
    { status: 403 }
  );
}

export async function requireAdminApiPermission(
  permission: AdminPermission,
  churchId?: string | null
) {
  return requireAdminPermission(permission, churchId);
}
