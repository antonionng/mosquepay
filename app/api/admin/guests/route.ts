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

async function ensureFlag(lodgeId: string | null) {
  const enabled = await isFeatureEnabled(lodgeId, "guest_links");
  if (enabled) return null;
  return NextResponse.json(
    { error: "Guest links are disabled for this lodge." },
    { status: 403 }
  );
}

export async function GET(request: NextRequest) {
  const unauthorized = await requireAdminApiAuth();
  if (unauthorized) return unauthorized;

  const url = new URL(request.url);
  const search = url.searchParams.get("q") ?? undefined;
  const includeArchived = url.searchParams.get("archived") === "true";
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
    const guests = await db.listGuests(lodgeId, {
      search: search ?? undefined,
      includeArchived,
    });
    return NextResponse.json({ guests });
  }

  if (!shouldUseInMemoryMock()) {
    return NextResponse.json({ guests: [] });
  }
  const guests = mockDb.listGuests({
    lodge_slug: lodgeSlug,
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

  const lodgeSlug = getLodgeSlugFromRequest(request);
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
    mother_lodge_name: trimOrNull(body.mother_lodge_name),
    mother_lodge_number: trimOrNull(body.mother_lodge_number),
    constitution: trimOrNull(body.constitution),
    rank: trimOrNull(body.rank),
    dietary_requirements: trimOrNull(body.dietary_requirements),
    is_mason: parseBoolean(body.is_mason, true),
    notes: trimOrNull(body.notes),
  };

  if (isSupabaseConfigured()) {
    const lodgeId = await db.resolveLodgeId(lodgeSlug);
    if (!lodgeId) {
      return NextResponse.json({ error: "Lodge not found." }, { status: 404 });
    }
    const forbidden = await requireAdminApiPermission("members:write", lodgeId);
    if (forbidden) return forbidden;
    const flagBlocked = await ensureFlag(lodgeId);
    if (flagBlocked) return flagBlocked;

    const guest = await db.createGuest(lodgeId, {
      ...payload,
      first_seen_event_id: null,
      last_seen_event_id: null,
      visit_count: 0,
      archived_at: null,
      visitor_token_hash: null,
    });

    await writeAuditLog({
      lodgeId,
      action: "created",
      entityType: "guest",
      entityId: guest.id,
      summary: `Added guest ${guest.full_name}`,
      metadata: {
        is_mason: guest.is_mason,
        mother_lodge_name: guest.mother_lodge_name,
      },
    });

    return NextResponse.json({ guest });
  }

  const guest = mockDb.createGuestRecord({ ...payload, lodge_slug: lodgeSlug });
  return NextResponse.json({ guest });
}
