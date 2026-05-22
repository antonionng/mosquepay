import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured, shouldUseInMemoryMock } from "@/lib/db/with-fallback";
import { rejectIfMockDisabled } from "@/lib/db/reject-mock";
import * as db from "@/lib/db";
import * as mockDb from "@/lib/mock-db";
import { getLodgeSlugFromRequest } from "@/lib/tenant";
import {
  requireAdminApiAuth,
  requireAdminApiPermission,
} from "@/lib/auth/api";
import { writeAuditLog } from "@/lib/audit";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; invitationId: string }> }
) {
  const _rejectMock = rejectIfMockDisabled();
  if (_rejectMock) return _rejectMock;

  const unauthorized = await requireAdminApiAuth();
  if (unauthorized) return unauthorized;

  const { invitationId } = await params;
  const lodgeSlug = getLodgeSlugFromRequest(request);

  try {
    if (isSupabaseConfigured()) {
      const lodgeId = await db.resolveLodgeId(lodgeSlug);
      if (!lodgeId) {
        return NextResponse.json({ error: "Lodge not found." }, { status: 404 });
      }
      const forbidden = await requireAdminApiPermission("meetings:write", lodgeId);
      if (forbidden) return forbidden;

      const invitation = await db.getGuestInvitationById(invitationId, lodgeId);
      if (!invitation) {
        return NextResponse.json({ error: "Invitation not found." }, { status: 404 });
      }
      await db.revokeGuestInvitation(invitationId, lodgeId);

      await writeAuditLog({
        lodgeId,
        action: "revoked",
        entityType: "guest_invitation",
        entityId: invitationId,
        summary: "Revoked guest link",
      });

      return NextResponse.json({ success: true });
    }

    if (!shouldUseInMemoryMock()) {
      return NextResponse.json(
        { error: "Database not configured." },
        { status: 503 }
      );
    }

    mockDb.revokeGuestInvitation(invitationId, { lodge_slug: lodgeSlug });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Guest invitation DELETE error:", error);
    return NextResponse.json(
      { error: "Could not revoke guest link." },
      { status: 500 }
    );
  }
}
