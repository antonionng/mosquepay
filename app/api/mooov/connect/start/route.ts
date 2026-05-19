import { NextRequest, NextResponse } from "next/server";
import { getAdminReadContext } from "@/lib/admin/read-context";
import { getMooovConnectConfig } from "@/lib/mooov";
import {
  createMooovConnectState,
  MOOOV_CONNECT_STATE_COOKIE,
} from "@/lib/mooov-connect-state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const ctx = await getAdminReadContext();
  if (ctx.mode !== "database" || !ctx.lodgeId) {
    return NextResponse.json(
      { error: "Mooov Connect requires a database-backed lodge." },
      { status: 400 }
    );
  }

  const config = getMooovConnectConfig();
  const siteUrl =
    process.env.MOOOV_REDIRECT_BASE_URL ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    request.nextUrl.origin;
  const redirectUri =
    config.redirectUri ??
    `${siteUrl.replace(/\/$/, "")}/oauth/mooov/callback`;
  const state = createMooovConnectState({
    lodgeId: ctx.lodgeId,
    lodgeSlug: ctx.lodgeSlug,
  });
  const url = new URL("/authorize", config.connectBaseUrl);
  url.searchParams.set("client_id", config.platformSlug);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set(
    "scope",
    "payments:write payments:read refunds:write customers:read customers:write webhooks:read"
  );
  url.searchParams.set("mode", process.env.MOOOV_CONNECT_MODE ?? "test");

  const response = NextResponse.redirect(url);
  response.cookies.set(MOOOV_CONNECT_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 10 * 60,
    path: "/",
  });
  return response;
}
