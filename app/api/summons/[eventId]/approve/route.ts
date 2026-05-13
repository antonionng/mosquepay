import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import { rejectIfMockDisabled } from "@/lib/db/reject-mock";
import * as db from "@/lib/db";
import { getLodgeSlugFromRequest } from "@/lib/tenant";
import {
  requireAdminApiAuth,
  requireAdminApiPermission,
} from "@/lib/auth/api";
import { getCurrentAdminContextAny } from "@/lib/auth/permissions";
import { writeAuditLog } from "@/lib/audit";

type Params = { params: Promise<{ eventId: string }> };

/**
 * Explicitly mark a draft summons as approved. The send route refuses to
 * dispatch unless the event is in this status. This is the human gate the
 * cron auto-drafter is not allowed to bypass.
 */
export async function POST(request: NextRequest, { params }: Params) {
  const _rejectMock = rejectIfMockDisabled();
  if (_rejectMock) return _rejectMock;

  const unauthorized = await requireAdminApiAuth();
  if (unauthorized) return unauthorized;

  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Database not configured." },
      { status: 503 }
    );
  }

  try {
    const { eventId } = await params;
    const lodgeSlug = getLodgeSlugFromRequest(request);
    const lodgeId = await db.resolveLodgeId(lodgeSlug);
    if (!lodgeId) {
      return NextResponse.json({ error: "Lodge not found." }, { status: 404 });
    }
    const forbidden = await requireAdminApiPermission("summons:write", lodgeId);
    if (forbidden) return forbidden;

    const event = await db.getEventById(eventId, lodgeId);
    if (!event) {
      return NextResponse.json({ error: "Meeting not found." }, { status: 404 });
    }

    const summons = await db.getEventSummons(eventId, lodgeId);
    if (!summons) {
      return NextResponse.json(
        {
          error:
            "Open the summons editor and save it before approving. There is no draft to approve yet.",
        },
        { status: 409 }
      );
    }

    const admin = await getCurrentAdminContextAny(lodgeId);
    const updated = await db.setEventSummonsStatus(eventId, lodgeId, "approved", {
      summons_approved_at: new Date().toISOString(),
      summons_approved_by_email: admin?.email ?? null,
    });

    await writeAuditLog({
      lodgeId,
      action: "approved",
      entityType: "summons",
      entityId: summons.id,
      summary: `Approved summons for ${event.title}`,
    });

    return NextResponse.json({ event: updated });
  } catch (error) {
    console.error("Summons approve error:", error);
    return NextResponse.json(
      { error: "Failed to approve summons." },
      { status: 500 }
    );
  }
}

/**
 * Revert an approval back to draft (for example to make further edits).
 */
export async function DELETE(request: NextRequest, { params }: Params) {
  const _rejectMock = rejectIfMockDisabled();
  if (_rejectMock) return _rejectMock;

  const unauthorized = await requireAdminApiAuth();
  if (unauthorized) return unauthorized;

  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Database not configured." },
      { status: 503 }
    );
  }

  const { eventId } = await params;
  const lodgeSlug = getLodgeSlugFromRequest(request);
  const lodgeId = await db.resolveLodgeId(lodgeSlug);
  if (!lodgeId) {
    return NextResponse.json({ error: "Lodge not found." }, { status: 404 });
  }
  const forbidden = await requireAdminApiPermission("summons:write", lodgeId);
  if (forbidden) return forbidden;

  const event = await db.getEventById(eventId, lodgeId);
  if (!event) {
    return NextResponse.json({ error: "Meeting not found." }, { status: 404 });
  }

  const updated = await db.setEventSummonsStatus(eventId, lodgeId, "draft", {
    summons_approved_at: null,
    summons_approved_by_email: null,
  });

  await writeAuditLog({
    lodgeId,
    action: "unapproved",
    entityType: "summons",
    entityId: event.id,
    summary: `Reverted summons approval for ${event.title}`,
  });

  return NextResponse.json({ event: updated });
}
