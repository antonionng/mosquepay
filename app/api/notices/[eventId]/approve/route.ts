import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import { rejectIfMockDisabled } from "@/lib/db/reject-mock";
import * as db from "@/lib/db";
import { getMosqueSlugFromRequest } from "@/lib/tenant";
import {
  requireAdminApiAuth,
  requireAdminApiPermission,
} from "@/lib/auth/api";
import { buildRecipientsPreview } from "@/lib/fees/recipients-preview";
import { getCurrentAdminContextAny } from "@/lib/auth/permissions";
import { writeAuditLog } from "@/lib/audit";

type Params = { params: Promise<{ eventId: string }> };

/**
 * Explicitly mark a draft notice as approved. The send route refuses to
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
    const mosqueSlug = getMosqueSlugFromRequest(request);
    const mosqueId = await db.resolveMosqueId(mosqueSlug);
    if (!mosqueId) {
      return NextResponse.json({ error: "Mosque not found." }, { status: 404 });
    }
    const forbidden = await requireAdminApiPermission("notice:write", mosqueId);
    if (forbidden) return forbidden;

    const event = await db.getEventById(eventId, mosqueId);
    if (!event) {
      return NextResponse.json({ error: "Service not found." }, { status: 404 });
    }

    const notice = await db.getServiceNotice(eventId, mosqueId);
    if (!notice) {
      return NextResponse.json(
        {
          error:
            "Open the notice editor and save it before approving. There is no draft to approve yet.",
        },
        { status: 409 }
      );
    }

    const admin = await getCurrentAdminContextAny(mosqueId);

    const [members, honoraryGuests, feeDefaults, overrides] = await Promise.all([
      db.getMembers(mosqueId, { status: "active" }),
      db.listHonoraryGuests(mosqueId),
      db.getMosqueFeeDefaults(mosqueId),
      db.listEventFeeOverrides(mosqueId, eventId),
    ]);
    const preview = buildRecipientsPreview({
      members,
      honoraryGuests,
      event,
      defaults: feeDefaults,
      includeMembers: true,
      includeHonoraryGuests: notice.include_honorary_guests !== false,
      overrides,
    });

    await db.upsertServiceNotice(mosqueId, eventId, {
      recipient_snapshot: preview as unknown as Record<string, unknown>,
    });

    const updated = await db.setServiceNoticeStatus(eventId, mosqueId, "approved", {
      notice_approved_at: new Date().toISOString(),
      notice_approved_by_email: admin?.email ?? null,
    });

    await writeAuditLog({
      mosqueId,
      action: "approved",
      entityType: "notice",
      entityId: notice.id,
      summary: `Approved notice for ${event.title}`,
    });

    return NextResponse.json({ event: updated });
  } catch (error) {
    console.error("Notice approve error:", error);
    return NextResponse.json(
      { error: "Failed to approve notice." },
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
  const mosqueSlug = getMosqueSlugFromRequest(request);
  const mosqueId = await db.resolveMosqueId(mosqueSlug);
  if (!mosqueId) {
    return NextResponse.json({ error: "Mosque not found." }, { status: 404 });
  }
  const forbidden = await requireAdminApiPermission("notice:write", mosqueId);
  if (forbidden) return forbidden;

  const event = await db.getEventById(eventId, mosqueId);
  if (!event) {
    return NextResponse.json({ error: "Service not found." }, { status: 404 });
  }

  const updated = await db.setServiceNoticeStatus(eventId, mosqueId, "draft", {
    notice_approved_at: null,
    notice_approved_by_email: null,
  });

  await writeAuditLog({
    mosqueId,
    action: "unapproved",
    entityType: "notice",
    entityId: event.id,
    summary: `Reverted notice approval for ${event.title}`,
  });

  return NextResponse.json({ event: updated });
}
