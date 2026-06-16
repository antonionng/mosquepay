import { NextRequest, NextResponse } from "next/server";
import {
  isSupabaseConfigured,
  shouldUseInMemoryMock,
} from "@/lib/db/with-fallback";
import * as db from "@/lib/db";
import * as mockDb from "@/lib/mock-db";
import {
  generateNewcomerToken,
  hashNewcomerToken,
} from "@/lib/guest-tokens";
import { sendGuestSelfRegisterEmail } from "@/lib/email/guest";
import { filterPubliclyVisible } from "@/lib/events/public-visibility";
import {
  rejectHoneypot,
  rejectRateLimited,
} from "@/lib/api/form-protection";
import { buildPublicUrl, mosqueScopedNewcomerPath } from "@/lib/public-links";

function buildNewcomerUrl(request: NextRequest, mosqueSlug: string, token: string) {
  const base = (
    process.env.NEXT_PUBLIC_SITE_URL ?? request.nextUrl.origin
  ).replace(/\/$/, "");
  return buildPublicUrl(base, mosqueScopedNewcomerPath(mosqueSlug, token));
}

function emailLooksValid(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function trimOrNull(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const honeypotRejected = rejectHoneypot(body);
  if (honeypotRejected) return honeypotRejected;

  const fullName = String(body.full_name ?? "").trim();
  const email = String(body.email ?? "").trim().toLowerCase();
  const phone = trimOrNull(body.phone);
  const ismember = body.is_member === true;
  const motherMosqueName = trimOrNull(body.mother_mosque_name);
  const motherMosqueNumber = trimOrNull(body.mother_mosque_number);
  const constitution = trimOrNull(body.constitution);
  const rank = trimOrNull(body.rank);
  const dietary = trimOrNull(body.dietary_requirements);

  if (!fullName) {
    return NextResponse.json(
      { error: "Your name is required." },
      { status: 400 }
    );
  }
  if (!email || !emailLooksValid(email)) {
    return NextResponse.json(
      { error: "A valid email is required." },
      { status: 400 }
    );
  }

  const rateLimited = rejectRateLimited(request, `visit:${slug}:register`, email);
  if (rateLimited) return rateLimited;

  if (isSupabaseConfigured()) {
    const mosque = await db.getMosqueBySlug(slug);
    if (!mosque || !mosque.accepts_self_registration) {
      return NextResponse.json(
        { error: "This mosque is not currently accepting public registrations." },
        { status: 404 }
      );
    }

    const existing = await db.findGuestByEmail(mosque.id, email);
    const guest = await db.upsertGuest(mosque.id, {
      full_name: fullName,
      email,
      phone,
      mother_mosque_name: ismember ? motherMosqueName : null,
      mother_mosque_number: ismember ? motherMosqueNumber : null,
      constitution: ismember ? constitution : null,
      rank: ismember ? rank : null,
      dietary_requirements: dietary,
      is_member: ismember,
      source: existing ? undefined : "self_register",
      recordVisit: false,
    });

    const newcomerToken = generateNewcomerToken();
    await db.setGuestNewcomerTokenHash(
      guest.id,
      mosque.id,
      hashNewcomerToken(newcomerToken)
    );

    const url = buildNewcomerUrl(request, mosque.slug, newcomerToken);

    const upcoming = await db.getEvents(mosque.id, {
      published: true,
      upcoming: true,
    });
    const openCount = filterPubliclyVisible(upcoming).length;

    sendGuestSelfRegisterEmail({
      toEmail: email,
      toName: fullName,
      mosqueName: mosque.name,
      newcomerPortalUrl: url,
      upcomingCount: openCount,
    }).catch((err) =>
      console.error("Guest self-register email failed:", err)
    );

    return NextResponse.json({ url, guest_id: guest.id });
  }

  if (!shouldUseInMemoryMock()) {
    return NextResponse.json(
      { error: "Database not configured." },
      { status: 503 }
    );
  }

  const mosque = mockDb.getMosqueBySlug(slug);
  if (!mosque || !mosque.accepts_self_registration) {
    return NextResponse.json(
      { error: "This mosque is not currently accepting public registrations." },
      { status: 404 }
    );
  }

  const guest = mockDb.upsertGuest({
    full_name: fullName,
    email,
    phone,
    mother_mosque_name: ismember ? motherMosqueName : null,
    mother_mosque_number: ismember ? motherMosqueNumber : null,
    constitution: ismember ? constitution : null,
    rank: ismember ? rank : null,
    dietary_requirements: dietary,
    is_member: ismember,
    source: "self_register",
    recordVisit: false,
    mosque_slug: mosque.slug,
  });

  const newcomerToken = generateNewcomerToken();
  mockDb.setGuestNewcomerTokenHash(
    guest.id,
    hashNewcomerToken(newcomerToken),
    { mosque_slug: mosque.slug }
  );

  const url = buildNewcomerUrl(request, mosque.slug, newcomerToken);
  return NextResponse.json({ url, guest_id: guest.id });
}
