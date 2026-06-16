// PATCH /api/mosques/current-charity-campaign
//
// Sets (or clears) public.mosques.current_charity_campaign_id for the active
// mosque. The PastoralCare / Charity Steward uses this to designate "this year's
// mosque charity" — the dynamic resolver at /give/<slug>/charity defaults
// donations to this campaign when no explicit campaign is supplied.
//
// Body: { campaign_id: string | null }
// Auth: admin with charity:write on the active mosque.

import { NextRequest, NextResponse } from "next/server";
import { requireAdminApiAuth, requireAdminApiPermission } from "@/lib/auth/api";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import * as db from "@/lib/db";
import { getMosqueSlugFromRequest } from "@/lib/tenant";
import { createServiceClient } from "@/lib/supabase/server";
import { writeAuditLog } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest) {
  const unauthorized = await requireAdminApiAuth();
  if (unauthorized) return unauthorized;

  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Database not configured." },
      { status: 503 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const campaignId =
    body.campaign_id === null
      ? null
      : typeof body.campaign_id === "string"
        ? body.campaign_id.trim()
        : undefined;
  if (campaignId === undefined) {
    return NextResponse.json(
      { error: "campaign_id must be a uuid or null." },
      { status: 400 },
    );
  }

  const mosqueSlug = getMosqueSlugFromRequest(request);
  const mosqueId = await db.resolveMosqueId(mosqueSlug);
  if (!mosqueId) {
    return NextResponse.json({ error: "Mosque not found." }, { status: 404 });
  }

  const forbidden = await requireAdminApiPermission("charity:write", mosqueId);
  if (forbidden) return forbidden;

  const supa = createServiceClient();

  // When setting (not clearing), enforce that the campaign belongs to THIS
  // mosque and is in an active/usable state. We don't surface 'paused' as
  // current because that would advertise a "give now" link to a campaign
  // the steward has explicitly paused.
  if (campaignId) {
    const { data: campaign, error: campaignError } = await supa
      .from("charity_campaigns")
      .select("id, mosque_id, status, name")
      .eq("id", campaignId)
      .maybeSingle<{
        id: string;
        mosque_id: string | null;
        status: string;
        name: string;
      }>();
    if (campaignError) {
      console.error("current-charity-campaign PATCH: campaign lookup failed", {
        mosque_id: mosqueId,
        campaign_id: campaignId,
        message: campaignError.message,
      });
      return NextResponse.json(
        { error: "Could not look up campaign." },
        { status: 500 },
      );
    }
    if (!campaign) {
      return NextResponse.json(
        { error: "Campaign not found." },
        { status: 404 },
      );
    }
    if (campaign.mosque_id !== mosqueId) {
      return NextResponse.json(
        { error: "Campaign belongs to a different mosque." },
        { status: 403 },
      );
    }
    if (campaign.status !== "active") {
      return NextResponse.json(
        {
          error:
            "Only active campaigns can be designated current. Re-activate the campaign first.",
        },
        { status: 400 },
      );
    }
  }

  const { error: updateError } = await supa
    .from("mosques")
    .update({ current_charity_campaign_id: campaignId })
    .eq("id", mosqueId);
  if (updateError) {
    console.error("current-charity-campaign PATCH: update failed", {
      mosque_id: mosqueId,
      campaign_id: campaignId,
      message: updateError.message,
    });
    return NextResponse.json(
      { error: "Could not update designated campaign." },
      { status: 500 },
    );
  }

  await writeAuditLog({
    mosqueId,
    action: campaignId ? "updated" : "cleared",
    entityType: "mosque_charity_designation",
    entityId: mosqueId,
    summary: campaignId
      ? `Designated charity campaign ${campaignId} as current`
      : "Cleared the mosque's designated current charity campaign",
    metadata: { campaign_id: campaignId },
  });

  return NextResponse.json({ current_charity_campaign_id: campaignId });
}
