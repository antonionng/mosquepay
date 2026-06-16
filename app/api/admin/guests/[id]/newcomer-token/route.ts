import { NextRequest, NextResponse } from "next/server";
import {
  isSupabaseConfigured,
  shouldUseInMemoryMock,
} from "@/lib/db/with-fallback";
import { rejectIfMockDisabled } from "@/lib/db/reject-mock";
import * as db from "@/lib/db";
import * as mockDb from "@/lib/mock-db";
import { getMosqueSlugFromRequest } from "@/lib/tenant";
import {
  requireAdminApiAuth,
  requireAdminApiPermission,
} from "@/lib/auth/api";
import { writeAuditLog } from "@/lib/audit";
import { isFeatureEnabled } from "@/lib/feature-flags";

async function ensureFlag(mosqueId: string | null) {
  const enabled = await isFeatureEnabled(mosqueId, "guest_links");
  if (enabled) return null;
  return NextResponse.json(
    { error: "Guest links are disabled for this mosque." },
    { status: 403 }
  );
}

/** Revoke a guest's personal newcomer portal token. */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const _rejectMock = rejectIfMockDisabled();
  if (_rejectMock) return _rejectMock;

  const unauthorized = await requireAdminApiAuth();
  if (unauthorized) return unauthorized;

  const { id } = await params;
  const mosqueSlug = getMosqueSlugFromRequest(request);

  if (isSupabaseConfigured()) {
    const mosque = await db.getMosqueBySlug(mosqueSlug);
    if (!mosque) {
      return NextResponse.json({ error: "Mosque not found." }, { status: 404 });
    }
    const forbidden = await requireAdminApiPermission("members:write", mosque.id);
    if (forbidden) return forbidden;
    const flagBlocked = await ensureFlag(mosque.id);
    if (flagBlocked) return flagBlocked;

    const guest = await db.getGuestById(id, mosque.id);
    if (!guest) {
      return NextResponse.json({ error: "Guest not found." }, { status: 404 });
    }
    await db.updateGuest(id, mosque.id, { newcomer_token_hash: null });
    await writeAuditLog({
      mosqueId: mosque.id,
      action: "revoked",
      entityType: "guest_newcomer_token",
      entityId: guest.id,
      summary: `Revoked newcomer link for ${guest.full_name}`,
    });
    return NextResponse.json({ ok: true });
  }

  if (!shouldUseInMemoryMock()) {
    return NextResponse.json({ error: "Database not configured." }, { status: 503 });
  }

  const guest = mockDb.getGuestById(id, { mosque_slug: mosqueSlug });
  if (!guest) {
    return NextResponse.json({ error: "Guest not found." }, { status: 404 });
  }
  mockDb.updateGuestRecord(id, { newcomer_token_hash: null }, {
    mosque_slug: mosqueSlug,
  });
  return NextResponse.json({ ok: true });
}
