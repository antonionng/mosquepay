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

const EDITABLE_KEYS = [
  "full_name",
  "email",
  "phone",
  "mother_mosque_name",
  "mother_mosque_number",
  "constitution",
  "rank",
  "dietary_requirements",
  "is_member",
  "notes",
  "guest_category",
  "guest_dining_amount",
  "dining_waived",
  "gift_aid_consent_status",
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
    if (key === "is_member") {
      patch.is_member = Boolean(body.is_member);
    } else if (key === "dining_waived") {
      patch.dining_waived = Boolean(body.dining_waived);
    } else if (key === "guest_category") {
      const cat = body.guest_category;
      if (cat === "guest" || cat === "honorary_guest") {
        patch.guest_category = cat;
      }
    } else if (key === "gift_aid_consent_status") {
      const status = body.gift_aid_consent_status;
      if (status === "unknown" || status === "declared" || status === "declined") {
        patch.gift_aid_consent_status = status;
      }
    } else if (key === "guest_dining_amount") {
      if (body.guest_dining_amount === null || body.guest_dining_amount === "") {
        patch.guest_dining_amount = null;
      } else {
        patch.guest_dining_amount = Number(body.guest_dining_amount);
      }
    } else if (key === "full_name") {
      const next = trimOrNull(body.full_name);
      if (next) patch.full_name = next;
    } else {
      patch[key as EditableKey] = trimOrNull(body[key]);
    }
  }
  return patch;
}

async function ensureFlag(mosqueId: string | null) {
  const enabled = await isFeatureEnabled(mosqueId, "guest_links");
  if (enabled) return null;
  return NextResponse.json(
    { error: "Guest links are disabled for this mosque." },
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
  const mosqueSlug = getMosqueSlugFromRequest(request);

  if (isSupabaseConfigured()) {
    const mosqueId = await db.resolveMosqueId(mosqueSlug);
    if (!mosqueId) {
      return NextResponse.json({ error: "Mosque not found." }, { status: 404 });
    }
    const forbidden = await requireAdminApiPermission("members:read", mosqueId);
    if (forbidden) return forbidden;
    const flagBlocked = await ensureFlag(mosqueId);
    if (flagBlocked) return flagBlocked;
    const guest = await db.getGuestById(id, mosqueId);
    if (!guest) {
      return NextResponse.json({ error: "Guest not found." }, { status: 404 });
    }
    return NextResponse.json({ guest });
  }

  if (!shouldUseInMemoryMock()) {
    return NextResponse.json({ error: "Guest not found." }, { status: 404 });
  }
  const guest = mockDb.getGuestById(id, { mosque_slug: mosqueSlug });
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
  const mosqueSlug = getMosqueSlugFromRequest(request);
  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const patch = pickPatch(body);

  if (isSupabaseConfigured()) {
    const mosqueId = await db.resolveMosqueId(mosqueSlug);
    if (!mosqueId) {
      return NextResponse.json({ error: "Mosque not found." }, { status: 404 });
    }
    const forbidden = await requireAdminApiPermission("members:write", mosqueId);
    if (forbidden) return forbidden;
    const flagBlocked = await ensureFlag(mosqueId);
    if (flagBlocked) return flagBlocked;

    const existing = await db.getGuestById(id, mosqueId);
    if (!existing) {
      return NextResponse.json({ error: "Guest not found." }, { status: 404 });
    }
    const guest = await db.updateGuest(id, mosqueId, patch);
    await writeAuditLog({
      mosqueId,
      action: "updated",
      entityType: "guest",
      entityId: guest.id,
      summary: `Updated guest ${guest.full_name}`,
      metadata: { fields: Object.keys(patch) },
    });
    return NextResponse.json({ guest });
  }

  const guest = mockDb.updateGuestRecord(id, patch, { mosque_slug: mosqueSlug });
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
  const mosqueSlug = getMosqueSlugFromRequest(request);
  const url = new URL(request.url);
  const action = url.searchParams.get("action") ?? "archive";

  if (isSupabaseConfigured()) {
    const mosqueId = await db.resolveMosqueId(mosqueSlug);
    if (!mosqueId) {
      return NextResponse.json({ error: "Mosque not found." }, { status: 404 });
    }
    const forbidden = await requireAdminApiPermission("members:write", mosqueId);
    if (forbidden) return forbidden;
    const flagBlocked = await ensureFlag(mosqueId);
    if (flagBlocked) return flagBlocked;

    const existing = await db.getGuestById(id, mosqueId);
    if (!existing) {
      return NextResponse.json({ error: "Guest not found." }, { status: 404 });
    }

    if (action === "purge") {
      const result = await db.hardDeleteGuestIfUnused(id, mosqueId);
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
        mosqueId,
        action: "deleted",
        entityType: "guest",
        entityId: id,
        summary: `Permanently deleted guest ${existing.full_name}`,
      });
      return NextResponse.json({ success: true, mode: "purge" });
    }

    if (action === "restore") {
      const guest = await db.restoreGuest(id, mosqueId);
      await writeAuditLog({
        mosqueId,
        action: "restored",
        entityType: "guest",
        entityId: id,
        summary: `Restored guest ${guest.full_name}`,
      });
      return NextResponse.json({ guest, mode: "restore" });
    }

    const guest = await db.archiveGuest(id, mosqueId);
    await writeAuditLog({
      mosqueId,
      action: "archived",
      entityType: "guest",
      entityId: id,
      summary: `Archived guest ${guest.full_name}`,
    });
    return NextResponse.json({ guest, mode: "archive" });
  }

  if (action === "purge") {
    const ok = mockDb.hardDeleteGuestRecordIfUnused(id, {
      mosque_slug: mosqueSlug,
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
    const guest = mockDb.restoreGuestRecord(id, { mosque_slug: mosqueSlug });
    return NextResponse.json({ guest, mode: "restore" });
  }
  const guest = mockDb.archiveGuestRecord(id, { mosque_slug: mosqueSlug });
  return NextResponse.json({ guest, mode: "archive" });
}
