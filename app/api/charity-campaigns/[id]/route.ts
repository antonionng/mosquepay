import { NextRequest, NextResponse } from "next/server";
import { requireAdminApiAuth, requireAdminApiPermission } from "@/lib/auth/api";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import * as db from "@/lib/db";
import { getLodgeSlugFromRequest } from "@/lib/tenant";
import { writeAuditLog } from "@/lib/audit";

const VALID_STATUSES = new Set(["active", "completed", "paused"]);

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const unauthorized = await requireAdminApiAuth();
  if (unauthorized) return unauthorized;

  const { id } = await params;
  try {
    const lodgeSlug = getLodgeSlugFromRequest(request);
    const body = await request.json();
    const updates: Record<string, unknown> = {};
    if (typeof body.name === "string") updates.name = body.name.trim();
    if (typeof body.description === "string" || body.description === null)
      updates.description = body.description;
    if (body.target_amount !== undefined)
      updates.target_amount = Number(body.target_amount);
    if (body.raised_amount !== undefined)
      updates.raised_amount = Number(body.raised_amount);
    if (
      typeof body.status === "string" &&
      VALID_STATUSES.has(body.status)
    ) {
      updates.status = body.status;
    }
    if ("end_date" in body) {
      updates.end_date = body.end_date
        ? new Date(body.end_date).toISOString()
        : null;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No fields to update." }, { status: 400 });
    }

    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        { error: "Database not configured." },
        { status: 503 }
      );
    }
    const lodgeId = await db.resolveLodgeId(lodgeSlug);
    if (!lodgeId) {
      return NextResponse.json({ error: "Lodge not found." }, { status: 404 });
    }
    const forbidden = await requireAdminApiPermission("charity:write", lodgeId);
    if (forbidden) return forbidden;

    const campaign = await db.updateCharityCampaign(id, lodgeId, updates);
    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
    }
    await writeAuditLog({
      lodgeId,
      action: "updated",
      entityType: "charity_campaign",
      entityId: campaign.id,
      summary: `Updated charity campaign ${campaign.name}`,
      metadata: { fields: Object.keys(updates) },
    });
    return NextResponse.json({ campaign });
  } catch (error) {
    console.error("Charity campaign PATCH error:", error);
    return NextResponse.json(
      { error: "Failed to update campaign." },
      { status: 500 }
    );
  }
}
