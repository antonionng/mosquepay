import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import * as db from "@/lib/db";
import { getCurrentAdminScope } from "@/lib/auth/permissions";
import {
  FEATURE_FLAGS,
  clearFeatureFlagCache,
  type FeatureFlagKey,
} from "@/lib/feature-flags";
import { writeAuditLog } from "@/lib/audit";

function isValidKey(key: string): key is FeatureFlagKey {
  return key in FEATURE_FLAGS;
}

export async function GET(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Database not configured." }, { status: 503 });
  }
  const scope = await getCurrentAdminScope();
  if (scope.kind !== "platform" && scope.kind !== "dummy") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const mosqueId = request.nextUrl.searchParams.get("mosque_id");
  if (!mosqueId) {
    return NextResponse.json({ error: "mosque_id is required." }, { status: 400 });
  }

  const flags = await db.listMosqueFeatureFlags(mosqueId);
  return NextResponse.json({
    flags: Object.fromEntries(
      Object.entries(FEATURE_FLAGS).map(([key, meta]) => {
        const found = flags.find((f) => f.flag_key === key);
        return [key, found?.enabled ?? meta.default];
      })
    ),
  });
}

export async function PATCH(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Database not configured." }, { status: 503 });
  }
  const scope = await getCurrentAdminScope();
  if (scope.kind !== "platform" && scope.kind !== "dummy") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const mosqueId = typeof body.mosque_id === "string" ? body.mosque_id : "";
  const flagKey = typeof body.flag_key === "string" ? body.flag_key : "";
  if (!mosqueId || !flagKey || !isValidKey(flagKey)) {
    return NextResponse.json(
      { error: "mosque_id and a valid flag_key are required." },
      { status: 400 }
    );
  }
  const enabled = Boolean(body.enabled);

  const updated = await db.setMosqueFeatureFlag(mosqueId, flagKey, enabled, {
    updated_by_email: scope.email,
  });
  clearFeatureFlagCache(mosqueId);

  await writeAuditLog({
    mosqueId,
    action: enabled ? "feature_flag_enabled" : "feature_flag_disabled",
    entityType: "feature_flag",
    entityId: updated.id,
    summary: `Feature ${flagKey} ${enabled ? "enabled" : "disabled"} by ${scope.email}`,
    metadata: { flag_key: flagKey },
  });

  return NextResponse.json({ ok: true, flag: updated });
}
