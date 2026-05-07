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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
  const { id } = await params;
  const body = await request.json();
  if (!body.lodge_id) {
    return NextResponse.json({ error: "lodge_id is required." }, { status: 400 });
  }
  await db.setLodgeProvince(body.lodge_id, id);
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
  const { id: provinceId } = await params;
  const { searchParams } = new URL(request.url);
  const lodgeId = searchParams.get("lodge_id");
  if (!lodgeId) {
    return NextResponse.json({ error: "lodge_id is required." }, { status: 400 });
  }
  // Only unlink if it currently belongs to this province (defensive).
  const lodges = await db.listLodgesByProvince(provinceId);
  if (!lodges.find((l) => l.id === lodgeId)) {
    return NextResponse.json({ error: "Lodge not in this province." }, { status: 400 });
  }
  await db.setLodgeProvince(lodgeId, null);
  return NextResponse.json({ ok: true });
}
