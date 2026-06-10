import { createHmac, timingSafeEqual } from "crypto";

export const STAFF_ADMIN_COOKIE = "covenant_staff_admin_session";

const SESSION_SECRET =
  process.env.SESSION_SECRET ?? "churchpay-dummy-secret-change-in-production";

export interface StaffAdminCookiePayload {
  email: string;
  iat: number;
}

function hmac(payload: string): string {
  return createHmac("sha256", SESSION_SECRET).update(payload).digest("base64url");
}

function safeEqualBase64Url(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}

export function signStaffAdminCookie(email: string): string {
  const normalized = email.trim().toLowerCase();
  const payload = Buffer.from(
    JSON.stringify({ email: normalized, iat: Date.now() })
  ).toString("base64url");
  return `${payload}.${hmac(payload)}`;
}

/**
 * Verifies a staff admin session cookie. Returns the bound email when the
 * signature is valid, otherwise null.
 *
 * The legacy v1 cookie ("staff-admin"+SECRET, base64url) had no email payload
 * and is intentionally rejected here. Holders are forced to re-authenticate
 * once, after which they receive an email-bound v2 cookie.
 */
export function verifyStaffAdminCookie(
  token: string | undefined | null
): StaffAdminCookiePayload | null {
  if (!token) return null;
  const dot = token.indexOf(".");
  if (dot <= 0) return null;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  if (!payload || !sig) return null;

  const expected = hmac(payload);
  if (!safeEqualBase64Url(sig, expected)) return null;

  try {
    const decoded = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8")
    );
    if (
      !decoded ||
      typeof decoded.email !== "string" ||
      decoded.email.length === 0
    ) {
      return null;
    }
    const iat = typeof decoded.iat === "number" ? decoded.iat : 0;
    return { email: decoded.email, iat };
  } catch {
    return null;
  }
}
