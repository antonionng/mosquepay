import { NextRequest, NextResponse } from "next/server";
import { requireAdminApiAuth } from "@/lib/auth/api";
import {
  requirePlatformOwnerScope,
  requirePlatformScope,
} from "@/lib/auth/platform";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import { sendStaffInvite, sendStaffPasswordReset } from "@/lib/auth/invites";
import { writeAuditLog } from "@/lib/audit";
import * as db from "@/lib/db";

const TENANT_ROLES = new Set([
  "super_admin",
  "secretary",
  "treasurer",
  "charity_steward",
  "membership_officer",
  "almoner",
  "master",
]);

const PLATFORM_ROLES = new Set(["super_admin", "operator"]);

function cleanEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function cleanName(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function roleFrom(value: unknown, roles: Set<string>, fallback: string) {
  return typeof value === "string" && roles.has(value) ? value : fallback;
}

function scopeEmail(scope: Awaited<ReturnType<typeof requirePlatformScope>>["scope"]) {
  return "email" in scope ? scope.email : "unknown";
}

async function upsertAdminMembership({
  email,
  fullName,
  role,
  lodgeId,
}: {
  email: string;
  fullName: string;
  role: string;
  lodgeId: string | null;
}) {
  const existing = await db.getAdminUserForScope(email, lodgeId);
  if (existing) {
    return db.updateAdminUser(existing.id, {
      full_name: fullName,
      role,
      active: true,
      lodge_id: lodgeId,
      permissions: existing.permissions ?? [],
    });
  }
  return db.createAdminUser({
    email,
    full_name: fullName,
    role,
    active: true,
    lodge_id: lodgeId,
    permissions: [],
  });
}

export async function GET() {
  const unauthorized = await requireAdminApiAuth();
  if (unauthorized) return unauthorized;
  const { response } = await requirePlatformScope();
  if (response) return response;

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ platformAdmins: [], tenantAdmins: [] });
  }

  const [platformAdmins, tenantAdmins] = await Promise.all([
    db.listPlatformAdminUsers(),
    db.listTenantAdminUsers(),
  ]);

  return NextResponse.json({ platformAdmins, tenantAdmins });
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

  const body = await request.json().catch(() => ({}));
  const scopeType =
    body.scope_type === "platform" ||
    body.scope_type === "province" ||
    body.scope_type === "lodge"
      ? body.scope_type
      : "lodge";

  const guard =
    scopeType === "platform"
      ? await requirePlatformOwnerScope()
      : await requirePlatformScope();
  if (guard.response) return guard.response;

  const email = cleanEmail(body.email);
  const fullName = cleanName(body.full_name);
  const sendInvite = body.send_invite === true;
  if (!email || !fullName) {
    return NextResponse.json(
      { error: "Name and email are required." },
      { status: 400 }
    );
  }

  if (scopeType === "platform") {
    const role = roleFrom(body.role, PLATFORM_ROLES, "operator");
    const staff = await upsertAdminMembership({
      email,
      fullName,
      role,
      lodgeId: null,
    });
    if (!staff) {
      return NextResponse.json(
        { error: "Could not create platform team membership." },
        { status: 500 }
      );
    }
    const invite = sendInvite
      ? await sendStaffInvite({
          request,
          staff,
          lodgeName: "LodgePay platform",
        })
      : { sent: false, error: null as string | null };
    await writeAuditLog({
      lodgeId: null,
      action: sendInvite ? "platform_admin_invited" : "platform_admin_created",
      entityType: "admin_user",
      entityId: staff.id,
      summary: sendInvite
        ? `${scopeEmail(guard.scope)} invited ${email} to the platform team`
        : `${scopeEmail(guard.scope)} added ${email} to the platform team (no invite email)`,
      metadata: { role, invite_sent: invite.sent, invite_error: invite.error },
    });
    return NextResponse.json({ staff: [staff], invite }, { status: 201 });
  }

  const role = roleFrom(body.role, TENANT_ROLES, "super_admin");
  let lodges: db.Lodge[] = [];

  if (scopeType === "province") {
    const provinceId = typeof body.province_id === "string" ? body.province_id : "";
    if (!provinceId) {
      return NextResponse.json(
        { error: "Province is required." },
        { status: 400 }
      );
    }
    lodges = await db.listLodgesByProvince(provinceId);
  } else {
    const lodgeId = typeof body.lodge_id === "string" ? body.lodge_id : "";
    if (!lodgeId) {
      return NextResponse.json({ error: "Lodge is required." }, { status: 400 });
    }
    const lodge = await db.getLodgeById(lodgeId);
    lodges = lodge ? [lodge] : [];
  }

  if (lodges.length === 0) {
    return NextResponse.json(
      { error: "No lodges found for that selection." },
      { status: 404 }
    );
  }

  const staff = (
    await Promise.all(
      lodges.map((lodge) =>
        upsertAdminMembership({
          email,
          fullName,
          role,
          lodgeId: lodge.id,
        })
      )
    )
  ).filter(Boolean) as db.AdminUser[];

  const invite = sendInvite
    ? await sendStaffInvite({
        request,
        staff: staff[0],
        lodgeName:
          scopeType === "province"
            ? `${lodges.length} lodges on LodgePay`
            : lodges[0].name,
      })
    : { sent: false, error: null as string | null };

  await writeAuditLog({
    lodgeId: scopeType === "lodge" ? lodges[0].id : null,
    action: sendInvite ? "tenant_admin_invited" : "tenant_admin_created",
    entityType: "admin_user",
    entityId: staff[0]?.id ?? null,
    summary: sendInvite
      ? `${scopeEmail(guard.scope)} invited ${email} to ${lodges.length} tenant(s)`
      : `${scopeEmail(guard.scope)} assigned ${email} to ${lodges.length} tenant(s) (no invite email)`,
    metadata: {
      role,
      scope_type: scopeType,
      lodge_ids: lodges.map((lodge) => lodge.id),
      invite_sent: invite.sent,
      invite_error: invite.error,
    },
  });

  return NextResponse.json({ staff, invite }, { status: 201 });
}

