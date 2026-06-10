import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import * as db from "@/lib/db";
import { getCurrentAdminScope } from "@/lib/auth/permissions";
import {
  buildOtpAuthUrl,
  generateBackupCodes,
  generateSecret,
} from "@/lib/auth/mfa";

export async function POST() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Database not configured." },
      { status: 503 }
    );
  }
  const scope = await getCurrentAdminScope();
  if (scope.kind !== "platform" && scope.kind !== "church") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const admin = await db.getAdminUserByEmail(scope.email);
  if (!admin) {
    return NextResponse.json({ error: "Admin not found" }, { status: 404 });
  }
  const secret = generateSecret();
  const otpauth = buildOtpAuthUrl(secret, admin.email);
  const qrDataUrl = await QRCode.toDataURL(otpauth);
  const backupCodes = generateBackupCodes();
  await db.updateAdminUserMfa(admin.id, {
    mfa_secret: secret,
    mfa_backup_codes: backupCodes,
    mfa_enabled: false,
  });
  return NextResponse.json({
    otpauth,
    qrDataUrl,
    backupCodes,
  });
}
