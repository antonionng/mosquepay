import { NextRequest, NextResponse } from "next/server";
import {
  isSupabaseConfigured,
  shouldUseInMemoryMock,
} from "@/lib/db/with-fallback";
import * as db from "@/lib/db";
import * as mockDb from "@/lib/mock-db";
import {
  generateVisitorToken,
  hashVisitorToken,
} from "@/lib/guest-tokens";
import { sendGuestSelfRegisterEmail } from "@/lib/email/guest";
import {
  rejectHoneypot,
  rejectRateLimited,
} from "@/lib/api/form-protection";
import { buildPublicUrl, lodgeScopedVisitorPath } from "@/lib/public-links";

function buildVisitorUrl(request: NextRequest, lodgeSlug: string, token: string) {
  const base = (
    process.env.NEXT_PUBLIC_SITE_URL ?? request.nextUrl.origin
  ).replace(/\/$/, "");
  return buildPublicUrl(base, lodgeScopedVisitorPath(lodgeSlug, token));
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
  const isMason = body.is_mason === true;
  const motherLodgeName = trimOrNull(body.mother_lodge_name);
  const motherLodgeNumber = trimOrNull(body.mother_lodge_number);
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
    const lodge = await db.getLodgeBySlug(slug);
    if (!lodge || !lodge.accepts_self_registration) {
      return NextResponse.json(
        { error: "This lodge is not currently accepting public registrations." },
        { status: 404 }
      );
    }

    const existing = await db.findGuestByEmail(lodge.id, email);
    const guest = await db.upsertGuest(lodge.id, {
      full_name: fullName,
      email,
      phone,
      mother_lodge_name: isMason ? motherLodgeName : null,
      mother_lodge_number: isMason ? motherLodgeNumber : null,
      constitution: isMason ? constitution : null,
      rank: isMason ? rank : null,
      dietary_requirements: dietary,
      is_mason: isMason,
      source: existing ? undefined : "self_register",
      recordVisit: false,
    });

    const visitorToken = generateVisitorToken();
    await db.setGuestVisitorTokenHash(
      guest.id,
      lodge.id,
      hashVisitorToken(visitorToken)
    );

    const url = buildVisitorUrl(request, lodge.slug, visitorToken);

    const upcoming = await db.getEvents(lodge.id, {
      published: true,
      upcoming: true,
    });
    const openCount = upcoming.filter(
      (e) => e.guest_policy !== "closed"
    ).length;

    sendGuestSelfRegisterEmail({
      toEmail: email,
      toName: fullName,
      lodgeName: lodge.name,
      visitorPortalUrl: url,
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

  const lodge = mockDb.getLodgeBySlug(slug);
  if (!lodge || !lodge.accepts_self_registration) {
    return NextResponse.json(
      { error: "This lodge is not currently accepting public registrations." },
      { status: 404 }
    );
  }

  const guest = mockDb.upsertGuest({
    full_name: fullName,
    email,
    phone,
    mother_lodge_name: isMason ? motherLodgeName : null,
    mother_lodge_number: isMason ? motherLodgeNumber : null,
    constitution: isMason ? constitution : null,
    rank: isMason ? rank : null,
    dietary_requirements: dietary,
    is_mason: isMason,
    source: "self_register",
    recordVisit: false,
    lodge_slug: lodge.slug,
  });

  const visitorToken = generateVisitorToken();
  mockDb.setGuestVisitorTokenHash(
    guest.id,
    hashVisitorToken(visitorToken),
    { lodge_slug: lodge.slug }
  );

  const url = buildVisitorUrl(request, lodge.slug, visitorToken);
  return NextResponse.json({ url, guest_id: guest.id });
}
