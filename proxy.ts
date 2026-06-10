import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getChurchSlugFromRequest } from "@/lib/tenant";
import {
  STAFF_ADMIN_COOKIE,
  verifyStaffAdminCookie,
} from "@/lib/auth/staff-cookie";

const SESSION_COOKIE = "churchpay_admin_session";
const SESSION_SECRET =
  process.env.SESSION_SECRET ?? "churchpay-dummy-secret-change-in-production";

const SUPABASE_AUTH_COOKIE_PREFIX = "sb-";

function verifyDummyCookie(token: string): boolean {
  const encoder = new TextEncoder();
  const data = encoder.encode("admin" + SESSION_SECRET);
  const expected = Buffer.from(data).toString("base64url");
  return token === expected && token.length > 0;
}

function hasSupabaseSession(request: NextRequest): boolean {
  for (const [name] of request.cookies) {
    if (name.startsWith(SUPABASE_AUTH_COOKIE_PREFIX) && name.includes("auth-token")) {
      return true;
    }
  }
  return false;
}

export function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const churchSlug = getChurchSlugFromRequest(request);

  const response = NextResponse.next();
  response.headers.set("x-church-slug", churchSlug);

  if (
    path.startsWith("/admin") &&
    path !== "/admin/login" &&
    path !== "/admin/signin" &&
    path !== "/admin/accept-invite" &&
    path !== "/admin/forgot-password" &&
    path !== "/admin/reset-password"
  ) {
    const token = request.cookies.get(SESSION_COOKIE)?.value;
    const staffToken = request.cookies.get(STAFF_ADMIN_COOKIE)?.value;
    const dummyOk = !!token && verifyDummyCookie(token);
    const staffOk = !!verifyStaffAdminCookie(staffToken);
    if (!dummyOk && !staffOk) {
      const login = new URL("/admin/login", request.url);
      // Preserve safe query params on the return path so a bookmarked deep
      // link like /admin/take-payment?tab=cash actually lands back on the
      // Cash tab after login, not on the default Charge tab. We pass the
      // original search string through verbatim — `from` is consumed by
      // the admin login redirect logic so a malicious value can only land
      // the user on another admin route they could already navigate to.
      const search = request.nextUrl.search;
      login.searchParams.set("from", search ? `${path}${search}` : path);
      return NextResponse.redirect(login);
    }
  }

  if (path.startsWith("/operator") && path !== "/operator/login") {
    const token = request.cookies.get(SESSION_COOKIE)?.value;
    if (!token || !verifyDummyCookie(token)) {
      const login = new URL("/operator/login", request.url);
      const search = request.nextUrl.search;
      login.searchParams.set("from", search ? `${path}${search}` : path);
      return NextResponse.redirect(login);
    }
  }

  if (
    path.startsWith("/member") &&
    path !== "/member/login" &&
    path !== "/member/signup" &&
    path !== "/member/accept-invite" &&
    path !== "/member/forgot-password" &&
    path !== "/member/reset-password"
  ) {
    if (!hasSupabaseSession(request)) {
      const login = new URL("/member/login", request.url);
      login.searchParams.set("from", path);
      return NextResponse.redirect(login);
    }
  }

  return response;
}

export const config = {
  matcher: ["/admin/:path*", "/operator/:path*", "/member/:path*"],
};
