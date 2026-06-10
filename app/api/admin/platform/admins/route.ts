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
  "pastoral_care",
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
  churchId,
}: {
  email: string;
  fullName: string;
  role: string;
  churchId: string | null;
}) {
  const existing = await db.getAdminUserForScope(email, churchId);
  if (existing) {
    return db.updateAdminUser(existing.id, {
      full_name: fullName,
      role,
      active: true,
      church_id: churchId,
      permissions: existing.permissions ?? [],
    });
  }
  return db.createAdminUser({
    email,
    full_name: fullName,
    role,
    active: true,
    church_id: churchId,
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
    body.scope_type === "network" ||
    body.scope_type === "church"
      ? body.scope_type
      : "church";

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
      churchId: null,
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
          churchName: "ChurchPay platform",
        })
      : { sent: false, error: null as string | null };
    await writeAuditLog({
      churchId: null,
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
  let churches: db.Church[] = [];

  if (scopeType === "network") {
    const networkId = typeof body.network_id === "string" ? body.network_id : "";
    if (!networkId) {
      return NextResponse.json(
        { error: "Network is required." },
        { status: 400 }
      );
    }
    churches = await db.listChurchesByNetwork(networkId);
  } else {
    const churchId = typeof body.church_id === "string" ? body.church_id : "";
    if (!churchId) {
      return NextResponse.json({ error: "Church is required." }, { status: 400 });
    }
    const church = await db.getChurchById(churchId);
    churches = church ? [church] : [];
  }

  if (churches.length === 0) {
    return NextResponse.json(
      { error: "No churches found for that selection." },
      { status: 404 }
    );
  }

  const staff = (
    await Promise.all(
      churches.map((church) =>
        upsertAdminMembership({
          email,
          fullName,
          role,
          churchId: church.id,
        })
      )
    )
  ).filter(Boolean) as db.AdminUser[];

  const invite = sendInvite
    ? await sendStaffInvite({
        request,
        staff: staff[0],
        churchName:
          scopeType === "network"
            ? `${churches.length} churches on ChurchPay`
            : churches[0].name,
      })
    : { sent: false, error: null as string | null };

  await writeAuditLog({
    churchId: scopeType === "church" ? churches[0].id : null,
    action: sendInvite ? "tenant_admin_invited" : "tenant_admin_created",
    entityType: "admin_user",
    entityId: staff[0]?.id ?? null,
    summary: sendInvite
      ? `${scopeEmail(guard.scope)} invited ${email} to ${churches.length} tenant(s)`
      : `${scopeEmail(guard.scope)} assigned ${email} to ${churches.length} tenant(s) (no invite email)`,
    metadata: {
      role,
      scope_type: scopeType,
      church_ids: churches.map((church) => church.id),
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
    let churchName = target.church_id ? "your church" : "ChurchPay platform";
    if (target.church_id) {
      try {
        const church = await db.getChurchById(target.church_id);
        if (church?.name) churchName = church.name;
      } catch {
        // Non-fatal: stick with the generic church label.
      }
    }

    const reset = await sendStaffPasswordReset({
      request,
      staff: target,
      churchName,
    });
    if (!reset.sent) {
      return NextResponse.json(
        { error: reset.error ?? "Could not send password reset email." },
        { status: 500 }
      );
    }

    await writeAuditLog({
      churchId: target.church_id,
      action: target.church_id
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
