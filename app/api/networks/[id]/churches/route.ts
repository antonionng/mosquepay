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
  if (!body.church_id) {
    return NextResponse.json({ error: "church_id is required." }, { status: 400 });
  }
  await db.setChurchNetwork(body.church_id, id);
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
  const { id: networkId } = await params;
  const { searchParams } = new URL(request.url);
  const churchId = searchParams.get("church_id");
  if (!churchId) {
    return NextResponse.json({ error: "church_id is required." }, { status: 400 });
  }
  // Only unlink if it currently belongs to this network (defensive).
  const churches = await db.listChurchesByNetwork(networkId);
  if (!churches.find((l) => l.id === churchId)) {
    return NextResponse.json({ error: "Church not in this network." }, { status: 400 });
  }
  await db.setChurchNetwork(churchId, null);
  return NextResponse.json({ ok: true });
}
