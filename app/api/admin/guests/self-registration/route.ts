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

  const mosqueSlug = getMosqueSlugFromRequest(request);

  if (isSupabaseConfigured()) {
    const mosque = await db.getMosqueBySlug(mosqueSlug);
    if (!mosque) {
      return NextResponse.json({ error: "Mosque not found." }, { status: 404 });
    }
    const forbidden = await requireAdminApiPermission("members:read", mosque.id);
    if (forbidden) return forbidden;
    const flagBlocked = await ensureFlag(mosque.id);
    if (flagBlocked) return flagBlocked;
    return NextResponse.json({
      accepts_self_registration: mosque.accepts_self_registration ?? false,
      mosque_slug: mosque.slug,
    });
  }

  if (!shouldUseInMemoryMock()) {
    return NextResponse.json({ error: "Database not configured." }, { status: 503 });
  }
  const mosque = mockDb.getMosqueBySlug(mosqueSlug);
  if (!mosque) {
    return NextResponse.json({ error: "Mosque not found." }, { status: 404 });
  }
  return NextResponse.json({
    accepts_self_registration: mosque.accepts_self_registration ?? false,
    mosque_slug: mosque.slug,
  });
}

export async function PATCH(request: NextRequest) {
  const _rejectMock = rejectIfMockDisabled();
  if (_rejectMock) return _rejectMock;

  const unauthorized = await requireAdminApiAuth();
  if (unauthorized) return unauthorized;

  const mosqueSlug = getMosqueSlugFromRequest(request);
  const body = await request.json().catch(() => ({}));
  const next = Boolean(body.accepts_self_registration);

  if (isSupabaseConfigured()) {
    const mosque = await db.getMosqueBySlug(mosqueSlug);
    if (!mosque) {
      return NextResponse.json({ error: "Mosque not found." }, { status: 404 });
    }
    const forbidden = await requireAdminApiPermission("members:write", mosque.id);
    if (forbidden) return forbidden;
    const flagBlocked = await ensureFlag(mosque.id);
    if (flagBlocked) return flagBlocked;

    try {
      const updated = await db.updateMosque(mosque.id, {
        accepts_self_registration: next,
      });
      await writeAuditLog({
        mosqueId: mosque.id,
        action: next ? "enabled" : "disabled",
        entityType: "mosque",
        entityId: mosque.id,
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

  const mosque = mockDb.getMosqueBySlug(mosqueSlug);
  if (!mosque) {
    return NextResponse.json({ error: "Mosque not found." }, { status: 404 });
  }
  mockDb.upsertMosque({
    slug: mosque.slug,
    name: mosque.name,
    accepts_self_registration: next,
  });
  return NextResponse.json({ accepts_self_registration: next });
}
