import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import * as db from "@/lib/db";
import { getCurrentAdminScope } from "@/lib/auth/permissions";
import { verifyTotp } from "@/lib/auth/mfa";
import { writeAuditLog } from "@/lib/audit";

export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Database not configured." },
      { status: 503 }
    );
  }
  const scope = await getCurrentAdminScope();
  if (scope.kind !== "platform" && scope.kind !== "lodge") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const admin = await db.getAdminUserByEmail(scope.email);
  if (!admin || !admin.mfa_secret) {
    return NextResponse.json({ error: "MFA not initialised." }, { status: 400 });
  }
  const body = await request.json();
  const token = String(body.token ?? "");
  if (!verifyTotp(admin.mfa_secret, token)) {
    return NextResponse.json({ error: "Invalid code." }, { status: 400 });
  }
  const updated = await db.updateAdminUserMfa(admin.id, {
    mfa_enabled: true,
    mfa_enrolled_at: new Date().toISOString(),
  });
  await writeAuditLog({
    lodgeId: scope.kind === "lodge" ? scope.lodgeId : null,
    action: "mfa_enabled",
    entityType: "admin_user",
    entityId: admin.id,
    summary: `Admin enrolled in MFA`,
  });
  return NextResponse.json({ admin: updated });
}

export async function DELETE() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Database not configured." },
      { status: 503 }
    );
  }
  const scope = await getCurrentAdminScope();
  if (scope.kind !== "platform" && scope.kind !== "lodge") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const admin = await db.getAdminUserByEmail(scope.email);
  if (!admin) {
    return NextResponse.json({ error: "Admin not found" }, { status: 404 });
  }
  await db.updateAdminUserMfa(admin.id, {
    mfa_enabled: false,
    mfa_secret: null,
    mfa_backup_codes: null,
    mfa_enrolled_at: null,
  });
  await writeAuditLog({
    lodgeId: scope.kind === "lodge" ? scope.lodgeId : null,
    action: "mfa_disabled",
    entityType: "admin_user",
    entityId: admin.id,
    summary: `Admin disabled MFA`,
  });
  return NextResponse.json({ ok: true });
}
