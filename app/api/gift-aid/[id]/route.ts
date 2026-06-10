import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import * as db from "@/lib/db";
import { getChurchSlugFromRequest } from "@/lib/tenant";
import {
  requireAdminApiAuth,
  requireAdminApiPermission,
} from "@/lib/auth/api";
import { writeAuditLog } from "@/lib/audit";

async function resolveChurch(request: NextRequest) {
  const churchSlug = getChurchSlugFromRequest(request);
  return db.resolveChurchId(churchSlug);
}

export async function GET(
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
  const { id } = await params;
  const churchId = await resolveChurch(request);
  if (!churchId) {
    return NextResponse.json({ error: "Church not found." }, { status: 404 });
  }
  const forbidden = await requireAdminApiPermission("charity:write", churchId);
  if (forbidden) return forbidden;

  const declaration = await db.getGiftAidDeclarationById(id, churchId);
  if (!declaration) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  return NextResponse.json({ declaration });
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
  const { id } = await params;
  const churchId = await resolveChurch(request);
  if (!churchId) {
    return NextResponse.json({ error: "Church not found." }, { status: 404 });
  }
  const forbidden = await requireAdminApiPermission("charity:write", churchId);
  if (forbidden) return forbidden;

  const body = await request.json();
  const updates: Record<string, unknown> = {};
  for (const key of [
    "donor_name",
    "donor_email",
    "donor_address_line_1",
    "donor_address_line_2",
    "donor_city",
    "donor_postcode",
    "donor_country",
    "declaration_text",
    "declaration_confirmed",
    "confirmation_method",
    "hmrc_eligible",
  ]) {
    if (body[key] !== undefined) updates[key] = body[key];
  }
  if (body.revoke === true) {
    updates.revoked_at = new Date().toISOString();
  } else if (body.revoke === false) {
    updates.revoked_at = null;
  }

  const updated = await db.updateGiftAidDeclaration(id, churchId, updates);
  if (!updated) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  await writeAuditLog({
    churchId,
    action: "gift_aid_declaration_updated",
    entityType: "gift_aid_declaration",
    entityId: id,
    summary: `Updated declaration for ${updated.donor_name}`,
    metadata: updates,
  });

  return NextResponse.json({ declaration: updated });
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
  const { id } = await params;
  const churchId = await resolveChurch(request);
  if (!churchId) {
    return NextResponse.json({ error: "Church not found." }, { status: 404 });
  }
  const forbidden = await requireAdminApiPermission("charity:write", churchId);
  if (forbidden) return forbidden;

  const updated = await db.revokeGiftAidDeclaration(id, churchId);
  if (!updated) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  await writeAuditLog({
    churchId,
    action: "gift_aid_declaration_revoked",
    entityType: "gift_aid_declaration",
    entityId: id,
    summary: `Revoked declaration for ${updated.donor_name}`,
  });

  return NextResponse.json({ declaration: updated });
}
