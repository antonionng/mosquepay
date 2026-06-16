import { cookies } from "next/headers";
import { isPlatformOwnerEmail } from "@/lib/auth/platform-owner";

const SESSION_COOKIE = "mosquepay_admin_session";
const SESSION_SECRET = process.env.SESSION_SECRET ?? "mosquepay-dummy-secret-change-in-production";

function sign(value: string): string {
  const encoder = new TextEncoder();
  const data = encoder.encode(value + SESSION_SECRET);
  return Buffer.from(data).toString("base64url");
}

function verify(token: string): boolean {
  const expected = sign("admin");
  return token === expected && token.length > 0;
}

export async function setDummySession() {
  const cookieStore = await cookies();
  const token = sign("admin");
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: "/",
  });
}

export async function clearDummySession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export async function hasDummySession(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  return !!token && verify(token);
}

export function validateDummyCredentials(email: string, password: string): boolean {
  const adminEmail = process.env.ADMIN_EMAIL ?? "admin@covenantmosque.org.uk";
  const adminPassword = process.env.ADMIN_PASSWORD ?? "admin";
  if (email.trim().toLowerCase() === adminEmail.trim().toLowerCase() && password === adminPassword) {
    return true;
  }
  if (isPlatformOwnerEmail(email) && password === (process.env.PLATFORM_OWNER_PASSWORD ?? "Brandnew4")) {
    return true;
  }
  return false;
}
