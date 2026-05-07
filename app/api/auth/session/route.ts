import { NextResponse } from "next/server";
import { hasDummySession } from "@/lib/auth/dummy";
import {
  getCurrentAdminContextAny,
  getCurrentAdminScope,
} from "@/lib/auth/permissions";
import { getAllFlagsForLodge, FEATURE_FLAGS } from "@/lib/feature-flags";

export async function GET() {
  const ok = await hasDummySession();
  const admin = await getCurrentAdminContextAny();
  const scope = await getCurrentAdminScope();
  let flags: Record<string, boolean> = Object.fromEntries(
    Object.entries(FEATURE_FLAGS).map(([key, meta]) => [key, meta.default])
  );
  if (scope.kind === "lodge") {
    try {
      flags = await getAllFlagsForLodge(scope.lodgeId);
    } catch {
      // fall back to defaults
    }
  }
  return NextResponse.json({
    authenticated: ok || Boolean(admin),
    admin,
    scope,
    flags,
  });
}
