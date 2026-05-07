import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import { rejectIfMockDisabled } from "@/lib/db/reject-mock";
import * as db from "@/lib/db";
import * as mockDb from "@/lib/mock-db";
import { getLodgeSlugFromRequest } from "@/lib/tenant";
import { requireAdminApiAuth, requireAdminApiPermission } from "@/lib/auth/api";
import { writeAuditLog } from "@/lib/audit";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const _rejectMock = rejectIfMockDisabled();
  if (_rejectMock) return _rejectMock;

  try {
    const unauthorized = await requireAdminApiAuth();
    if (unauthorized) return unauthorized;

    const { id } = await params;
    const lodgeSlug = getLodgeSlugFromRequest(request);

    if (isSupabaseConfigured()) {
      const lodgeId = await db.resolveLodgeId(lodgeSlug);
      if (!lodgeId) {
        return NextResponse.json({ error: "Lodge not found." }, { status: 404 });
      }

      const member = await db.getMemberById(id, lodgeId);
      if (!member) {
        return NextResponse.json({ error: "Member not found." }, { status: 404 });
      }

      const [dietaryHistory, paymentHistory, duesRecords] = await Promise.all([
        db.getRsvpDietaryByEmail(member.email, lodgeId),
        db.getPaymentsByEmail(member.email, lodgeId),
        db.getMemberDues(lodgeId, { memberEmail: member.email }),
      ]);

      return NextResponse.json({ member, dietaryHistory, paymentHistory, duesRecords });
    }

    const member = mockDb.getMemberById(id, { lodge_slug: lodgeSlug });
    if (!member) {
      return NextResponse.json({ error: "Member not found." }, { status: 404 });
    }

    const dietaryHistory = mockDb.getRsvpDietaryByEmail(member.email, { lodge_slug: lodgeSlug });
    const paymentHistory = mockDb.getPaymentsByEmail(member.email, { lodge_slug: lodgeSlug });

    return NextResponse.json({ member, dietaryHistory, paymentHistory, duesRecords: [] });
  } catch (e) {
    console.error("Member GET error:", e);
    return NextResponse.json({ error: "Failed to fetch member." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const _rejectMock = rejectIfMockDisabled();
  if (_rejectMock) return _rejectMock;

  try {
    const unauthorized = await requireAdminApiAuth();
    if (unauthorized) return unauthorized;

    const { id } = await params;
    const lodgeSlug = getLodgeSlugFromRequest(request);
    const body = await request.json();

    if (isSupabaseConfigured()) {
      const lodgeId = await db.resolveLodgeId(lodgeSlug);
      if (!lodgeId) {
        return NextResponse.json({ error: "Lodge not found." }, { status: 404 });
      }
      const forbidden = await requireAdminApiPermission("members:write", lodgeId);
      if (forbidden) return forbidden;

      const updated = await db.updateMember(id, lodgeId, body);
      if (!updated) {
        return NextResponse.json({ error: "Member not found." }, { status: 404 });
      }
      await writeAuditLog({
        lodgeId,
        action: "updated",
        entityType: "member",
        entityId: updated.id,
        summary: `Updated member ${updated.full_name}`,
        metadata: { fields: Object.keys(body) },
      });
      return NextResponse.json({ member: updated });
    }

    const updated = mockDb.updateMember(id, body, { lodge_slug: lodgeSlug });
    if (!updated) {
      return NextResponse.json({ error: "Member not found." }, { status: 404 });
    }
    return NextResponse.json({ member: updated });
  } catch (e) {
    console.error("Member PATCH error:", e);
    return NextResponse.json({ error: "Failed to update member." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const _rejectMock = rejectIfMockDisabled();
  if (_rejectMock) return _rejectMock;

  try {
    const unauthorized = await requireAdminApiAuth();
    if (unauthorized) return unauthorized;

    const { id } = await params;
    const lodgeSlug = getLodgeSlugFromRequest(request);

    if (isSupabaseConfigured()) {
      const lodgeId = await db.resolveLodgeId(lodgeSlug);
      if (!lodgeId) {
        return NextResponse.json({ error: "Lodge not found." }, { status: 404 });
      }
      const forbidden = await requireAdminApiPermission("members:write", lodgeId);
      if (forbidden) return forbidden;

      const updated = await db.updateMember(id, lodgeId, { membership_status: "excluded" });
      if (!updated) {
        return NextResponse.json({ error: "Member not found." }, { status: 404 });
      }
      await writeAuditLog({
        lodgeId,
        action: "excluded",
        entityType: "member",
        entityId: updated.id,
        summary: `Excluded member ${updated.full_name}`,
      });
      return NextResponse.json({ member: updated });
    }

    const updated = mockDb.updateMember(id, { membership_status: "excluded" }, { lodge_slug: lodgeSlug });
    if (!updated) {
      return NextResponse.json({ error: "Member not found." }, { status: 404 });
    }
    return NextResponse.json({ member: updated });
  } catch (e) {
    console.error("Member DELETE error:", e);
    return NextResponse.json({ error: "Failed to remove member." }, { status: 500 });
  }
}
