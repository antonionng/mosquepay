// Admin Gift Aid declarations endpoint.
//
// POST -- create a paper-backed declaration. Form-data body so the admin
//         can upload the scanned wet-ink slip in the same request. Writes
//         the declaration row, uploads the scan to the private evidence
//         bucket (hashed), and stamps the row + the append-only event
//         log. This is Lester's path: he comes home from lodge night with
//         a stack of forms and uploads them in one sitting.
//
// Auth: admin with `charity:write` on the active lodge.

import { NextRequest, NextResponse } from "next/server";
import * as db from "@/lib/db";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import { getLodgeSlugFromRequest } from "@/lib/tenant";
import {
  requireAdminApiAuth,
  requireAdminApiPermission,
} from "@/lib/auth/api";
import { getCurrentAdminContextAny } from "@/lib/auth/permissions";
import { writeAuditLog } from "@/lib/audit";
import {
  HMRC_DECLARATION_TEXT_V1,
  isAllowedPaperMime,
  maxPaperBytes,
  uploadEvidence,
} from "@/lib/gift-aid/evidence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function trimOrNull(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") return null;
  const out = value.trim();
  return out.length === 0 ? null : out;
}

function clientIp(request: NextRequest): string | null {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return request.headers.get("x-real-ip");
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
  const forbidden = await requireAdminApiPermission("charity:write", lodgeId);
  if (forbidden) return forbidden;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Expected multipart/form-data." },
      { status: 400 }
    );
  }

  const memberId = trimOrNull(form.get("member_id"));
  const donorName = trimOrNull(form.get("donor_name"));
  const donorEmail = trimOrNull(form.get("donor_email"));
  const addressLine1 = trimOrNull(form.get("donor_address_line_1"));
  const addressLine2 = trimOrNull(form.get("donor_address_line_2"));
  const city = trimOrNull(form.get("donor_city"));
  const postcode = trimOrNull(form.get("donor_postcode"));
  const country =
    trimOrNull(form.get("donor_country")) ?? "United Kingdom";
  const paperReceivedDate = trimOrNull(form.get("paper_received_date"));
  const filingReference = trimOrNull(form.get("paper_filing_reference"));
  const confirmedHoldingOriginal =
    trimOrNull(form.get("confirmed_holding_original")) === "true";
  const declarationText =
    trimOrNull(form.get("declaration_text")) ?? HMRC_DECLARATION_TEXT_V1;
  const file = form.get("evidence_file");

  if (!donorName || !donorEmail || !addressLine1 || !city || !postcode) {
    return NextResponse.json(
      {
        error:
          "Donor name, email, address line 1, town/city, and postcode are required.",
      },
      { status: 400 }
    );
  }
  if (!confirmedHoldingOriginal) {
    return NextResponse.json(
      {
        error:
          "You must confirm you are holding the original signed paper declaration.",
      },
      { status: 400 }
    );
  }
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "Upload the scanned signed declaration." },
      { status: 400 }
    );
  }
  if (!isAllowedPaperMime(file.type)) {
    return NextResponse.json(
      { error: "Upload a PDF or image (JPG, PNG, WebP, HEIC)." },
      { status: 400 }
    );
  }
  if (file.size > maxPaperBytes()) {
    return NextResponse.json(
      { error: "File must be smaller than 12 MB." },
      { status: 400 }
    );
  }

  // Optional member link. We accept declarations for a guest / outsider
  // too (member_id omitted), so absence is fine; presence means we'll
  // light up the dashboard banner correctly.
  if (memberId) {
    const member = await db.getMemberById(memberId, lodgeId);
    if (!member) {
      return NextResponse.json(
        { error: "Member not found in this lodge." },
        { status: 400 }
      );
    }
  }

  let actorEmail: string | null = null;
  try {
    const admin = await getCurrentAdminContextAny(lodgeId);
    actorEmail = admin?.email ?? null;
  } catch {
    /* non-fatal */
  }

  // Insert the row first so we have an id for the storage path. If the
  // upload fails we revoke the row immediately so we don't leave a
  // confirmed-but-unevidenced declaration on file.
  let declaration;
  try {
    declaration = await db.addGiftAidDeclaration(lodgeId, {
      donor_name: donorName,
      donor_email: donorEmail,
      donor_address_line_1: addressLine1,
      donor_address_line_2: addressLine2,
      donor_city: city,
      donor_postcode: postcode,
      donor_country: country,
      declaration_text: declarationText,
      declaration_confirmed: true,
      confirmation_method: "paper_signature",
      hmrc_eligible: true,
      declaration_source: "admin_paper_upload",
      evidence_source: "paper",
      paper_received_date: paperReceivedDate,
      paper_filing_reference: filingReference,
      member_id: memberId,
    });
  } catch (err) {
    console.error("admin gift-aid paper POST: insert failed", {
      lodge_id: lodgeId,
      message: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: "Could not record declaration." },
      { status: 500 }
    );
  }

  let evidence;
  try {
    const bytes = Buffer.from(await file.arrayBuffer());
    evidence = await uploadEvidence({
      lodgeId,
      declarationId: declaration.id,
      bytes,
      mimeType: file.type,
    });
  } catch (err) {
    console.error("admin gift-aid paper POST: upload failed; revoking row", {
      declaration_id: declaration.id,
      message: err instanceof Error ? err.message : String(err),
    });
    // Don't leave an unbacked declaration around. Revoke immediately so the
    // claim batches won't pick it up.
    try {
      await db.revokeGiftAidDeclaration(declaration.id, lodgeId, {
        reason: "evidence_upload_failed",
      });
    } catch {
      /* swallow */
    }
    return NextResponse.json(
      { error: "Could not store the scanned declaration." },
      { status: 500 }
    );
  }

  const nowIso = new Date().toISOString();
  try {
    await db.updateGiftAidDeclarationEvidence(declaration.id, lodgeId, {
      evidence_source: "paper",
      evidence_storage_bucket: evidence.bucket,
      evidence_storage_path: evidence.path,
      evidence_sha256: evidence.sha256,
      evidence_size_bytes: evidence.size,
      evidence_mime_type: evidence.mime,
      evidence_uploaded_at: nowIso,
      evidence_uploaded_by_email: actorEmail,
    });
  } catch (err) {
    console.error("admin gift-aid paper POST: evidence stamp failed", {
      declaration_id: declaration.id,
      message: err instanceof Error ? err.message : String(err),
    });
  }

  try {
    await db.insertGiftAidDeclarationEvent(lodgeId, {
      declaration_id: declaration.id,
      event_type: "created_paper",
      actor_kind: "admin",
      actor_email: actorEmail,
      actor_ip: clientIp(request),
      actor_user_agent: request.headers.get("user-agent"),
      before_state: null,
      after_state: {
        donor_name: donorName,
        donor_email: donorEmail,
        paper_received_date: paperReceivedDate,
        paper_filing_reference: filingReference,
      },
      evidence_sha256: evidence.sha256,
      notes: "Treasurer confirmed holding original signed declaration.",
    });
  } catch (err) {
    console.error("admin gift-aid paper POST: event insert failed", {
      declaration_id: declaration.id,
      message: err instanceof Error ? err.message : String(err),
    });
  }

  if (memberId) {
    try {
      await db.updateMemberGiftAidPosture(memberId, lodgeId, {
        gift_aid_consent_status: "declared",
        gift_aid_prompted_at: nowIso,
      });
    } catch (err) {
      console.warn("admin gift-aid paper POST: member posture update failed", {
        member_id: memberId,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  await writeAuditLog({
    lodgeId,
    action: "gift_aid_declaration_created_paper",
    entityType: "gift_aid_declaration",
    entityId: declaration.id,
    summary: `Paper Gift Aid declaration recorded for ${donorName}.`,
    metadata: {
      donor_email: donorEmail,
      evidence_sha256: evidence.sha256,
      paper_filing_reference: filingReference,
    },
  });

  return NextResponse.json(
    {
      declaration: {
        id: declaration.id,
        evidence_source: "paper",
        evidence_sha256: evidence.sha256,
        created_at: declaration.created_at,
      },
    },
    { status: 201 }
  );
}
