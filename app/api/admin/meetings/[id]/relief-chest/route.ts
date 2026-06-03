// Record (or clear) that this meeting's Gift Aid pack has been forwarded to
// the UGLE Relief Chest. Stamps relief_chest_delivered_at/to on the meeting
// collection so the close panel and treasurer report can show delivery status.

import { NextRequest, NextResponse } from "next/server";
import * as db from "@/lib/db";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import { getLodgeSlugFromRequest } from "@/lib/tenant";
import {
  requireAdminApiAuth,
  requireAdminApiPermission,
} from "@/lib/auth/api";
import { getCurrentAdminScope } from "@/lib/auth/permissions";
import { writeAuditLog } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const unauthorized = await requireAdminApiAuth();
  if (unauthorized) return unauthorized;
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Database not configured." },
      { status: 503 }
    );
  }
  const { id: eventId } = await params;
  const lodgeSlug = getLodgeSlugFromRequest(request);
  const lodgeId = await db.resolveLodgeId(lodgeSlug);
  if (!lodgeId) {
    return NextResponse.json({ error: "Lodge not found." }, { status: 404 });
  }
  const forbidden = await requireAdminApiPermission("charity:write", lodgeId);
  if (forbidden) return forbidden;

  const body = (await request.json().catch(() => ({}))) as {
    delivered?: unknown;
    delivered_to?: unknown;
  };
  const delivered = body.delivered !== false; // default true
  const deliveredTo =
    typeof body.delivered_to === "string" && body.delivered_to.trim()
      ? body.delivered_to.trim()
      : null;

  const scope = await getCurrentAdminScope();
  const actorEmail =
    scope.kind === "dummy" ||
    scope.kind === "platform" ||
    scope.kind === "lodge"
      ? scope.email
      : null;

  try {
    await db.markReliefChestDeliveredForEvent(lodgeId, eventId, {
      deliveredAt: delivered ? new Date().toISOString() : null,
      deliveredTo: delivered ? (deliveredTo ?? actorEmail) : null,
    });
  } catch (err) {
    console.error("relief chest delivery stamp failed", {
      event_id: eventId,
      message: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: "Could not update Relief Chest delivery." },
      { status: 500 }
    );
  }

  await writeAuditLog({
    lodgeId,
    action: delivered
      ? "relief_chest_delivered"
      : "relief_chest_delivery_cleared",
    entityType: "event",
    entityId: eventId,
    summary: delivered
      ? `Marked Gift Aid pack delivered to Relief Chest${deliveredTo ? ` (${deliveredTo})` : ""}.`
      : "Cleared Relief Chest delivery flag.",
  });

  return NextResponse.json({ ok: true, delivered });
}
