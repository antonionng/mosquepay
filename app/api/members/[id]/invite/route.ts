import { NextRequest, NextResponse } from "next/server";
import { requireAdminApiAuth, requireAdminApiPermission } from "@/lib/auth/api";
import { sendMemberInvite } from "@/lib/auth/invites";
import { writeAuditLog } from "@/lib/audit";
import * as db from "@/lib/db";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import { rejectIfMockDisabled } from "@/lib/db/reject-mock";
import { getLodgeSlugFromRequest } from "@/lib/tenant";

type Params = { params: Promise<{ id: string }> };

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
    const lodgeSlug = getLodgeSlugFromRequest(request);
    const lodgeId = await db.resolveLodgeId(lodgeSlug);
    if (!lodgeId) {
      return NextResponse.json({ error: "Lodge not found." }, { status: 404 });
    }

    const forbidden = await requireAdminApiPermission("members:write", lodgeId);
    if (forbidden) return forbidden;

    const [member, lodge] = await Promise.all([
      db.getMemberById(id, lodgeId),
      db.getLodgeById(lodgeId),
    ]);
    if (!member) {
      return NextResponse.json({ error: "Member not found." }, { status: 404 });
    }
    if (!member.email) {
      return NextResponse.json({ error: "Member email is required." }, { status: 400 });
    }

    const invite = await sendMemberInvite({
      request,
      member,
      lodgeName: lodge?.name ?? lodgeSlug,
    });
    if (!invite.sent) {
      return NextResponse.json(
        { error: invite.error ?? "Could not send member invite." },
        { status: 500 }
      );
    }

    await writeAuditLog({
      lodgeId,
      action: "invited",
      entityType: "member",
      entityId: member.id,
      summary: `Sent member portal invite to ${member.email}`,
      metadata: { via: "resend" },
    });

    return NextResponse.json({ invite });
  } catch (error) {
    console.error("Member invite error:", error);
    return NextResponse.json({ error: "Failed to send member invite." }, { status: 500 });
  }
}
