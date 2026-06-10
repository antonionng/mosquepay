import { NextRequest, NextResponse } from "next/server";
import { getAdminReadContext } from "@/lib/admin/read-context";
import { getMooovConnectConfig } from "@/lib/mooov";
import { createServiceClient } from "@/lib/supabase/server";
import {
  createMooovConnectState,
  MOOOV_CONNECT_STATE_COOKIE,
  MOOOV_CONNECT_STATE_TTL_SECONDS,
} from "@/lib/mooov-connect-state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function loadExistingMerchantHint(churchId: string): Promise<string | null> {
  try {
    const { data, error } = await createServiceClient()
      .schema("mooov")
      .from("churches")
      .select("merchant_id,status")
      .eq("id", churchId)
      .maybeSingle<{ merchant_id: string; status: string }>();
    if (error || data?.status !== "active") return null;
    return data.merchant_id;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const ctx = await getAdminReadContext();
  if (ctx.mode !== "database" || !ctx.churchId) {
    return NextResponse.json(
      { error: "Mooov Connect requires a database-backed church." },
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
    churchId: ctx.churchId,
    churchSlug: ctx.churchSlug,
  });
  const url = new URL("/authorize", config.connectBaseUrl);
  url.searchParams.set("client_id", config.platformSlug);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  // Least-privilege scope set: only what we actually call from server code.
  // Reintroducing customers:read / customers:write / webhooks:read bloats the
  // church admin's consent screen with permissions we never exercise (Mooov
  // renders one row per requested scope). Re-add ONLY when a real code path
  // calls the corresponding endpoint. See e689a80 for the original rationale.
  //
  //   payments:write -> POST /v1/payment_intents (app/api/giving/start)
  //   payments:read  -> reserved for the church UI's payment-history views
  //   refunds:write  -> reserved for the upcoming refund workflow
  url.searchParams.set(
    "scope",
    "payments:write payments:read refunds:write"
  );
  url.searchParams.set("mode", process.env.MOOOV_CONNECT_MODE ?? "test");
  const merchantHint = await loadExistingMerchantHint(ctx.churchId);
  if (merchantHint) {
    url.searchParams.set("platform_tenant_id_hint", merchantHint);
  }

  const response = NextResponse.redirect(url);
  response.cookies.set(MOOOV_CONNECT_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: MOOOV_CONNECT_STATE_TTL_SECONDS,
    path: "/",
  });
  return response;
}
