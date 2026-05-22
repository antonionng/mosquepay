import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import * as db from "@/lib/db";
import { requirePlatformScope } from "@/lib/auth/platform";
import { writeAuditLog } from "@/lib/audit";
import { sendStaffInvite } from "@/lib/auth/invites";

function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Database not configured." },
      { status: 503 }
    );
  }
  const { scope, response } = await requirePlatformScope();
  if (response) return response;

  const body = await request.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "Lodge name is required." }, { status: 400 });
  }

  const requestedSlug =
    typeof body.slug === "string" && body.slug.trim()
      ? slugify(body.slug)
      : slugify(name);
  if (!requestedSlug) {
    return NextResponse.json(
      { error: "Could not derive a URL slug from the name." },
      { status: 400 }
    );
  }

  const existingLodges = await db.listLodges();
  const existingSlugs = new Set(existingLodges.map((l) => l.slug));
  let slug = requestedSlug;
  let attempt = 2;
  while (existingSlugs.has(slug)) {
    slug = `${requestedSlug}-${attempt++}`;
    if (attempt > 50) break;
  }

  const lodge = await db.createLodge({
    slug,
    name,
    province_id: typeof body.province_id === "string" && body.province_id ? body.province_id : null,
    lodge_number: typeof body.lodge_number === "string" ? body.lodge_number : null,
    city: typeof body.city === "string" ? body.city : null,
    secretary_name: typeof body.secretary_name === "string" ? body.secretary_name : null,
  });

  let invite: { sent: boolean; error: string | null; staff_id?: string } = {
    sent: false,
    error: null,
  };

  const secretaryEmail =
    typeof body.secretary_email === "string"
      ? body.secretary_email.trim().toLowerCase()
      : "";
  const secretaryName =
    typeof body.secretary_name === "string" ? body.secretary_name.trim() : "Secretary";
  const sendInvite = body.send_invite === true;

  if (secretaryEmail) {
    try {
      const existingAdmin = await db.getAdminUserForScope(secretaryEmail, lodge.id);
      const staff =
        existingAdmin ??
        (await db.createAdminUser({
          email: secretaryEmail,
          full_name: secretaryName,
          role: "secretary",
          active: true,
          lodge_id: lodge.id,
        }));
      if (sendInvite) {
        const result = await sendStaffInvite({
          request,
          staff,
          lodgeName: lodge.name,
        });
        invite = { ...result, staff_id: staff.id };
      } else {
        invite = { sent: false, error: null, staff_id: staff.id };
      }
    } catch (err) {
      invite = {
        sent: false,
        error: err instanceof Error ? err.message : "Could not invite secretary.",
      };
    }
  }

  await writeAuditLog({
    lodgeId: lodge.id,
    action: "lodge_provisioned",
    entityType: "lodge",
    entityId: lodge.id,
    summary: `Lodge ${lodge.name} provisioned by ${scope.email}`,
    metadata: {
      slug: lodge.slug,
      province_id: lodge.province_id,
      invited: secretaryEmail || null,
      invite_sent: invite.sent,
    },
  });

  return NextResponse.json({ ok: true, lodge, invite });
}
