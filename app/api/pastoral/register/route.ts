import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import * as db from "@/lib/db";
import { getMosqueSlugFromRequest } from "@/lib/tenant";
import {
  requireAdminApiAuth,
  requireAdminApiPermission,
} from "@/lib/auth/api";
import { writeAuditLog } from "@/lib/audit";

export async function POST(request: NextRequest) {
  const unauthorized = await requireAdminApiAuth();
  if (unauthorized) return unauthorized;
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Database not configured." },
      { status: 503 }
    );
  }
  const mosqueSlug = getMosqueSlugFromRequest(request);
  const mosqueId = await db.resolveMosqueId(mosqueSlug);
  if (!mosqueId) {
    return NextResponse.json({ error: "Mosque not found." }, { status: 404 });
  }
  const forbidden = await requireAdminApiPermission("pastoral:write", mosqueId);
  if (forbidden) return forbidden;

  const body = await request.json();
  const entry = await db.createPastoralCareRegister(mosqueId, {
    member_id: body.member_id ?? null,
    register_type: body.register_type ?? "bereavement",
    full_name: body.full_name?.trim() ?? "",
    relationship: body.relationship?.trim() ?? null,
    contact_email: body.contact_email?.trim() ?? null,
    contact_phone: body.contact_phone?.trim() ?? null,
    address: body.address?.trim() ?? null,
    date_of_event: body.date_of_event ?? null,
    last_contact_at: body.last_contact_at ?? null,
    notes: body.notes?.trim() ?? null,
  });

  await writeAuditLog({
    mosqueId,
    action: "pastoral_register_added",
    entityType: "pastoral_register",
    entityId: entry.id,
    summary: `Added ${entry.register_type} register entry: ${entry.full_name}`,
    metadata: { register_type: entry.register_type },
  });

  return NextResponse.json({ entry }, { status: 201 });
}
