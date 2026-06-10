// GET the active Gift Aid declaration for a single member.
//
// Used by the admin member profile's Gift Aid panel to refresh state
// after a paper upload without re-rendering the whole page. Returns
// `{ declaration: null }` when nothing is on file -- never 404s so the
// client can drive the empty state without special-casing.

import { NextRequest, NextResponse } from "next/server";
import * as db from "@/lib/db";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import { getChurchSlugFromRequest } from "@/lib/tenant";
import {
  requireAdminApiAuth,
  requireAdminApiPermission,
} from "@/lib/auth/api";
import { getCurrentAdminScope } from "@/lib/auth/permissions";
import { writeAuditLog } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const unauthorized = await requireAdminApiAuth();
  if (unauthorized) return unauthorized;
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ declaration: null });
  }
  const { id: memberId } = await params;
  const churchSlug = getChurchSlugFromRequest(request);
  const churchId = await db.resolveChurchId(churchSlug);
  if (!churchId) {
    return NextResponse.json({ error: "Church not found." }, { status: 404 });
  }
  // Read-only against members -- members:read is the right scope. Charity
  // scope is required only for write surfaces (upload / revoke).
  const forbidden = await requireAdminApiPermission("members:read", churchId);
  if (forbidden) return forbidden;

  const member = await db.getMemberById(memberId, churchId);
  if (!member) {
    return NextResponse.json({ error: "Member not found." }, { status: 404 });
  }

  const declaration = await db.getActiveGiftAidDeclarationByMember(churchId, {
    id: member.id,
    email: member.email,
  });

  return NextResponse.json({
    declaration,
    consent_status: member.gift_aid_consent_status ?? "unknown",
  });
}

type PatchBody = {
  action?: unknown;
  reason?: unknown;
};

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const unauthorized = await requireAdminApiAuth();
  if (unauthorized) return unauthorized;
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Gift Aid is not configured." },
      { status: 503 },
    );
  }

  const { id: memberId } = await params;
  const churchSlug = getChurchSlugFromRequest(request);
  const churchId = await db.resolveChurchId(churchSlug);
  if (!churchId) {
    return NextResponse.json({ error: "Church not found." }, { status: 404 });
  }
  const forbidden = await requireAdminApiPermission("charity:write", churchId);
  if (forbidden) return forbidden;

  const member = await db.getMemberById(memberId, churchId);
  if (!member) {
    return NextResponse.json({ error: "Member not found." }, { status: 404 });
  }

  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const action = typeof body.action === "string" ? body.action : "";
  if (action !== "refuse" && action !== "clear") {
    return NextResponse.json(
      { error: "Unknown Gift Aid action." },
      { status: 400 },
    );
  }

  const scope = await getCurrentAdminScope();
  const actorEmail =
    scope.kind === "dummy" ||
    scope.kind === "platform" ||
    scope.kind === "church"
      ? scope.email
      : null;

  if (action === "clear") {
    await db.updateMemberGiftAidPosture(member.id, churchId, {
      gift_aid_consent_status: "unknown",
      gift_aid_prompted_at: null,
    });
    await writeAuditLog({
      churchId,
      action: "gift_aid_member_refusal_cleared",
      entityType: "member",
      entityId: member.id,
      summary: `Cleared Gift Aid refusal for ${member.email}.`,
      metadata: { actor_email: actorEmail },
    });
    return NextResponse.json({
      consent_status: "unknown" as const,
      declaration: await db.getActiveGiftAidDeclarationByMember(churchId, {
        id: member.id,
        email: member.email,
      }),
    });
  }

  const reason =
    typeof body.reason === "string" && body.reason.trim()
      ? body.reason.trim()
      : "Gift Aid refused by donor.";
  const nowIso = new Date().toISOString();
  const declaration = await db.getActiveGiftAidDeclarationByMember(churchId, {
    id: member.id,
    email: member.email,
  });

  if (declaration) {
    const revoked = await db.revokeGiftAidDeclaration(declaration.id, churchId, {
      reason,
    });
    try {
      await db.insertGiftAidDeclarationEvent(churchId, {
        declaration_id: declaration.id,
        event_type: "revoked",
        actor_kind: "admin",
        actor_email: actorEmail,
        actor_ip: null,
        actor_user_agent: request.headers.get("user-agent"),
        before_state: { revoked_at: declaration.revoked_at },
        after_state: { revoked_at: revoked?.revoked_at ?? nowIso },
        evidence_sha256: declaration.evidence_sha256,
        notes: reason,
      });
    } catch (err) {
      console.warn("admin member gift-aid refusal event insert failed", {
        declaration_id: declaration.id,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  await db.updateMemberGiftAidPosture(member.id, churchId, {
    gift_aid_consent_status: "declined",
    gift_aid_prompted_at: nowIso,
  });
  await writeAuditLog({
    churchId,
    action: "gift_aid_member_refused",
    entityType: "member",
    entityId: member.id,
    summary: `Marked Gift Aid refused for ${member.email}.`,
    metadata: {
      actor_email: actorEmail,
      declaration_id: declaration?.id ?? null,
      reason,
    },
  });

  return NextResponse.json({
    consent_status: "declined" as const,
    declaration: null,
  });
}
