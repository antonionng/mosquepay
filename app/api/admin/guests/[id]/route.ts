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

const EDITABLE_KEYS = [
  "full_name",
  "email",
  "phone",
  "mother_lodge_name",
  "mother_lodge_number",
  "constitution",
  "rank",
  "dietary_requirements",
  "is_mason",
  "notes",
] as const;

type EditableKey = (typeof EDITABLE_KEYS)[number];

function trimOrNull(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function pickPatch(body: Record<string, unknown>) {
  const patch: Record<string, unknown> = {};
  for (const key of EDITABLE_KEYS) {
    if (!(key in body)) continue;
    if (key === "is_mason") {
      patch.is_mason = Boolean(body.is_mason);
    } else if (key === "full_name") {
      const next = trimOrNull(body.full_name);
      if (next) patch.full_name = next;
    } else {
      patch[key as EditableKey] = trimOrNull(body[key]);
    }
  }
  return patch;
}

async function ensureFlag(lodgeId: string | null) {
  const enabled = await isFeatureEnabled(lodgeId, "guest_links");
  if (enabled) return null;
  return NextResponse.json(
    { error: "Guest links are disabled for this lodge." },
    { status: 403 }
  );
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const unauthorized = await requireAdminApiAuth();
  if (unauthorized) return unauthorized;

  const { id } = await params;
  const lodgeSlug = getLodgeSlugFromRequest(request);

  if (isSupabaseConfigured()) {
    const lodgeId = await db.resolveLodgeId(lodgeSlug);
    if (!lodgeId) {
      return NextResponse.json({ error: "Lodge not found." }, { status: 404 });
    }
    const forbidden = await requireAdminApiPermission("members:read", lodgeId);
    if (forbidden) return forbidden;
    const flagBlocked = await ensureFlag(lodgeId);
    if (flagBlocked) return flagBlocked;
    const guest = await db.getGuestById(id, lodgeId);
    if (!guest) {
      return NextResponse.json({ error: "Guest not found." }, { status: 404 });
    }
    return NextResponse.json({ guest });
  }

  if (!shouldUseInMemoryMock()) {
    return NextResponse.json({ error: "Guest not found." }, { status: 404 });
  }
  const guest = mockDb.getGuestById(id, { lodge_slug: lodgeSlug });
  if (!guest) {
    return NextResponse.json({ error: "Guest not found." }, { status: 404 });
  }
  return NextResponse.json({ guest });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const _rejectMock = rejectIfMockDisabled();
  if (_rejectMock) return _rejectMock;

  const unauthorized = await requireAdminApiAuth();
  if (unauthorized) return unauthorized;

  const { id } = await params;
  const lodgeSlug = getLodgeSlugFromRequest(request);
  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const patch = pickPatch(body);

  if (isSupabaseConfigured()) {
    const lodgeId = await db.resolveLodgeId(lodgeSlug);
    if (!lodgeId) {
      return NextResponse.json({ error: "Lodge not found." }, { status: 404 });
    }
    const forbidden = await requireAdminApiPermission("members:write", lodgeId);
    if (forbidden) return forbidden;
    const flagBlocked = await ensureFlag(lodgeId);
    if (flagBlocked) return flagBlocked;

    const existing = await db.getGuestById(id, lodgeId);
    if (!existing) {
      return NextResponse.json({ error: "Guest not found." }, { status: 404 });
    }
    const guest = await db.updateGuest(id, lodgeId, patch);
    await writeAuditLog({
      lodgeId,
      action: "updated",
      entityType: "guest",
      entityId: guest.id,
      summary: `Updated guest ${guest.full_name}`,
      metadata: { fields: Object.keys(patch) },
    });
    return NextResponse.json({ guest });
  }

  const guest = mockDb.updateGuestRecord(id, patch, { lodge_slug: lodgeSlug });
  if (!guest) {
    return NextResponse.json({ error: "Guest not found." }, { status: 404 });
  }
  return NextResponse.json({ guest });
}

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
  const url = new URL(request.url);
  const action = url.searchParams.get("action") ?? "archive";

  if (isSupabaseConfigured()) {
    const lodgeId = await db.resolveLodgeId(lodgeSlug);
    if (!lodgeId) {
      return NextResponse.json({ error: "Lodge not found." }, { status: 404 });
    }
    const forbidden = await requireAdminApiPermission("members:write", lodgeId);
    if (forbidden) return forbidden;
    const flagBlocked = await ensureFlag(lodgeId);
    if (flagBlocked) return flagBlocked;

    const existing = await db.getGuestById(id, lodgeId);
    if (!existing) {
      return NextResponse.json({ error: "Guest not found." }, { status: 404 });
    }

    if (action === "purge") {
      const result = await db.hardDeleteGuestIfUnused(id, lodgeId);
      if (!result.deleted) {
        return NextResponse.json(
          {
            error:
              "This guest has visit history; archive instead of permanently deleting.",
          },
          { status: 409 }
        );
      }
      await writeAuditLog({
        lodgeId,
        action: "deleted",
        entityType: "guest",
        entityId: id,
        summary: `Permanently deleted guest ${existing.full_name}`,
      });
      return NextResponse.json({ success: true, mode: "purge" });
    }

    if (action === "restore") {
      const guest = await db.restoreGuest(id, lodgeId);
      await writeAuditLog({
        lodgeId,
        action: "restored",
        entityType: "guest",
        entityId: id,
        summary: `Restored guest ${guest.full_name}`,
      });
      return NextResponse.json({ guest, mode: "restore" });
    }

    const guest = await db.archiveGuest(id, lodgeId);
    await writeAuditLog({
      lodgeId,
      action: "archived",
      entityType: "guest",
      entityId: id,
      summary: `Archived guest ${guest.full_name}`,
    });
    return NextResponse.json({ guest, mode: "archive" });
  }

  if (action === "purge") {
    const ok = mockDb.hardDeleteGuestRecordIfUnused(id, {
      lodge_slug: lodgeSlug,
    });
    if (!ok) {
      return NextResponse.json(
        {
          error:
            "This guest has visit history; archive instead of permanently deleting.",
        },
        { status: 409 }
      );
    }
    return NextResponse.json({ success: true, mode: "purge" });
  }
  if (action === "restore") {
    const guest = mockDb.restoreGuestRecord(id, { lodge_slug: lodgeSlug });
    return NextResponse.json({ guest, mode: "restore" });
  }
  const guest = mockDb.archiveGuestRecord(id, { lodge_slug: lodgeSlug });
  return NextResponse.json({ guest, mode: "archive" });
}
