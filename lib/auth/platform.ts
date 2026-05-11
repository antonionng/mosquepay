import { NextResponse } from "next/server";
import { getCurrentAdminScope, type AdminScope } from "@/lib/auth/permissions";
import { isPlatformOwnerEmail } from "@/lib/auth/platform-owner";

export function isPlatformScope(scope: AdminScope) {
  return scope.kind === "platform" || scope.kind === "dummy";
}

export function isPlatformOwnerScope(scope: AdminScope) {
  return (
    (scope.kind === "platform" || scope.kind === "dummy") &&
    isPlatformOwnerEmail(scope.email)
  );
}

export async function requirePlatformScope() {
  const scope = await getCurrentAdminScope();
  if (isPlatformScope(scope)) return { scope, response: null };
  return {
    scope,
    response: NextResponse.json(
      { error: "Platform-level access required." },
      { status: 403 }
    ),
  };
}

export async function requirePlatformOwnerScope() {
  const scope = await getCurrentAdminScope();
  if (isPlatformOwnerScope(scope)) return { scope, response: null };
  return {
    scope,
    response: NextResponse.json(
      { error: "Platform owner access required." },
      { status: 403 }
    ),
  };
}
