import { NextRequest, NextResponse } from "next/server";
import {
  isSupabaseConfigured,
  shouldUseInMemoryMock,
} from "@/lib/db/with-fallback";
import * as db from "@/lib/db";
import * as mockDb from "@/lib/mock-db";
import { hashNewcomerToken } from "@/lib/guest-tokens";

const EDITABLE = [
  "full_name",
  "email",
  "phone",
  "dietary_requirements",
] as const;

function trimOrNull(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const tokenHash = hashNewcomerToken(token);

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const patch: Record<string, string | null> = {};
  for (const key of EDITABLE) {
    if (!(key in body)) continue;
    if (key === "full_name") {
      const next = trimOrNull(body.full_name);
      if (next) patch.full_name = next;
    } else {
      patch[key] = trimOrNull(body[key]);
    }
  }

  if (isSupabaseConfigured()) {
    const guest = await db.getGuestByNewcomerTokenHash(tokenHash);
    if (!guest) {
      return NextResponse.json(
        { error: "Newcomer profile not found." },
        { status: 404 }
      );
    }
    if (guest.archived_at) {
      return NextResponse.json(
        { error: "This newcomer profile is no longer active." },
        { status: 410 }
      );
    }
    const updated = await db.updateGuest(guest.id, guest.church_id, patch);
    return NextResponse.json({
      guest: {
        id: updated.id,
        full_name: updated.full_name,
        email: updated.email,
        phone: updated.phone,
        dietary_requirements: updated.dietary_requirements,
      },
    });
  }

  if (!shouldUseInMemoryMock()) {
    return NextResponse.json(
      { error: "Database not configured." },
      { status: 503 }
    );
  }

  const guest = mockDb.getGuestByNewcomerTokenHash(tokenHash);
  if (!guest) {
    return NextResponse.json(
      { error: "Newcomer profile not found." },
      { status: 404 }
    );
  }
  const updated = mockDb.updateGuestRecord(guest.id, patch, {
    church_slug: guest.church_slug,
  });
  return NextResponse.json({
    guest: updated
      ? {
          id: updated.id,
          full_name: updated.full_name,
          email: updated.email,
          phone: updated.phone,
          dietary_requirements: updated.dietary_requirements,
        }
      : null,
  });
}
