import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import * as db from "@/lib/db";
import * as mockDb from "@/lib/mock-db";
import { getLodgeSlugFromRequest } from "@/lib/tenant";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  try {
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
  try {
    const { id } = await params;
    const lodgeSlug = getLodgeSlugFromRequest(request);
    const body = await request.json();

    if (isSupabaseConfigured()) {
      const lodgeId = await db.resolveLodgeId(lodgeSlug);
      if (!lodgeId) {
        return NextResponse.json({ error: "Lodge not found." }, { status: 404 });
      }

      const updated = await db.updateMember(id, lodgeId, body);
      if (!updated) {
        return NextResponse.json({ error: "Member not found." }, { status: 404 });
      }
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
  try {
    const { id } = await params;
    const lodgeSlug = getLodgeSlugFromRequest(request);

    if (isSupabaseConfigured()) {
      const lodgeId = await db.resolveLodgeId(lodgeSlug);
      if (!lodgeId) {
        return NextResponse.json({ error: "Lodge not found." }, { status: 404 });
      }

      const updated = await db.updateMember(id, lodgeId, { membership_status: "excluded" });
      if (!updated) {
        return NextResponse.json({ error: "Member not found." }, { status: 404 });
      }
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
