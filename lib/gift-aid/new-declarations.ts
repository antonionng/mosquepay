// "What declarations should this claim pack include?"
//
// Used by both the per-service close endpoint and the period-based claims
// endpoint so both surfaces compute the bundle the same way:
//
//   1. Anything created since the previous batch for this mosque
//      (inclusion_reason='new_in_window').
//   2. Anything not already covered by (1) that backs a donation in this
//      batch (inclusion_reason='donor_in_batch') -- belt and braces, in
//      case a Member's declaration was filed years ago and his donation
//      only got attributed now.
//
// We deliberately do NOT filter out revoked declarations here: if a row
// existed in the window, UGLE wants to know about it.

import * as db from "@/lib/db";
import type {
  GiftAidClaimBatch,
  GiftAidDeclaration,
} from "@/lib/db/types";

export type NewDeclarationLink = {
  gift_aid_declaration_id: string;
  inclusion_reason: "new_in_window" | "donor_in_batch";
};

/**
 * Resolve the declarations that should be attached to a freshly-created
 * claim batch. Pass the IDs of declarations already directly linked to
 * donations in this batch (from the claim-items step) so we can mark the
 * inclusion reason correctly.
 */
export async function resolveDeclarationsForBatch(opts: {
  mosqueId: string;
  newBatch: Pick<GiftAidClaimBatch, "created_at" | "id">;
  /** Declaration ids already linked to donations in this batch. */
  donorDeclarationIds: string[];
}): Promise<{
  links: NewDeclarationLink[];
  declarations: GiftAidDeclaration[];
}> {
  const previous = await db.getMostRecentClaimBatchBefore(
    opts.mosqueId,
    opts.newBatch.created_at,
  );
  // First-ever batch: sweep window starts at the unix epoch so we pick up
  // every existing declaration on the mosque's books. This matters for a
  // mosque that has been on LP for months before they hit Close for the
  // first time -- UGLE still needs the back-catalogue.
  const startIso = previous?.created_at ?? "1970-01-01T00:00:00.000Z";

  const newInWindow = await db.getDeclarationsCreatedBetween(
    opts.mosqueId,
    startIso,
    opts.newBatch.created_at,
  );

  const seen = new Set<string>();
  const links: NewDeclarationLink[] = [];
  for (const d of newInWindow) {
    if (seen.has(d.id)) continue;
    seen.add(d.id);
    links.push({
      gift_aid_declaration_id: d.id,
      inclusion_reason: "new_in_window",
    });
  }

  // Donor-in-batch top-up: declarations that back donations in the batch
  // but weren't created in the window (older than the previous batch).
  const missingDonorDeclIds = opts.donorDeclarationIds.filter(
    (id) => !seen.has(id),
  );
  if (missingDonorDeclIds.length > 0) {
    const extras = await db.getGiftAidDeclarationsByIds(
      opts.mosqueId,
      missingDonorDeclIds,
    );
    for (const d of extras) {
      if (seen.has(d.id)) continue;
      seen.add(d.id);
      links.push({
        gift_aid_declaration_id: d.id,
        inclusion_reason: "donor_in_batch",
      });
    }
    const byId = new Map(extras.map((d) => [d.id, d]));
    return {
      links,
      declarations: [
        ...newInWindow,
        ...missingDonorDeclIds
          .map((id) => byId.get(id))
          .filter((d): d is GiftAidDeclaration => Boolean(d)),
      ],
    };
  }

  return { links, declarations: newInWindow };
}
