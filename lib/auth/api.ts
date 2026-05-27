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

  // Last-resort fallback. If the staff-cookie lookup couldn't resolve an
  // admin row but the broader scope resolver can (dummy / platform / lodge
  // membership found via listAdminUsersByEmail), the user clearly has admin
  // access at the page level -- e.g. /admin/take-payment rendered for them.
  // Letting the API agree with the page closes the class of 401s where the
  // /admin/* proxy + page-side getCurrentAdminScope let the user through
  // but the API's single-row staff-context lookup dropped them.
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
  lodgeId?: string | null
) {
  return requireAdminPermission(permission, lodgeId);
}
