import { NextRequest, NextResponse } from "next/server";
import { requireAdminApiAuth, requireAdminApiPermission } from "@/lib/auth/api";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import { rejectIfMockDisabled } from "@/lib/db/reject-mock";
import * as db from "@/lib/db";
import * as mockDb from "@/lib/mock-db";
import { getChurchSlugFromRequest } from "@/lib/tenant";
import { writeAuditLog } from "@/lib/audit";

const VALID_STATUSES = new Set(["active", "completed", "paused"]);

export async function POST(request: NextRequest) {
  const _rejectMock = rejectIfMockDisabled();
  if (_rejectMock) return _rejectMock;

  const unauthorized = await requireAdminApiAuth();
  if (unauthorized) return unauthorized;

  try {
    const churchSlug = getChurchSlugFromRequest(request);
    const body = await request.json();
    const name = body.name?.trim();
    const targetAmount = Number(body.target_amount);
    const status = VALID_STATUSES.has(body.status) ? body.status : "active";

    if (!name || !Number.isFinite(targetAmount) || targetAmount < 0) {
      return NextResponse.json(
        { error: "Name and a valid target amount are required." },
        { status: 400 }
      );
    }

    const input = {
      name,
      description: body.description?.trim() || null,
      target_amount: targetAmount,
      raised_amount: Number(body.raised_amount ?? 0),
      status,
      start_date: body.start_date
        ? new Date(body.start_date).toISOString()
        : new Date().toISOString(),
      end_date: body.end_date ? new Date(body.end_date).toISOString() : null,
    };

    if (isSupabaseConfigured()) {
      const churchId = await db.resolveChurchId(churchSlug);
      if (!churchId) {
        return NextResponse.json({ error: "Church not found." }, { status: 404 });
      }
      const forbidden = await requireAdminApiPermission("charity:write", churchId);
      if (forbidden) return forbidden;
      const campaign = await db.addCharityCampaign(churchId, input);
      await writeAuditLog({
        churchId,
        action: "created",
        entityType: "charity_campaign",
        entityId: campaign.id,
        summary: `Created charity campaign ${campaign.name}`,
      });
      return NextResponse.json({ campaign }, { status: 201 });
    }

    const campaign = mockDb.addCharityCampaign({
      ...input,
      church_slug: churchSlug,
    });
    return NextResponse.json({ campaign }, { status: 201 });
  } catch (error) {
    console.error("Charity campaign POST error:", error);
    return NextResponse.json(
      { error: "Failed to create charity campaign." },
      { status: 500 }
    );
  }
}
