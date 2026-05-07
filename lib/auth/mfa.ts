import { authenticator } from "otplib";
import * as db from "@/lib/db";

authenticator.options = { window: 1 };

export function generateSecret(): string {
  return authenticator.generateSecret();
}

export function generateBackupCodes(count = 10): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    let code = "";
    for (let j = 0; j < 8; j++) {
      code += Math.floor(Math.random() * 10).toString();
    }
    codes.push(`${code.slice(0, 4)}-${code.slice(4)}`);
  }
  return codes;
}

export function buildOtpAuthUrl(
  secret: string,
  email: string,
  issuer = "Lodge Payments"
): string {
  return authenticator.keyuri(email, issuer, secret);
}

export function verifyTotp(secret: string, token: string): boolean {
  try {
    return authenticator.verify({ token: token.replace(/\s+/g, ""), secret });
  } catch {
    return false;
  }
}

export async function consumeBackupCode(
  adminId: string,
  code: string
): Promise<boolean> {
  const admin = await db.getAdminUserById(adminId);
  if (!admin || !admin.mfa_backup_codes) return false;
  const codes = admin.mfa_backup_codes;
  const idx = codes.indexOf(code.trim());
  if (idx === -1) return false;
  const next = [...codes.slice(0, idx), ...codes.slice(idx + 1)];
  await db.updateAdminUserMfa(adminId, { mfa_backup_codes: next });
  return true;
}
