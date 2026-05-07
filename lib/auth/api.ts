import { NextResponse } from "next/server";
import { hasDummySession } from "@/lib/auth/dummy";
import {
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

export const requireOperatorApiAuth = requireAdminApiAuth;

export async function requireAdminApiPermission(
  permission: AdminPermission,
  lodgeId?: string | null
) {
  return requireAdminPermission(permission, lodgeId);
}
