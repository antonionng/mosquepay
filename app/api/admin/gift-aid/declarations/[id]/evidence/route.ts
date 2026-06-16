// Signed-URL download for a Gift Aid declaration's evidence file.
//
// Writes an `evidence_downloaded` event so every access is recorded -- if
// HMRC asks "who looked at the scan?", the answer is in the event log.
// The URL itself expires after 5 minutes so it cannot be forwarded.

import { NextRequest, NextResponse } from "next/server";
import * as db from "@/lib/db";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import { getMosqueSlugFromRequest } from "@/lib/tenant";
import {
  requireAdminApiAuth,
  requireAdminApiPermission,
} from "@/lib/auth/api";
import { getCurrentAdminContextAny } from "@/lib/auth/permissions";
import { createEvidenceDownloadUrl } from "@/lib/gift-aid/evidence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clientIp(request: NextRequest): string | null {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return request.headers.get("x-real-ip");
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const unauthorized = await requireAdminApiAuth();
  if (unauthorized) return unauthorized;
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Database not configured." },
      { status: 503 }
    );
  }
  const { id } = await params;
  const mosqueSlug = getMosqueSlugFromRequest(request);
  const mosqueId = await db.resolveMosqueId(mosqueSlug);
  if (!mosqueId) {
    return NextResponse.json({ error: "Mosque not found." }, { status: 404 });
  }
  const forbidden = await requireAdminApiPermission("charity:write", mosqueId);
  if (forbidden) return forbidden;

  const declaration = await db.getGiftAidDeclarationById(id, mosqueId);
  if (!declaration) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  if (!declaration.evidence_storage_path || !declaration.evidence_storage_bucket) {
    return NextResponse.json(
      { error: "No evidence on file for this declaration." },
      { status: 404 }
    );
  }

  let url: string;
  try {
    url = await createEvidenceDownloadUrl({
      bucket: declaration.evidence_storage_bucket,
      path: declaration.evidence_storage_path,
      expiresInSeconds: 300,
    });
  } catch (err) {
    console.error("gift-aid evidence GET: signed URL failed", {
      declaration_id: id,
      message: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: "Could not generate evidence link." },
      { status: 500 }
    );
  }

  let actorEmail: string | null = null;
  try {
    const admin = await getCurrentAdminContextAny(mosqueId);
    actorEmail = admin?.email ?? null;
  } catch {
    /* non-fatal */
  }
  try {
    await db.insertGiftAidDeclarationEvent(mosqueId, {
      declaration_id: id,
      event_type: "evidence_downloaded",
      actor_kind: "admin",
      actor_email: actorEmail,
      actor_ip: clientIp(request),
      actor_user_agent: request.headers.get("user-agent"),
      before_state: null,
      after_state: { signed_url_expires_in_seconds: 300 },
      evidence_sha256: declaration.evidence_sha256,
      notes: null,
    });
  } catch (err) {
    console.error("gift-aid evidence GET: event log write failed", {
      declaration_id: id,
      message: err instanceof Error ? err.message : String(err),
    });
  }

  return NextResponse.json({
    url,
    expires_in_seconds: 300,
    sha256: declaration.evidence_sha256,
    size_bytes: declaration.evidence_size_bytes,
    mime_type: declaration.evidence_mime_type,
  });
}