/**
 * Platform-level support actions on a single admin_users row. Currently
 * supports:
 *   - send_password_reset: emails the admin a Resend-powered password reset
 *     link so a platform team member can unblock a tenant owner / treasurer
 *     / officer who has lost their password.
 *
 * Gated on requirePlatformScope() so any platform admin (operator or owner)
 * can perform the action. Tenant admins manage their own staff via
 * /api/admin/staff -- they should not be able to reach this route at all.
 */
export async function PATCH(request: NextRequest) {
  const unauthorized = await requireAdminApiAuth();
  if (unauthorized) return unauthorized;

  const { response } = await requirePlatformScope();
  if (response) return response;

  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Database not configured." },
      { status: 503 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const id = typeof body.id === "string" ? body.id : "";
  const action = typeof body.action === "string" ? body.action : "";

  if (!id) {
    return NextResponse.json({ error: "Admin id is required." }, { status: 400 });
  }

  const target = await db.getAdminUserById(id);
  if (!target) {
    return NextResponse.json({ error: "Admin not found." }, { status: 404 });
  }

  if (action === "send_password_reset") {
    let lodgeName = target.lodge_id ? "your lodge" : "LodgePay platform";
    if (target.lodge_id) {
      try {
        const lodge = await db.getLodgeById(target.lodge_id);
        if (lodge?.name) lodgeName = lodge.name;
      } catch {
        // Non-fatal: stick with the generic lodge label.
      }
    }

    const reset = await sendStaffPasswordReset({
      request,
      staff: target,
      lodgeName,
    });
    if (!reset.sent) {
      return NextResponse.json(
        { error: reset.error ?? "Could not send password reset email." },
        { status: 500 }
      );
    }

    await writeAuditLog({
      lodgeId: target.lodge_id,
      action: target.lodge_id
        ? "tenant_admin_password_reset_sent"
        : "platform_admin_password_reset_sent",
      entityType: "admin_user",
      entityId: target.id,
      summary: `Platform team sent password reset email to ${target.email}`,
      metadata: { via: "resend", target_email: target.email, role: target.role },
    });

    return NextResponse.json({ reset });
  }

  return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
}
