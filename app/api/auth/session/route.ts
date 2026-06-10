import { NextResponse } from "next/server";
import { hasDummySession } from "@/lib/auth/dummy";
import {
  getCurrentAdminContextAny,
  getCurrentAdminScope,
  getEffectivePermissions,
} from "@/lib/auth/permissions";
import { getAllFlagsForChurch, FEATURE_FLAGS } from "@/lib/feature-flags";

export async function GET() {
  const ok = await hasDummySession();
  const admin = await getCurrentAdminContextAny();
  const scope = await getCurrentAdminScope();
  let flags: Record<string, boolean> = Object.fromEntries(
    Object.entries(FEATURE_FLAGS).map(([key, meta]) => [key, meta.default])
  );
  if (scope.kind === "church") {
    try {
      flags = await getAllFlagsForChurch(scope.churchId);
    } catch {
      // fall back to defaults
    }
  }
  // effectivePermissions = role-derived perms + per-row extras, computed
  // server-side so the client sidebar can't drift from authorization.
  const adminResponse = admin
    ? {
        ...admin,
        effectivePermissions: getEffectivePermissions(
          admin.role,
          admin.permissions
        ),
      }
    : null;
  return NextResponse.json({
    authenticated: ok || Boolean(admin),
    admin: adminResponse,
    scope,
    flags,
  });
}
