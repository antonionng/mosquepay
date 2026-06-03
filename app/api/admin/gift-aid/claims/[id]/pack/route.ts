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

  const [items, declarationLinks, previous, collections] = await Promise.all([
    db.getGiftAidClaimItems(lodgeId, batchId),
    db.listClaimBatchDeclarations(lodgeId, batchId),
    db.getMostRecentClaimBatchBefore(lodgeId, batch.created_at),
    db.getMeetingCollections(lodgeId).catch(() => []),
  ]);

  // GASDS lives on the meeting collection this batch was created from (if
  // the batch came from a meeting close). Bundle the small-cash figure into
  // the pack so the Relief Chest can reconcile it with the same meeting.
  const linkedCollection = collections.find(
    (c) => c.gift_aid_claim_batch_id === batchId,
  );
  const gasds =
    linkedCollection && Number(linkedCollection.gasds_eligible_amount ?? 0) > 0
      ? {
          eligibleAmount: Number(linkedCollection.gasds_eligible_amount),
          reclaimableAmount: Number(linkedCollection.gasds_eligible_amount) * 0.25,
          taxYear: linkedCollection.gasds_tax_year,
        }
      : null;

  // Three sets of declarations the pack needs, driven by inclusion_reason:
  //
  //   1. `newDeclarationIds` (new_in_window) -- declarations signed since
  //      the previous batch. These get evidence + an index row in the
  //      pack's new-declarations/ folder. UGLE retains these.
  //
  //   2. `previouslySuppliedIds` (donor_in_batch) -- declarations that
  //      back a donation in this batch but were already shipped in an
  //      earlier pack. Evidence goes in previously-supplied-declarations/
  //      so the pack stays self-contained, clearly flagged so UGLE knows
  //      they already hold them.
  //
  //   3. `addressLookupIds` -- every declaration any item references,
  //      regardless of when filed. Used only to populate postcode + house
  //      number on the ChR1 donations CSV.
  const newDeclarationIds = declarationLinks
    .filter((link) => link.inclusion_reason === "new_in_window")
    .map((link) => link.gift_aid_declaration_id);
  const previouslySuppliedIds = declarationLinks
    .filter((link) => link.inclusion_reason === "donor_in_batch")
    .map((link) => link.gift_aid_declaration_id);
  const addressLookupIds = new Set<string>([
    ...newDeclarationIds,
    ...previouslySuppliedIds,
  ]);
  for (const item of items) {
    if (item.gift_aid_declaration_id) {
      addressLookupIds.add(item.gift_aid_declaration_id);
    }
  }
  const [newDeclarations, previouslySupplied, declarationAddressLookup] =
    await Promise.all([
      db.getGiftAidDeclarationsByIds(lodgeId, newDeclarationIds),
      db.getGiftAidDeclarationsByIds(lodgeId, previouslySuppliedIds),
      db.getGiftAidDeclarationsByIds(lodgeId, Array.from(addressLookupIds)),
    ]);

  let pack;
  try {
    pack = await buildClaimPack({
      lodge,
      batch,
      items,
      newDeclarations,
      previouslySupplied,
      declarationAddressLookup,
      previousBatchCreatedAt: previous?.created_at ?? null,
      gasds,
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
    summary: `Generated Gift Aid claim pack for ${batch.claim_reference ?? batchId} (${pack.newDeclarationsIncluded} new declaration${pack.newDeclarationsIncluded === 1 ? "" : "s"}).`,
    metadata: {
      new_declarations_included: pack.newDeclarationsIncluded,
      previously_supplied_included: pack.previouslySuppliedIncluded,
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
