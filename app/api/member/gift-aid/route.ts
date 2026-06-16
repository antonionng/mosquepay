// Member-facing Gift Aid declaration endpoint.
//
// GET     -> current declaration posture for the signed-in member (active
//            row + member consent status). Used by the portal onboarding
//            modal, the persistent banner, and the profile page.
//
// POST    -> create a NEW digital declaration. Captures IP + UA, snapshots
//            the exact declaration text the member confirmed, renders the
//            tamper-evident HTML artefact, hashes it, stores it, then
//            writes the declaration row + a `created_digital` event row.
//
// PATCH   -> revoke the current declaration ("I'm no longer eligible" or
//            "decline forever"). Never deletes -- HMRC retention.
//
// Auth: signed-in member only. We never accept arbitrary mosque / email
// from the body; the member identity drives every write.
//
// Paper declarations are NOT created here -- those belong to the admin
// surface (a treasurer holding the wet-ink slip), see
// `app/api/admin/gift-aid/declarations/route.ts`.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import * as db from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import {
  HMRC_DECLARATION_TEXT_V1,
  persistDigitalEvidence,
} from "@/lib/gift-aid/evidence";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clientIp(request: NextRequest): string | null {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return request.headers.get("x-real-ip");
}

async function resolveMember() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user || !user.email) return null;
  const member =
    (await db.getMemberByAuthUserId(user.id)) ??
    (await db.getMemberByEmailAcrossMosques(user.email));
  if (!member) return null;
  return { user, member };
}

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({
      declaration: null,
      consent_status: "unknown" as const,
      prompted: false,
    });
  }
  const ctx = await resolveMember();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const declaration = await db.getActiveGiftAidDeclarationByMember(
      ctx.member.mosque_id,
      { id: ctx.member.id, email: ctx.member.email }
    );
    return NextResponse.json({
      declaration: declaration
        ? {
            id: declaration.id,
            donor_name: declaration.donor_name,
            donor_address_line_1: declaration.donor_address_line_1,
            donor_address_line_2: declaration.donor_address_line_2,
            donor_city: declaration.donor_city,
            donor_postcode: declaration.donor_postcode,
            evidence_source: declaration.evidence_source,
            paper_received_date: declaration.paper_received_date,
            created_at: declaration.created_at,
            revoked_at: declaration.revoked_at,
          }
        : null,
      consent_status: ctx.member.gift_aid_consent_status ?? "unknown",
      prompted: Boolean(ctx.member.gift_aid_prompted_at),
    });
  } catch (err) {
    console.error("member gift-aid GET failed", {
      member_id: ctx.member.id,
      message: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: "Could not load Gift Aid status." },
      { status: 500 }
    );
  }
}

type PostBody = {
  donor_name?: unknown;
  donor_address_line_1?: unknown;
  donor_address_line_2?: unknown;
  donor_city?: unknown;
  donor_postcode?: unknown;
  donor_country?: unknown;
  confirmed?: unknown;
};

function trimOrNull(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const out = value.trim();
  return out.length === 0 ? null : out;
}

