import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { callMooovConnect, getMooovConnectConfig } from "@/lib/mooov";
import {
  MOOOV_CONNECT_STATE_COOKIE,
  verifyMooovConnectState,
} from "@/lib/mooov-connect-state";
import * as db from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TokenResponse = {
  merchant_id: string;
  entity_id: string;
  grant_id?: string;
  granted_scopes: string[];
  granted_at: string;
  platform_id?: string;
  token_type?: "merchant_id";
};

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const expectedState = request.cookies.get(MOOOV_CONNECT_STATE_COOKIE)?.value;
  const verifiedState = state
    ? verifyMooovConnectState(state, expectedState)
    : null;

  if (!code || !state || !verifiedState) {
    return NextResponse.redirect(
      new URL("/admin/integrations?mooov=invalid_state", request.url)
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

  try {
    const token = await callMooovConnect<TokenResponse>(
      "POST",
      "/v1/public/connect/token",
      {
        body: {
          code,
          redirect_uri: redirectUri,
        },
      }
    );

    const supa = createServiceClient();
    const lodge = await db.getLodgeById(verifiedState.lodgeId);
    const { error } = await supa.schema("mooov").from("lodges").upsert(
      {
        id: verifiedState.lodgeId,
        merchant_id: token.merchant_id,
        display_name: lodge?.name ?? verifiedState.lodgeSlug,
        currency: "GBP",
        status: "active",
        metadata: {
          entity_id: token.entity_id,
          grant_id: token.grant_id,
          granted_scopes: token.granted_scopes,
          granted_at: token.granted_at,
          platform_id: token.platform_id,
          lodge_slug: verifiedState.lodgeSlug,
        },
      },
      { onConflict: "id" }
    );
    if (error) throw error;

    const response = NextResponse.redirect(
      new URL("/admin/integrations?mooov=connected", request.url)
    );
    response.cookies.delete(MOOOV_CONNECT_STATE_COOKIE);
    return response;
  } catch (error) {
    console.error("Mooov callback failed", {
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.redirect(
      new URL("/admin/integrations?mooov=error", request.url)
    );
  }
}
