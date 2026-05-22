import { NextResponse } from "next/server";
import { hasDummySession } from "@/lib/auth/dummy";
import {
  getCurrentAdminScope,
  getCurrentStaffAdminContext,
  requireAdminPermission,
  type AdminPermission,
} from "@/lib/auth/permissions";

export async function requireAdminApiAuth() {
  if (await hasDummySession()) {
    return null;
  }

  const staff = await getCurrentStaffAdminContext();
  if (staff) {
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
  lodgeId?: string | null
) {
  return requireAdminPermission(permission, lodgeId);
}
