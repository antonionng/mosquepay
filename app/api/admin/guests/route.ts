import { NextRequest, NextResponse } from "next/server";
import {
  isSupabaseConfigured,
  shouldUseInMemoryMock,
} from "@/lib/db/with-fallback";
import { rejectIfMockDisabled } from "@/lib/db/reject-mock";
import * as db from "@/lib/db";
import * as mockDb from "@/lib/mock-db";
import { getChurchSlugFromRequest } from "@/lib/tenant";
import {
  requireAdminApiAuth,
  requireAdminApiPermission,
} from "@/lib/auth/api";
import { writeAuditLog } from "@/lib/audit";
import { isFeatureEnabled } from "@/lib/feature-flags";

function parseBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
}

function trimOrNull(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function giftAidStatus(value: unknown): "unknown" | "declared" | "declined" {
  return value === "declared" || value === "declined" ? value : "unknown";
}

async function ensureFlag(churchId: string | null) {
  const enabled = await isFeatureEnabled(churchId, "guest_links");
  if (enabled) return null;
  return NextResponse.json(
    { error: "Guest links are disabled for this church." },
    { status: 403 }
  );
}

export async function GET(request: NextRequest) {
  const unauthorized = await requireAdminApiAuth();
  if (unauthorized) return unauthorized;

  const url = new URL(request.url);
  const search = url.searchParams.get("q") ?? undefined;
  const includeArchived = url.searchParams.get("archived") === "true";
  const churchSlug = getChurchSlugFromRequest(request);

  if (isSupabaseConfigured()) {
    const churchId = await db.resolveChurchId(churchSlug);
    if (!churchId) {
      return NextResponse.json({ error: "Church not found." }, { status: 404 });
    }
    const forbidden = await requireAdminApiPermission("members:read", churchId);
    if (forbidden) return forbidden;
    const flagBlocked = await ensureFlag(churchId);
    if (flagBlocked) return flagBlocked;
    const guests = await db.listGuests(churchId, {
      search: search ?? undefined,
      includeArchived,
    });
    return NextResponse.json({ guests });
  }

  if (!shouldUseInMemoryMock()) {
    return NextResponse.json({ guests: [] });
  }
  const guests = mockDb.listGuests({
    church_slug: churchSlug,
    search: search ?? undefined,
    includeArchived,
  });
  return NextResponse.json({ guests });
}

export async function POST(request: NextRequest) {
  const _rejectMock = rejectIfMockDisabled();
  if (_rejectMock) return _rejectMock;

  const unauthorized = await requireAdminApiAuth();
  if (unauthorized) return unauthorized;

  const churchSlug = getChurchSlugFromRequest(request);
  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const fullName = trimOrNull(body.full_name);
  if (!fullName) {
    return NextResponse.json(
      { error: "Full name is required." },
      { status: 400 }
    );
  }

  const payload = {
    full_name: fullName,
    email: trimOrNull(body.email),
    phone: trimOrNull(body.phone),
    mother_church_name: trimOrNull(body.mother_church_name),
    mother_church_number: trimOrNull(body.mother_church_number),
    constitution: trimOrNull(body.constitution),
    rank: trimOrNull(body.rank),
    dietary_requirements: trimOrNull(body.dietary_requirements),
    is_member: parseBoolean(body.is_member, true),
    notes: trimOrNull(body.notes),
    guest_category:
      body.guest_category === "honorary_guest"
        ? ("honorary_guest" as const)
        : ("guest" as const),
    guest_dining_amount:
      body.guest_dining_amount != null && body.guest_dining_amount !== ""
        ? Number(body.guest_dining_amount)
        : null,
    dining_waived: body.dining_waived === true,
    gift_aid_consent_status: giftAidStatus(body.gift_aid_consent_status),
  };

  if (isSupabaseConfigured()) {
    const churchId = await db.resolveChurchId(churchSlug);
    if (!churchId) {
      return NextResponse.json({ error: "Church not found." }, { status: 404 });
    }
    const forbidden = await requireAdminApiPermission("members:write", churchId);
    if (forbidden) return forbidden;
    const flagBlocked = await ensureFlag(churchId);
    if (flagBlocked) return flagBlocked;

    const guest = await db.createGuest(churchId, {
      ...payload,
      first_seen_event_id: null,
      last_seen_event_id: null,
      visit_count: 0,
      archived_at: null,
      newcomer_token_hash: null,
    });

    await writeAuditLog({
      churchId,
      action: "created",
      entityType: "guest",
      entityId: guest.id,
      summary: `Added guest ${guest.full_name}`,
      metadata: {
        is_member: guest.is_member,
        mother_church_name: guest.mother_church_name,
      },
    });

    return NextResponse.json({ guest });
  }

  const guest = mockDb.createGuestRecord({ ...payload, church_slug: churchSlug });
  return NextResponse.json({ guest });
}
