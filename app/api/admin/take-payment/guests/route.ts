// Take-payment scoped guests endpoint.
//
// The take-payment flow lets the treasurer attribute a payment to either a
// member, an existing guest, or a brand-new walk-in. We expose a small,
// payments:write-scoped search/create endpoint here so the picker drawer can
// be used by treasurers who don't necessarily have the broader members:read
// permission required by /api/admin/guests.
//
// GET  ?q=…       -> { guests: [...] }  (top matches for the active lodge)
// POST { full_name, email?, phone?, mother_lodge_name?, mother_lodge_number? }
//      -> { guest: {...} }
//
// Bypasses the guest_links feature flag because the payments flow needs to
// be able to log a payer regardless of whether the public guest portal is
// enabled for the lodge.

import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import * as db from "@/lib/db";
import { getAdminReadContext } from "@/lib/admin/read-context";
import {
  requireAdminApiAuth,
  requireAdminApiPermission,
} from "@/lib/auth/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function trimOrNull(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function GET(request: NextRequest) {
  const unauthorized = await requireAdminApiAuth();
  if (unauthorized) return unauthorized;

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ guests: [] });
  }

  const url = new URL(request.url);
  const search = url.searchParams.get("q")?.trim() || undefined;

  // Resolve the lodge from the admin's scope (same logic the page uses), not
  // from the request host/cookie/default. Otherwise a lodge-scoped admin
  // whose ADMIN_LODGE_COOKIE has not been set yet (e.g. a single-lodge
  // treasurer who never used the lodge switcher) lands on the DEFAULT lodge
  // here, fails the permission check, and gets a 401 even though the page
  // rendered fine using their actual lodge.
  const ctx = await getAdminReadContext();
  if (ctx.mode !== "database" || !ctx.lodgeId) {
    return NextResponse.json({ error: "Lodge not selected." }, { status: 404 });
  }
  const lodgeId = ctx.lodgeId;

  const forbidden = await requireAdminApiPermission("payments:write", lodgeId);
  if (forbidden) return forbidden;

  try {
    const guests = await db.listGuests(lodgeId, {
      search,
      includeArchived: false,
    });
    // Trim to a reasonable surface for the picker. The directory can have
    // thousands of rows on busy lodges — the picker only ever shows the top
    // matches, so we cap server-side too.
    const top = guests.slice(0, 50).map((g) => ({
      id: g.id,
      full_name: g.full_name,
      email: g.email ?? null,
      phone: g.phone ?? null,
      mother_lodge_name: g.mother_lodge_name ?? null,
      mother_lodge_number: g.mother_lodge_number ?? null,
    }));
    return NextResponse.json({ guests: top });
  } catch (err) {
    console.error("Take-payment guests GET failed", {
      lodge_id: lodgeId,
      message: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ guests: [] });
  }
}

export async function POST(request: NextRequest) {
  const unauthorized = await requireAdminApiAuth();
  if (unauthorized) return unauthorized;

  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Guest creation is not configured." },
      { status: 503 },
    );
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }

  const fullName = trimOrNull(body.full_name);
  if (!fullName) {
    return NextResponse.json(
      { error: "Full name is required." },
      { status: 400 },
    );
  }

  const ctx = await getAdminReadContext();
  if (ctx.mode !== "database" || !ctx.lodgeId) {
    return NextResponse.json({ error: "Lodge not selected." }, { status: 404 });
  }
  const lodgeId = ctx.lodgeId;

  const forbidden = await requireAdminApiPermission("payments:write", lodgeId);
  if (forbidden) return forbidden;

  const email = trimOrNull(body.email);
  const motherLodgeName = trimOrNull(body.mother_lodge_name);

  // Find-or-create: if a guest with the same email (or same name + mother
  // lodge) already exists we attach to that record. Treasurers add walk-ins
  // mid-meeting — a second visit shouldn't create a duplicate.
  try {
    let guest = null;
    if (email) {
      guest = await db.findGuestByEmail(lodgeId, email);
    }
    if (!guest) {
      guest = await db.findGuestByNameAndLodge(
        lodgeId,
        fullName,
        motherLodgeName,
      );
    }
    if (!guest) {
      guest = await db.createGuest(lodgeId, {
        full_name: fullName,
        email,
        phone: trimOrNull(body.phone),
        mother_lodge_name: motherLodgeName,
        mother_lodge_number: trimOrNull(body.mother_lodge_number),
        is_mason: true,
        source: "admin",
        guest_category: "guest",
      });
    }
    return NextResponse.json({
      guest: {
        id: guest.id,
        full_name: guest.full_name,
        email: guest.email ?? null,
        phone: guest.phone ?? null,
        mother_lodge_name: guest.mother_lodge_name ?? null,
        mother_lodge_number: guest.mother_lodge_number ?? null,
      },
    });
  } catch (err) {
    console.error("Take-payment guests POST failed", {
      lodge_id: lodgeId,
      message: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: "Could not add the guest. Please try again." },
      { status: 500 },
    );
  }
}
