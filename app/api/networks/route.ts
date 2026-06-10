import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import * as db from "@/lib/db";
import { requireAdminApiAuth } from "@/lib/auth/api";
import { getCurrentAdminScope } from "@/lib/auth/permissions";

async function requirePlatform() {
  const scope = await getCurrentAdminScope();
  if (scope.kind === "platform" || scope.kind === "dummy") return null;
  return NextResponse.json(
    { error: "Platform-level access required." },
    { status: 403 }
  );
}

export async function GET() {
  const unauthorized = await requireAdminApiAuth();
  if (unauthorized) return unauthorized;
  if (!isSupabaseConfigured()) return NextResponse.json({ networks: [] });
  const forbidden = await requirePlatform();
  if (forbidden) return forbidden;
  return NextResponse.json({ networks: await db.listNetworks() });
}

export async function POST(request: NextRequest) {
  const unauthorized = await requireAdminApiAuth();
  if (unauthorized) return unauthorized;
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Database not configured." },
      { status: 503 }
    );
  }
  const forbidden = await requirePlatform();
  if (forbidden) return forbidden;
  const body = await request.json();
  if (!body.name || !body.slug) {
    return NextResponse.json(
      { error: "name and slug are required." },
      { status: 400 }
    );
  }
  const network = await db.createNetwork({
    slug: String(body.slug).toLowerCase().trim(),
    name: body.name,
    jurisdiction: body.jurisdiction ?? null,
    country: body.country ?? "United Kingdom",
    contact_email: body.contact_email ?? null,
    contact_phone: body.contact_phone ?? null,
    primary_color: body.primary_color ?? null,
    notes: body.notes ?? null,
    is_active: body.is_active ?? true,
  });
  return NextResponse.json({ network }, { status: 201 });
}
