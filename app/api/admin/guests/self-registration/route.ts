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

function isSchemaMissing(error: unknown) {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "object" && error
        ? JSON.stringify(error)
        : String(error);
  return (
    message.includes("accepts_self_registration") ||
    message.includes("PGRST204") ||
    message.toLowerCase().includes("schema cache")
  );
}

export async function GET(request: NextRequest) {
  const unauthorized = await requireAdminApiAuth();
  if (unauthorized) return unauthorized;

  const lodgeSlug = getLodgeSlugFromRequest(request);

  if (isSupabaseConfigured()) {
    const lodge = await db.getLodgeBySlug(lodgeSlug);
    if (!lodge) {
      return NextResponse.json({ error: "Lodge not found." }, { status: 404 });
    }
    const forbidden = await requireAdminApiPermission("members:read", lodge.id);
    if (forbidden) return forbidden;
    const flagBlocked = await ensureFlag(lodge.id);
    if (flagBlocked) return flagBlocked;
    return NextResponse.json({
      accepts_self_registration: lodge.accepts_self_registration ?? false,
      lodge_slug: lodge.slug,
    });
  }

  if (!shouldUseInMemoryMock()) {
    return NextResponse.json({ error: "Database not configured." }, { status: 503 });
  }
  const lodge = mockDb.getLodgeBySlug(lodgeSlug);
  if (!lodge) {
    return NextResponse.json({ error: "Lodge not found." }, { status: 404 });
  }
  return NextResponse.json({
    accepts_self_registration: lodge.accepts_self_registration ?? false,
    lodge_slug: lodge.slug,
  });
}

export async function PATCH(request: NextRequest) {
  const _rejectMock = rejectIfMockDisabled();
  if (_rejectMock) return _rejectMock;

  const unauthorized = await requireAdminApiAuth();
  if (unauthorized) return unauthorized;

  const lodgeSlug = getLodgeSlugFromRequest(request);
  const body = await request.json().catch(() => ({}));
  const next = Boolean(body.accepts_self_registration);

  if (isSupabaseConfigured()) {
    const lodge = await db.getLodgeBySlug(lodgeSlug);
    if (!lodge) {
      return NextResponse.json({ error: "Lodge not found." }, { status: 404 });
    }
    const forbidden = await requireAdminApiPermission("members:write", lodge.id);
    if (forbidden) return forbidden;
    const flagBlocked = await ensureFlag(lodge.id);
    if (flagBlocked) return flagBlocked;

    try {
      const updated = await db.updateLodge(lodge.id, {
        accepts_self_registration: next,
      });
      await writeAuditLog({
        lodgeId: lodge.id,
        action: next ? "enabled" : "disabled",
        entityType: "lodge",
        entityId: lodge.id,
        summary: next
          ? "Enabled public guest self-registration"
          : "Disabled public guest self-registration",
      });
      return NextResponse.json({
        accepts_self_registration: updated?.accepts_self_registration ?? next,
      });
    } catch (error) {
      if (isSchemaMissing(error)) {
        return NextResponse.json(
          {
            error:
              "Database migration required. Run supabase/migrations/044_public_self_registration.sql in the Supabase SQL Editor, then try again.",
          },
          { status: 503 }
        );
      }
      throw error;
    }
  }

  const lodge = mockDb.getLodgeBySlug(lodgeSlug);
  if (!lodge) {
    return NextResponse.json({ error: "Lodge not found." }, { status: 404 });
  }
  mockDb.upsertLodge({
    slug: lodge.slug,
    name: lodge.name,
    accepts_self_registration: next,
  });
  return NextResponse.json({ accepts_self_registration: next });
}
