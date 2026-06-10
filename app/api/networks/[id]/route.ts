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

export async function PATCH(
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
  const network = await db.updateNetwork(id, body);
  if (!network) {
    return NextResponse.json({ error: "Network not found." }, { status: 404 });
  }
  return NextResponse.json({ network });
}
