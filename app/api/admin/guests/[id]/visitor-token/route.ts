import { NextRequest, NextResponse } from "next/server";
import {
  isSupabaseConfigured,
  shouldUseInMemoryMock,
} from "@/lib/db/with-fallback";
import { rejectIfMockDisabled } from "@/lib/db/reject-mock";
import * as db from "@/lib/db";
import * as mockDb from "@/lib/mock-db";
import { getLodgeSlugFromRequest } from "@/lib/tenant";
import {
  requireAdminApiAuth,
  requireAdminApiPermission,
} from "@/lib/auth/api";
import { writeAuditLog } from "@/lib/audit";
import { isFeatureEnabled } from "@/lib/feature-flags";

async function ensureFlag(lodgeId: string | null) {
  const enabled = await isFeatureEnabled(lodgeId, "guest_links");
  if (enabled) return null;
  return NextResponse.json(
    { error: "Guest links are disabled for this lodge." },
    { status: 403 }
  );
}

/** Revoke a guest's personal visitor portal token. */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const _rejectMock = rejectIfMockDisabled();
  if (_rejectMock) return _rejectMock;

  const unauthorized = await requireAdminApiAuth();
  if (unauthorized) return unauthorized;

  const { id } = await params;
  const lodgeSlug = getLodgeSlugFromRequest(request);

  if (isSupabaseConfigured()) {
    const lodge = await db.getLodgeBySlug(lodgeSlug);
    if (!lodge) {
      return NextResponse.json({ error: "Lodge not found." }, { status: 404 });
    }
    const forbidden = await requireAdminApiPermission("members:write", lodge.id);
    if (forbidden) return forbidden;
    const flagBlocked = await ensureFlag(lodge.id);
    if (flagBlocked) return flagBlocked;

    const guest = await db.getGuestById(id, lodge.id);
    if (!guest) {
      return NextResponse.json({ error: "Guest not found." }, { status: 404 });
    }
    await db.updateGuest(id, lodge.id, { visitor_token_hash: null });
    await writeAuditLog({
      lodgeId: lodge.id,
      action: "revoked",
      entityType: "guest_visitor_token",
      entityId: guest.id,
      summary: `Revoked visitor link for ${guest.full_name}`,
    });
    return NextResponse.json({ ok: true });
  }

  if (!shouldUseInMemoryMock()) {
    return NextResponse.json({ error: "Database not configured." }, { status: 503 });
  }

  const guest = mockDb.getGuestById(id, { lodge_slug: lodgeSlug });
  if (!guest) {
    return NextResponse.json({ error: "Guest not found." }, { status: 404 });
  }
  mockDb.updateGuestRecord(id, { visitor_token_hash: null }, {
    lodge_slug: lodgeSlug,
  });
  return NextResponse.json({ ok: true });
}