export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Gift Aid is not configured." },
      { status: 503 }
    );
  }
  const ctx = await resolveMember();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body: PostBody;
  try {
    body = (await request.json()) as PostBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const confirmed = body.confirmed === true || body.confirmed === "true";
  if (!confirmed) {
    return NextResponse.json(
      {
        error:
          "You must confirm UK taxpayer eligibility to create a Gift Aid declaration.",
      },
      { status: 400 }
    );
  }
  const donorName =
    trimOrNull(body.donor_name) ?? ctx.member.full_name?.trim() ?? null;
  if (!donorName) {
    return NextResponse.json(
      { error: "A donor name is required for HMRC." },
      { status: 400 }
    );
  }
  const addressLine1 =
    trimOrNull(body.donor_address_line_1) ?? ctx.member.address_line_1;
  const city = trimOrNull(body.donor_city) ?? ctx.member.city;
  const postcode = trimOrNull(body.donor_postcode) ?? ctx.member.postcode;
  if (!addressLine1 || !city || !postcode) {
    return NextResponse.json(
      {
        error:
          "HMRC require address line 1, town/city, and postcode for a Gift Aid declaration.",
      },
      { status: 400 }
    );
  }

  const ip = clientIp(request);
  const userAgent = request.headers.get("user-agent");
  const signedAtIso = new Date().toISOString();

  let mosque = null;
  try {
    mosque = await db.getMosqueById(ctx.member.mosque_id);
  } catch (err) {
    console.warn("member gift-aid POST: mosque lookup failed (non-fatal)", {
      mosque_id: ctx.member.mosque_id,
      message: err instanceof Error ? err.message : String(err),
    });
  }

  // Insert the declaration row first so we have an id for the evidence
  // storage path. Evidence fields are stamped on a follow-up update once
  // the bytes are safely written to the private bucket.
  let declaration;
  try {
    declaration = await db.addGiftAidDeclaration(ctx.member.mosque_id, {
      donor_name: donorName,
      donor_email: ctx.member.email,
      donor_address_line_1: addressLine1,
      donor_address_line_2:
        trimOrNull(body.donor_address_line_2) ?? ctx.member.address_line_2,
      donor_city: city,
      donor_postcode: postcode,
      donor_country:
        trimOrNull(body.donor_country) ??
        ctx.member.country ??
        "United Kingdom",
      declaration_text: HMRC_DECLARATION_TEXT_V1,
      declaration_confirmed: true,
      confirmation_method: "member_portal_checkbox",
      hmrc_eligible: true,
      declaration_source: "member_portal",
      member_id: ctx.member.id,
      digital_signature_ip: ip,
      digital_signature_user_agent: userAgent,
      digital_declaration_text_snapshot: HMRC_DECLARATION_TEXT_V1,
      evidence_source: "digital",
    });
  } catch (err) {
    console.error("member gift-aid POST: insert failed", {
      member_id: ctx.member.id,
      message: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: "Could not record Gift Aid declaration." },
      { status: 500 }
    );
  }

  // Render and store the tamper-evident HTML artefact. Failures here are
  // logged but never block the declaration -- the row is HMRC-valid on its
  // own; the artefact is a belt-and-braces for Lester's filing cabinet.
  // The treasurer can regenerate the artefact later from the persisted row.
  let evidenceSha: string | null = null;
  try {
    const evidence = await persistDigitalEvidence({
      mosqueId: ctx.member.mosque_id,
      declarationId: declaration.id,
      donorName,
      donorEmail: ctx.member.email,
      donorAddressLine1: addressLine1,
      donorAddressLine2:
        trimOrNull(body.donor_address_line_2) ?? ctx.member.address_line_2,
      donorCity: city,
      donorPostcode: postcode,
      donorCountry:
        trimOrNull(body.donor_country) ??
        ctx.member.country ??
        "United Kingdom",
      declarationText: HMRC_DECLARATION_TEXT_V1,
      signedAtIso,
      ipAddress: ip,
      userAgent,
      mosqueName: mosque?.name ?? "Mosque",
      mosqueNumber: mosque?.mosque_number ?? null,
      charityReference: mosque?.hmrc_charity_reference ?? null,
      source: "member_portal",
    });
    await db.updateGiftAidDeclarationEvidence(
      declaration.id,
      ctx.member.mosque_id,
      {
        evidence_source: "digital",
        evidence_storage_bucket: evidence.bucket,
        evidence_storage_path: evidence.path,
        evidence_sha256: evidence.sha256,
        evidence_size_bytes: evidence.size,
        evidence_mime_type: evidence.mime,
        evidence_uploaded_at: signedAtIso,
        evidence_uploaded_by_email: ctx.member.email,
      }
    );
    evidenceSha = evidence.sha256;
  } catch (err) {
    console.error(
      "member gift-aid POST: evidence persist failed (non-fatal)",
      {
        declaration_id: declaration.id,
        message: err instanceof Error ? err.message : String(err),
      }
    );
  }

  // Append-only event log + denormalised member status. Both wrapped so a
  // failure on either leg doesn't blank out the declaration row.
  try {
    await db.insertGiftAidDeclarationEvent(ctx.member.mosque_id, {
      declaration_id: declaration.id,
      event_type: "created_digital",
      actor_kind: "member",
      actor_email: ctx.member.email,
      actor_ip: ip,
      actor_user_agent: userAgent,
      before_state: null,
      after_state: {
        donor_name: donorName,
        donor_email: ctx.member.email,
        evidence_source: "digital",
      },
      evidence_sha256: evidenceSha,
      notes: null,
    });
  } catch (err) {
    console.error("member gift-aid POST: event insert failed (non-fatal)", {
      declaration_id: declaration.id,
      message: err instanceof Error ? err.message : String(err),
    });
  }
  try {
    await db.updateMemberGiftAidPosture(ctx.member.id, ctx.member.mosque_id, {
      gift_aid_consent_status: "declared",
      gift_aid_prompted_at: signedAtIso,
    });
  } catch (err) {
    console.warn("member gift-aid POST: member posture update failed", {
      member_id: ctx.member.id,
      message: err instanceof Error ? err.message : String(err),
    });
  }

  await writeAuditLog({
    mosqueId: ctx.member.mosque_id,
    action: "gift_aid_declaration_created_digital",
    entityType: "gift_aid_declaration",
    entityId: declaration.id,
    summary: `Member ${ctx.member.email} created a digital Gift Aid declaration.`,
    metadata: {
      evidence_sha256: evidenceSha,
      ip,
    },
  });

  return NextResponse.json(
    {
      declaration: {
        id: declaration.id,
        evidence_source: "digital",
        evidence_sha256: evidenceSha,
        created_at: declaration.created_at,
      },
    },
    { status: 201 }
  );
}

