import { NextRequest, NextResponse } from "next/server";
import { requireAdminApiPermission } from "@/lib/auth/api";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import * as db from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { getAdminReadContext } from "@/lib/admin/read-context";
import {
  sendStaffInvite as sendInvite,
  sendStaffPasswordReset,
} from "@/lib/auth/invites";

const ROLES = new Set([
  "secretary",
  "treasurer",
  "charity_steward",
  "membership_officer",
  "pastoral_care",
  "master",
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

async function selectedMosqueId(_request: NextRequest) {
  // Resolve the mosque from the admin's scope (same logic the page uses), not
  // from the request host/cookie/default. Otherwise a mosque-scoped admin
  // whose ADMIN_MOSQUE_COOKIE has not been set yet (e.g. a single-mosque
  // secretary who never used the mosque switcher) lands on the DEFAULT mosque
  // here, fails the admin:all permission check, and gets a 401 even though
  // the page rendered fine using their actual mosque.
  const ctx = await getAdminReadContext();
  if (ctx.mode !== "database" || !ctx.mosqueId) {
    return { mosqueSlug: ctx.mode === "database" ? ctx.mosqueSlug : "", mosqueId: null };
  }
  return { mosqueSlug: ctx.mosqueSlug, mosqueId: ctx.mosqueId };
}

async function sendStaffInvite({
  request,
  staff,
  mosqueSlug,
}: {
  request: NextRequest;
  staff: db.AdminUser;
  mosqueSlug: string;
}) {
  return sendInvite({ request, staff, mosqueName: mosqueSlug });
}

export async function GET(request: NextRequest) {
  const { mosqueId } = await selectedMosqueId(request);
  if (!mosqueId) {
    return NextResponse.json({ error: "Mosque not found." }, { status: 404 });
  }

  const forbidden = await requireAdminApiPermission("admin:all", mosqueId);
  if (forbidden) return forbidden;

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ staff: [] });
  }

  const staff = await db.listAdminUsersForMosque(mosqueId);
  return NextResponse.json({ staff });
}

export async function POST(request: NextRequest) {
  const { mosqueSlug, mosqueId } = await selectedMosqueId(request);
  if (!mosqueId) {
    return NextResponse.json({ error: "Mosque not found." }, { status: 404 });
  }

  const forbidden = await requireAdminApiPermission("admin:all", mosqueId);
  if (forbidden) return forbidden;

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Database not configured." }, { status: 503 });
  }

  const body = await request.json().catch(() => ({}));
  const email = cleanEmail(body.email);
  const fullName = cleanName(body.full_name);
  const role = cleanRole(body.role);
  const active = body.active !== false;
  const sendInvite = body.send_invite === true;

  if (!email || !fullName) {
    return NextResponse.json(
      { error: "Name and email are required." },
      { status: 400 }
    );
  }

  const staff = await db.createAdminUser({
    mosque_id: mosqueId,
    email,
    full_name: fullName,
    role,
    active,
    permissions: [],
  });

  await writeAuditLog({
    mosqueId,
    action: "created",
    entityType: "admin_user",
    entityId: staff.id,
    summary: `Created staff user ${staff.email}`,
    metadata: { role: staff.role, scoped_mosque_id: staff.mosque_id },
  });

  let invite: { sent: boolean; error: string | null } = {
    sent: false,
    error: null,
  };
  if (sendInvite) {
    invite = await sendStaffInvite({ request, staff, mosqueSlug });
    if (invite.sent) {
      await writeAuditLog({
        mosqueId,
        action: "invited",
        entityType: "admin_user",
        entityId: staff.id,
        summary: `Sent staff invite to ${staff.email}`,
        metadata: { via: "resend" },
      });
    }
  }

  return NextResponse.json({ staff, invite }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const { mosqueSlug, mosqueId } = await selectedMosqueId(request);
  if (!mosqueId) {
    return NextResponse.json({ error: "Mosque not found." }, { status: 404 });
  }

  const forbidden = await requireAdminApiPermission("admin:all", mosqueId);
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
    const existing = (await db.listAdminUsersForMosque(mosqueId)).find(
      (member) => member.id === id
    );
    if (!existing) {
      return NextResponse.json({ error: "Staff user not found." }, { status: 404 });
    }
    const invite = await sendStaffInvite({ request, staff: existing, mosqueSlug });
    if (!invite.sent) {
      return NextResponse.json(
        { error: invite.error ?? "Could not send invite." },
        { status: 500 }
      );
    }
    await writeAuditLog({
      mosqueId,
      action: "invited",
      entityType: "admin_user",
      entityId: existing.id,
      summary: `Sent staff invite to ${existing.email}`,
      metadata: { via: "resend" },
    });
    return NextResponse.json({ invite });
  }

  if (body.action === "send_password_reset") {
    const existing = (await db.listAdminUsersForMosque(mosqueId)).find(
      (member) => member.id === id
    );
    if (!existing) {
      return NextResponse.json({ error: "Staff user not found." }, { status: 404 });
    }
    const mosque = await db.getMosqueById(mosqueId).catch(() => null);
    const reset = await sendStaffPasswordReset({
      request,
      staff: existing,
      mosqueName: mosque?.name ?? mosqueSlug,
    });
    if (!reset.sent) {
      return NextResponse.json(
        { error: reset.error ?? "Could not send password reset email." },
        { status: 500 }
      );
    }
    await writeAuditLog({
      mosqueId,
      action: "password_reset_sent",
      entityType: "admin_user",
      entityId: existing.id,
      summary: `Sent password reset email to ${existing.email}`,
      metadata: { via: "resend" },
    });
    return NextResponse.json({ reset });
  }

  const role = cleanRole(body.role);
  const fullName = cleanName(body.full_name);
  const updates = {
    full_name: fullName,
    role,
    active: body.active !== false,
    mosque_id: mosqueId,
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
    mosqueId,
    action: "updated",
    entityType: "admin_user",
    entityId: staff.id,
    summary: `Updated staff user ${staff.email}`,
    metadata: { role: staff.role, active: staff.active, scoped_mosque_id: staff.mosque_id },
  });

  return NextResponse.json({ staff });
}
