// Download the full Gift Aid claim pack for a single batch.
//
// Returns a ZIP (see lib/gift-aid/claim-pack.ts for layout) containing
// the HMRC donations CSV, a new-declarations index CSV, every evidence
// file inlined, and a verification manifest. This is what the treasurer
// emails to the UGLE Relief Chest.
//
// Side effects: stamps `pack_generated_at` + `pack_generated_by_email`
// on the batch and writes an audit log entry. Each evidence download
// inside the pack ALSO writes its own `evidence_downloaded` event via
// the existing per-declaration endpoint? -- no, we bypass that path
// here and write a single audit row at the batch level. Per-file events
// would flood the timeline; the pack manifest itself is the audit trail.

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
import { buildClaimPack } from "@/lib/gift-aid/claim-pack";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
  const { id: batchId } = await params;
  const lodgeSlug = getLodgeSlugFromRequest(request);
  const lodgeId = await db.resolveLodgeId(lodgeSlug);
  if (!lodgeId) {
    return NextResponse.json({ error: "Lodge not found." }, { status: 404 });
  }
  const forbidden = await requireAdminApiPermission("charity:write", lodgeId);
  if (forbidden) return forbidden;

  const [batches, lodge] = await Promise.all([
    db.getGiftAidClaimBatches(lodgeId),
    db.getLodgeById(lodgeId),
  ]);
  const batch = batches.find((b) => b.id === batchId);
  if (!batch || !lodge) {
    return NextResponse.json({ error: "Batch not found." }, { status: 404 });
  }

  const [items, declarationLinks, previous] = await Promise.all([
    db.getGiftAidClaimItems(lodgeId, batchId),
    db.listClaimBatchDeclarations(lodgeId, batchId),
    db.getMostRecentClaimBatchBefore(lodgeId, batch.created_at),
  ]);
  const declarationIds = declarationLinks.map(
    (link) => link.gift_aid_declaration_id
  );
  // Also include declarations linked indirectly through donations in the
  // batch (in case a future migration adds donations whose declaration
  // wasn't explicitly attached). De-duplicate.
  for (const item of items) {
    if (
      item.gift_aid_declaration_id &&
      !declarationIds.includes(item.gift_aid_declaration_id)
    ) {
      declarationIds.push(item.gift_aid_declaration_id);
    }
  }
  const declarations = await db.getGiftAidDeclarationsByIds(
    lodgeId,
    declarationIds
  );

  let pack;
  try {
    pack = await buildClaimPack({
      lodge,
      batch,
      items,
      declarations,
      previousBatchCreatedAt: previous?.created_at ?? null,
    });
  } catch (err) {
    console.error("claim pack build failed", {
      batch_id: batchId,
      message: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: "Could not build claim pack." },
      { status: 500 }
    );
  }

  let actorEmail: string | null = null;
  try {
    const admin = await getCurrentAdminContextAny(lodgeId);
    actorEmail = admin?.email ?? null;
  } catch {
    /* non-fatal */
  }
  try {
    await db.markClaimBatchPackGenerated(batchId, lodgeId, actorEmail);
  } catch (err) {
    console.warn("claim pack: stamp failed (non-fatal)", {
      batch_id: batchId,
      message: err instanceof Error ? err.message : String(err),
    });
  }

  await writeAuditLog({
    lodgeId,
    action: "gift_aid_claim_pack_downloaded",
    entityType: "gift_aid_claim_batch",
    entityId: batchId,
    summary: `Generated Gift Aid claim pack for ${batch.claim_reference ?? batchId} (${pack.declarationsIncluded} declarations).`,
    metadata: {
      declarations_included: pack.declarationsIncluded,
      declarations_missing_evidence: pack.declarationsWithMissingEvidence,
      donations: items.length,
    },
  });

  // Use a Blob for the body so Web Response types accept it without
  // bickering about Node's Buffer / Uint8Array variance.
  const blob = new Blob([new Uint8Array(pack.zip)], {
    type: "application/zip",
  });
  return new Response(blob, {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${pack.filename}"`,
      "Content-Length": String(blob.size),
      "Cache-Control": "private, no-store",
    },
  });
}