type PatchBody = {
  action?: unknown;
  reason?: unknown;
  // Member may decline without ever signing one (just dismiss the banner).
  // We don't create a row in that case; we just stamp the member.
  decline?: unknown;
};

export async function PATCH(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Gift Aid is not configured." },
      { status: 503 }
    );
  }
  const ctx = await resolveMember();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const action =
    typeof body.action === "string" ? body.action : body.decline ? "decline" : "revoke";

  if (action === "decline") {
    try {
      await db.updateMemberGiftAidPosture(ctx.member.id, ctx.member.mosque_id, {
        gift_aid_consent_status: "declined",
        gift_aid_prompted_at: new Date().toISOString(),
      });
    } catch (err) {
      console.error("member gift-aid PATCH decline failed", {
        member_id: ctx.member.id,
        message: err instanceof Error ? err.message : String(err),
      });
      return NextResponse.json(
        { error: "Could not record decline." },
        { status: 500 }
      );
    }
    await writeAuditLog({
      mosqueId: ctx.member.mosque_id,
      action: "gift_aid_member_declined",
      entityType: "member",
      entityId: ctx.member.id,
      summary: `Member ${ctx.member.email} declined Gift Aid.`,
    });
    return NextResponse.json({ consent_status: "declined" });
  }

  if (action === "dismiss") {
    try {
      await db.updateMemberGiftAidPosture(ctx.member.id, ctx.member.mosque_id, {
        gift_aid_prompted_at: new Date().toISOString(),
      });
    } catch (err) {
      console.warn("member gift-aid PATCH dismiss failed (non-fatal)", {
        member_id: ctx.member.id,
        message: err instanceof Error ? err.message : String(err),
      });
    }
    return NextResponse.json({ ok: true });
  }

  if (action === "clear") {
    try {
      await db.updateMemberGiftAidPosture(ctx.member.id, ctx.member.mosque_id, {
        gift_aid_consent_status: "unknown",
        gift_aid_prompted_at: null,
      });
    } catch (err) {
      console.error("member gift-aid PATCH clear failed", {
        member_id: ctx.member.id,
        message: err instanceof Error ? err.message : String(err),
      });
      return NextResponse.json(
        { error: "Could not clear Gift Aid refusal." },
        { status: 500 },
      );
    }
    await writeAuditLog({
      mosqueId: ctx.member.mosque_id,
      action: "gift_aid_member_refusal_cleared",
      entityType: "member",
      entityId: ctx.member.id,
      summary: `Member ${ctx.member.email} cleared their Gift Aid refusal.`,
    });
    return NextResponse.json({ consent_status: "unknown" });
  }

  if (action !== "revoke") {
    return NextResponse.json(
      { error: "Unknown action." },
      { status: 400 }
    );
  }

  const declaration = await db.getActiveGiftAidDeclarationByMember(
    ctx.member.mosque_id,
    { id: ctx.member.id, email: ctx.member.email }
  );
  if (!declaration) {
    return NextResponse.json(
      { error: "No active declaration to revoke." },
      { status: 404 }
    );
  }

  // Paper-backed declarations can't be silently nuked by the member because
  // there is a real piece of paper out there. Flag for treasurer review by
  // writing a `revoked` event but keep the row not-yet-revoked; the
  // treasurer confirms via the admin surface. Digital declarations the
  // member signed themselves can be revoked immediately.
  const reason = typeof body.reason === "string" ? body.reason.trim() : null;
  if (declaration.evidence_source === "paper") {
    try {
      await db.insertGiftAidDeclarationEvent(ctx.member.mosque_id, {
        declaration_id: declaration.id,
        event_type: "revoked",
        actor_kind: "member",
        actor_email: ctx.member.email,
        actor_ip: clientIp(request),
        actor_user_agent: request.headers.get("user-agent"),
        before_state: { revoked_at: null },
        after_state: { revocation_requested_at: new Date().toISOString() },
        evidence_sha256: declaration.evidence_sha256,
        notes:
          reason ??
          "Member requested revocation of a paper-backed declaration; awaiting treasurer confirmation.",
      });
    } catch (err) {
      console.error("member gift-aid PATCH revoke event failed", {
        declaration_id: declaration.id,
        message: err instanceof Error ? err.message : String(err),
      });
    }
    return NextResponse.json({
      pending: true,
      message:
        "Revocation requested. Your treasurer will confirm once they pull the paper file.",
    });
  }

  try {
    await db.revokeGiftAidDeclaration(declaration.id, ctx.member.mosque_id, {
      reason,
    });
    await db.insertGiftAidDeclarationEvent(ctx.member.mosque_id, {
      declaration_id: declaration.id,
      event_type: "revoked",
      actor_kind: "member",
      actor_email: ctx.member.email,
      actor_ip: clientIp(request),
      actor_user_agent: request.headers.get("user-agent"),
      before_state: { revoked_at: null },
      after_state: { revoked_at: new Date().toISOString() },
      evidence_sha256: declaration.evidence_sha256,
      notes: reason,
    });
    await db.updateMemberGiftAidPosture(ctx.member.id, ctx.member.mosque_id, {
      gift_aid_consent_status: "declined",
    });
  } catch (err) {
    console.error("member gift-aid PATCH revoke failed", {
      declaration_id: declaration.id,
      message: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: "Could not revoke declaration." },
      { status: 500 }
    );
  }

  await writeAuditLog({
    mosqueId: ctx.member.mosque_id,
    action: "gift_aid_declaration_revoked",
    entityType: "gift_aid_declaration",
    entityId: declaration.id,
    summary: `Member ${ctx.member.email} revoked their Gift Aid declaration.`,
    metadata: { reason },
  });

  return NextResponse.json({ revoked: true });
}
