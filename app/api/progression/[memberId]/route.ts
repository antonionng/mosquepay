import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import * as db from "@/lib/db";
import { getLodgeSlugFromRequest } from "@/lib/tenant";
import {
  requireAdminApiAuth,
  requireAdminApiPermission,
} from "@/lib/auth/api";
import { writeAuditLog } from "@/lib/audit";

const DEGREES = ["initiation", "passing", "raising"] as const;
type Degree = (typeof DEGREES)[number];

const DATE_FIELD: Record<Degree, "date_of_initiation" | "date_of_passing" | "date_of_raising"> = {
  initiation: "date_of_initiation",
  passing: "date_of_passing",
  raising: "date_of_raising",
};

const SIGNOFF_FIELD: Record<
  Degree,
  | "progression_signed_off_initiation"
  | "progression_signed_off_passing"
  | "progression_signed_off_raising"
> = {
  initiation: "progression_signed_off_initiation",
  passing: "progression_signed_off_passing",
  raising: "progression_signed_off_raising",
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ memberId: string }> }
) {
  const unauthorized = await requireAdminApiAuth();
  if (unauthorized) return unauthorized;
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Database not configured." },
      { status: 503 }
    );
  }
  const { memberId } = await params;
  const lodgeSlug = getLodgeSlugFromRequest(request);
  const lodgeId = await db.resolveLodgeId(lodgeSlug);
  if (!lodgeId) {
    return NextResponse.json({ error: "Lodge not found." }, { status: 404 });
  }
  const forbidden = await requireAdminApiPermission("members:write", lodgeId);
  if (forbidden) return forbidden;

  const body = await request.json();
  const degree: Degree = body.degree;
  if (!DEGREES.includes(degree)) {
    return NextResponse.json({ error: "Invalid degree." }, { status: 400 });
  }
  const date: string | null = body.date ?? null;
  const signedOff: boolean = body.signed_off === true;
  const signedOffByMemberId: string | null = body.signed_off_by_member_id ?? null;
  const notes: string | null = body.notes ?? null;

  const updates: Record<string, unknown> = {};
  if (date !== undefined) updates[DATE_FIELD[degree]] = date;
  updates[SIGNOFF_FIELD[degree]] = signedOff;

  const updated = await db.updateMember(memberId, lodgeId, updates);
  if (!updated) {
    return NextResponse.json({ error: "Member not found." }, { status: 404 });
  }

  await db.recordProgressionSignoff(lodgeId, {
    member_id: memberId,
    degree,
    signed_off: signedOff,
    signed_off_by_admin_user_id: null,
    signed_off_by_member_id: signedOffByMemberId,
    notes,
  });

  await writeAuditLog({
    lodgeId,
    action: "progression_recorded",
    entityType: "member",
    entityId: memberId,
    summary: `Recorded ${degree} for member`,
    metadata: { degree, signed_off: signedOff, date },
  });

  return NextResponse.json({ member: updated });
}
