import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import * as db from "@/lib/db";
import { getLodgeSlugFromRequest } from "@/lib/tenant";
import {
  requireAdminApiAuth,
  requireAdminApiPermission,
} from "@/lib/auth/api";
import { writeAuditLog } from "@/lib/audit";

export async function GET(request: NextRequest) {
  const unauthorized = await requireAdminApiAuth();
  if (unauthorized) return unauthorized;
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ cases: [] });
  }
  const lodgeSlug = getLodgeSlugFromRequest(request);
  const lodgeId = await db.resolveLodgeId(lodgeSlug);
  if (!lodgeId) {
    return NextResponse.json({ error: "Lodge not found." }, { status: 404 });
  }
  const forbidden = await requireAdminApiPermission("welfare:read", lodgeId);
  if (forbidden) return forbidden;
  const status = request.nextUrl.searchParams.get("status") as
    | "open"
    | "monitoring"
    | "closed"
    | null;
  const cases = await db.listWelfareCases(lodgeId, {
    status: status ?? undefined,
  });
  return NextResponse.json({ cases });
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
  const lodgeSlug = getLodgeSlugFromRequest(request);
  const lodgeId = await db.resolveLodgeId(lodgeSlug);
  if (!lodgeId) {
    return NextResponse.json({ error: "Lodge not found." }, { status: 404 });
  }
  const forbidden = await requireAdminApiPermission("welfare:write", lodgeId);
  if (forbidden) return forbidden;

  const body = await request.json();
  const memberId: string | null = body.member_id ?? null;
  const created = await db.createWelfareCase(lodgeId, {
    member_id: memberId,
    contact_name: body.contact_name?.trim() ?? "",
    contact_email: body.contact_email?.trim() ?? null,
    contact_phone: body.contact_phone?.trim() ?? null,
    case_type: body.case_type ?? "general",
    severity: body.severity ?? "standard",
    status: body.status ?? "open",
    summary: body.summary?.trim() ?? null,
    next_action: body.next_action?.trim() ?? null,
    next_action_due: body.next_action_due ?? null,
    created_by_admin_user_id: null,
  });

  await writeAuditLog({
    lodgeId,
    action: "welfare_case_created",
    entityType: "welfare_case",
    entityId: created.id,
    summary: `Welfare case opened for ${created.contact_name}`,
    metadata: {
      severity: created.severity,
      case_type: created.case_type,
    },
  });

  return NextResponse.json({ case: created }, { status: 201 });
}
