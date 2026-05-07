import { NextRequest, NextResponse } from "next/server";
import { requireAdminApiPermission } from "@/lib/auth/api";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import * as db from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { getLodgeSlugFromRequest } from "@/lib/tenant";
import { sendStaffInvite as sendInvite } from "@/lib/auth/invites";

const ROLES = new Set([
  "secretary",
  "treasurer",
  "charity_steward",
  "membership_officer",
  "operator",
]);

function cleanEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function cleanName(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function cleanRole(value: unknown) {
  return typeof value === "string" && ROLES.has(value) ? value : "secretary";
}

async function selectedLodgeId(request: NextRequest) {
  const lodgeSlug = getLodgeSlugFromRequest(request);
  const lodgeId = await db.resolveLodgeId(lodgeSlug);
  return { lodgeSlug, lodgeId };
}

async function sendStaffInvite({
  request,
  staff,
  lodgeSlug,
}: {
  request: NextRequest;
  staff: db.AdminUser;
  lodgeSlug: string;
}) {
  return sendInvite({ request, staff, lodgeName: lodgeSlug });
}

export async function GET(request: NextRequest) {
  const { lodgeId } = await selectedLodgeId(request);
  if (!lodgeId) {
    return NextResponse.json({ error: "Lodge not found." }, { status: 404 });
  }

  const forbidden = await requireAdminApiPermission("admin:all", lodgeId);
  if (forbidden) return forbidden;

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ staff: [] });
  }

  const staff = await db.listAdminUsersForLodge(lodgeId);
  return NextResponse.json({ staff });
}

export async function POST(request: NextRequest) {
  const { lodgeSlug, lodgeId } = await selectedLodgeId(request);
  if (!lodgeId) {
    return NextResponse.json({ error: "Lodge not found." }, { status: 404 });
  }

  const forbidden = await requireAdminApiPermission("admin:all", lodgeId);
  if (forbidden) return forbidden;

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Database not configured." }, { status: 503 });
  }

  const body = await request.json().catch(() => ({}));
  const email = cleanEmail(body.email);
  const fullName = cleanName(body.full_name);
  const role = cleanRole(body.role);
  const active = body.active !== false;

  if (!email || !fullName) {
    return NextResponse.json(
      { error: "Name and email are required." },
      { status: 400 }
    );
  }

  const staff = await db.createAdminUser({
    lodge_id: role === "operator" ? null : lodgeId,
    email,
    full_name: fullName,
    role,
    active,
    permissions: [],
  });

  await writeAuditLog({
    lodgeId,
    action: "created",
    entityType: "admin_user",
    entityId: staff.id,
    summary: `Created staff user ${staff.email}`,
    metadata: { role: staff.role, scoped_lodge_id: staff.lodge_id },
  });

  const invite = await sendStaffInvite({ request, staff, lodgeSlug });
  if (invite.sent) {
    await writeAuditLog({
      lodgeId,
      action: "invited",
      entityType: "admin_user",
      entityId: staff.id,
      summary: `Sent staff invite to ${staff.email}`,
      metadata: { via: "resend" },
    });
  }

  return NextResponse.json({ staff, invite }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const { lodgeSlug, lodgeId } = await selectedLodgeId(request);
  if (!lodgeId) {
    return NextResponse.json({ error: "Lodge not found." }, { status: 404 });
  }

  const forbidden = await requireAdminApiPermission("admin:all", lodgeId);
  if (forbidden) return forbidden;

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Database not configured." }, { status: 503 });
  }

  const body = await request.json().catch(() => ({}));
  const id = typeof body.id === "string" ? body.id : "";
  if (!id) {
    return NextResponse.json({ error: "Staff id is required." }, { status: 400 });
  }

  if (body.action === "send_invite") {
    const existing = (await db.listAdminUsersForLodge(lodgeId)).find(
      (member) => member.id === id
    );
    if (!existing) {
      return NextResponse.json({ error: "Staff user not found." }, { status: 404 });
    }
    const invite = await sendStaffInvite({ request, staff: existing, lodgeSlug });
    if (!invite.sent) {
      return NextResponse.json(
        { error: invite.error ?? "Could not send invite." },
        { status: 500 }
      );
    }
    await writeAuditLog({
      lodgeId,
      action: "invited",
      entityType: "admin_user",
      entityId: existing.id,
      summary: `Sent staff invite to ${existing.email}`,
      metadata: { via: "resend" },
    });
    return NextResponse.json({ invite });
  }

  const role = cleanRole(body.role);
  const fullName = cleanName(body.full_name);
  const updates = {
    full_name: fullName,
    role,
    active: body.active !== false,
    lodge_id: role === "operator" ? null : lodgeId,
    permissions: Array.isArray(body.permissions) ? body.permissions : [],
  };

  if (!updates.full_name) {
    return NextResponse.json({ error: "Name is required." }, { status: 400 });
  }

  const staff = await db.updateAdminUser(id, updates);
  if (!staff) {
    return NextResponse.json({ error: "Staff user not found." }, { status: 404 });
  }

  await writeAuditLog({
    lodgeId,
    action: "updated",
    entityType: "admin_user",
    entityId: staff.id,
    summary: `Updated staff user ${staff.email}`,
    metadata: { role: staff.role, active: staff.active, scoped_lodge_id: staff.lodge_id },
  });

  return NextResponse.json({ staff });
}
