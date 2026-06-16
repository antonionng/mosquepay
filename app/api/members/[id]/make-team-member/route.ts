import { NextRequest, NextResponse } from "next/server";
import { requireAdminApiAuth, requireAdminApiPermission } from "@/lib/auth/api";
import { sendStaffInvite } from "@/lib/auth/invites";
import { roleHasPermission } from "@/lib/auth/permissions";
import { writeAuditLog } from "@/lib/audit";
import * as db from "@/lib/db";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import { rejectIfMockDisabled } from "@/lib/db/reject-mock";
import { getMosqueSlugFromRequest } from "@/lib/tenant";

type Params = { params: Promise<{ id: string }> };

// POST /api/members/[id]/make-team-member
//
// Promotes a mosque member into a "payment team member" so they can use the
// in-person Take payment flow. Members and staff live in separate tables, and
// payments:write only comes from an admin_users row -- so this creates (or
// reuses) an admin_users row for the member's email and sends the standard
// staff invite email with a set-password link.
//
// Auth: admin with admin:all on the active mosque (same gate as Staff settings).
export async function POST(request: NextRequest, { params }: Params) {
  const _rejectMock = rejectIfMockDisabled();
  if (_rejectMock) return _rejectMock;

  try {
    const unauthorized = await requireAdminApiAuth();
    if (unauthorized) return unauthorized;

    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: "Database not configured." }, { status: 503 });
    }

    const { id } = await params;
    const mosqueSlug = getMosqueSlugFromRequest(request);
    const mosqueId = await db.resolveMosqueId(mosqueSlug);
    if (!mosqueId) {
      return NextResponse.json({ error: "Mosque not found." }, { status: 404 });
    }

    const forbidden = await requireAdminApiPermission("admin:all", mosqueId);
    if (forbidden) return forbidden;

    const [member, mosque] = await Promise.all([
      db.getMemberById(id, mosqueId),
      db.getMosqueById(mosqueId),
    ]);
    if (!member) {
      return NextResponse.json({ error: "Member not found." }, { status: 404 });
    }
    if (!member.email) {
      return NextResponse.json({ error: "Member email is required." }, { status: 400 });
    }

    const mosqueName = mosque?.name ?? mosqueSlug;

    // Find any existing mosque-scoped staff row for this email so we don't
    // clobber an existing officer (e.g. a Secretary who is also a member).
    const existing = (await db.listAdminUsersForMosque(mosqueId)).find(
      (admin) =>
        admin.mosque_id === mosqueId &&
        admin.email.trim().toLowerCase() === member.email.trim().toLowerCase()
    );

    let staff: db.AdminUser;
    if (!existing) {
      staff = await db.createAdminUser({
        mosque_id: mosqueId,
        email: member.email,
        full_name: member.full_name,
        role: "treasurer",
        active: true,
        permissions: [],
      });
      await writeAuditLog({
        mosqueId,
        action: "created",
        entityType: "admin_user",
        entityId: staff.id,
        summary: `Promoted member ${staff.email} to payment team member`,
        metadata: {
          role: staff.role,
          scoped_mosque_id: staff.mosque_id,
          via: "member_make_team_member",
          member_id: member.id,
        },
      });
    } else if (
      !roleHasPermission(existing.role, "payments:write") &&
      !(existing.permissions ?? []).includes("payments:write")
    ) {
      // Existing staff member without payment access -- grant payments:write
      // as a per-row override rather than overwriting their role.
      const nextPermissions = Array.from(
        new Set([...(existing.permissions ?? []), "payments:write"])
      );
      staff =
        (await db.updateAdminUser(existing.id, {
          permissions: nextPermissions,
          active: true,
        })) ?? existing;
      await writeAuditLog({
        mosqueId,
        action: "updated",
        entityType: "admin_user",
        entityId: staff.id,
        summary: `Granted payment access to ${staff.email}`,
        metadata: {
          role: staff.role,
          permissions: nextPermissions,
          via: "member_make_team_member",
          member_id: member.id,
        },
      });
    } else {
      staff = existing;
    }

    const invite = await sendStaffInvite({ request, staff, mosqueName });
    if (!invite.sent) {
      return NextResponse.json(
        { error: invite.error ?? "Could not send the payment access email." },
        { status: 500 }
      );
    }

    await writeAuditLog({
      mosqueId,
      action: "invited",
      entityType: "admin_user",
      entityId: staff.id,
      summary: `Sent payment access invite to ${staff.email}`,
      metadata: { via: "resend", member_id: member.id },
    });

    return NextResponse.json({ staff, invite });
  } catch (error) {
    console.error("Make team member error:", error);
    return NextResponse.json(
      { error: "Failed to promote member to payment team member." },
      { status: 500 }
    );
  }
}
