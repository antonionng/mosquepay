// Generate the downloadable claim pack for the Relief Chest at UGLE.
//
// Returns a ZIP buffer containing:
//   - claim-pack.csv       HMRC ChR1-shaped row per donation in this batch
//   - new-declarations.csv index of every declaration bundled here, with
//                          name/address/source/sha256/uploaded_at
//   - declarations/<id>.<ext> the actual evidence file for each new
//                          declaration (PDF, JPG, PNG, or the
//                          server-rendered HTML for digital ones)
//   - MANIFEST.txt         human-readable explainer including the
//                          per-file SHA-256 so any recipient can verify
//                          the pack hasn't been tampered with in transit
//
// Files are streamed in via the private storage bucket and re-hashed at
// pack time as a defence-in-depth check: if a stored byte ever drifted
// from what was originally written, the SHA we put in MANIFEST.txt would
// no longer match the row's persisted hash and we'd notice immediately.

import JSZip from "jszip";
import { createServiceClient } from "@/lib/supabase/server";
import { sha256Hex } from "@/lib/gift-aid/evidence";
import type {
  GiftAidClaimBatch,
  GiftAidClaimItem,
  GiftAidDeclaration,
  Lodge,
} from "@/lib/db/types";

function csvEscape(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const str = typeof value === "number" ? String(value) : value;
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function csvRow(values: Array<string | number | null | undefined>): string {
  return values.map(csvEscape).join(",");
}

/**
 * Split a donor name into (first, last) for the HMRC CSV which insists on
 * separate columns. Best-effort -- HMRC also accept everything in
 * "lastname" as long as it's there.
 */
function splitName(name: string | null | undefined): {
  first: string;
  last: string;
} {
  const trimmed = (name ?? "").trim();
  if (!trimmed) return { first: "", last: "" };
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return { first: "", last: parts[0]! };
  return {
    first: parts.slice(0, -1).join(" "),
    last: parts[parts.length - 1]!,
  };
}

/**
 * House name or number is the first thing on address line 1 in the HMRC
 * ChR1 schema. We pluck the leading number/letter group; everything else
 * is the street/postcode bundle they don't ask for separately.
 */
function houseFromAddressLine(line: string | null | undefined): string {
  if (!line) return "";
  const trimmed = line.trim();
  const match = trimmed.match(/^([0-9]+[a-zA-Z]?)\b/);
  if (match) return match[1]!;
  // Fall back to the first word so "Rose Cottage, ..." → "Rose Cottage".
  const commaIdx = trimmed.indexOf(",");
  if (commaIdx > 0) return trimmed.slice(0, commaIdx).trim();
  return trimmed.slice(0, 40);
}

function extensionFromMimeOrPath(mime: string | null, path: string): string {
  const map: Record<string, string> = {
    "application/pdf": "pdf",
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/heic": "heic",
    "image/heif": "heif",
    "text/html": "html",
  };
  if (mime && map[mime]) return map[mime]!;
  const dot = path.lastIndexOf(".");
  if (dot >= 0) return path.slice(dot + 1).toLowerCase();
  return "bin";
}

export type ClaimPackInput = {
  lodge: Lodge;
  batch: GiftAidClaimBatch;
  items: GiftAidClaimItem[];
  declarations: GiftAidDeclaration[];
  previousBatchCreatedAt: string | null;
};

export type ClaimPackResult = {
  zip: Buffer;
  filename: string;
  declarationsIncluded: number;
  declarationsWithMissingEvidence: number;
};

/**
 * Build the claim pack ZIP. Pure function over the inputs; the caller is
 * responsible for fetching declarations/items and providing them.
 */
export async function buildClaimPack(
  input: ClaimPackInput,
): Promise<ClaimPackResult> {
  const { lodge, batch, items, declarations, previousBatchCreatedAt } = input;
  const zip = new JSZip();

  // ---- 1. HMRC donation CSV --------------------------------------------
  const donationHeader = [
    "Title",
    "First name",
    "Last name",
    "House name or number",
    "Postcode",
    "Donation date",
    "Source",
    "Donation amount",
    "Eligible amount",
    "Reclaimable amount",
    "Donor email",
    "Declaration on file",
  ];
  const declarationsById = new Map(declarations.map((d) => [d.id, d]));
  const donationLines = [csvRow(donationHeader)];
  for (const item of items) {
    const decl = item.gift_aid_declaration_id
      ? declarationsById.get(item.gift_aid_declaration_id)
      : undefined;
    const { first, last } = splitName(item.donor_name);
    donationLines.push(
      csvRow([
        "",
        first,
        last,
        houseFromAddressLine(decl?.donor_address_line_1 ?? null),
        decl?.donor_postcode ?? "",
        item.donation_date,
        item.source,
        item.eligible_amount.toFixed(2),
        item.eligible_amount.toFixed(2),
        item.reclaimable_amount.toFixed(2),
        item.donor_email ?? "",
        decl ? "yes" : "no",
      ]),
    );
  }
  zip.file("claim-pack.csv", donationLines.join("\n") + "\n");

  // ---- 2. New declarations index CSV -----------------------------------
  const declarationsHeader = [
    "Declaration ID",
    "Donor name",
    "Donor email",
    "Address line 1",
    "Address line 2",
    "City",
    "Postcode",
    "Country",
    "Evidence source",
    "Declaration date (UTC)",
    "Paper received date",
    "Paper filing reference",
    "Signed-by IP (digital)",
    "Revoked at",
    "Evidence SHA-256",
    "Evidence file",
  ];
  const declLines = [csvRow(declarationsHeader)];

  // ---- 3. Inline evidence files + verification -------------------------
  const supabase = createServiceClient();
  let missingEvidenceCount = 0;
  const evidenceFolder = zip.folder("declarations");
  for (const decl of declarations) {
    let storedFilename = "";
    if (decl.evidence_storage_bucket && decl.evidence_storage_path) {
      try {
        const { data, error } = await supabase.storage
          .from(decl.evidence_storage_bucket)
          .download(decl.evidence_storage_path);
        if (error) throw error;
        const arrayBuffer = await data.arrayBuffer();
        const bytes = Buffer.from(arrayBuffer);
        const reHash = sha256Hex(bytes);
        // Sanity check: in-flight verification. Annotate the row CSV if the
        // stored bytes no longer match the row's persisted hash so the
        // treasurer (and the Relief Chest) can see immediately that
        // something's wrong rather than discovering it years later.
        const matches = decl.evidence_sha256
          ? reHash === decl.evidence_sha256
          : true;
        const ext = extensionFromMimeOrPath(
          decl.evidence_mime_type,
          decl.evidence_storage_path,
        );
        storedFilename = matches
          ? `${decl.id}.${ext}`
          : `${decl.id}.HASH-MISMATCH.${ext}`;
        evidenceFolder?.file(storedFilename, bytes);
      } catch (err) {
        console.warn("claim-pack: evidence download failed", {
          declaration_id: decl.id,
          message: err instanceof Error ? err.message : String(err),
        });
        missingEvidenceCount += 1;
        storedFilename = "<MISSING>";
      }
    } else {
      missingEvidenceCount += 1;
      storedFilename = "<NO EVIDENCE ON FILE>";
    }

    declLines.push(
      csvRow([
        decl.id,
        decl.donor_name,
        decl.donor_email,
        decl.donor_address_line_1,
        decl.donor_address_line_2,
        decl.donor_city,
        decl.donor_postcode,
        decl.donor_country,
        decl.evidence_source,
        decl.created_at,
        decl.paper_received_date,
        decl.paper_filing_reference,
        decl.digital_signature_ip,
        decl.revoked_at,
        decl.evidence_sha256,
        storedFilename,
      ]),
    );
  }
  zip.file("new-declarations.csv", declLines.join("\n") + "\n");

  // ---- 4. Manifest ------------------------------------------------------
  const manifest = [
    `LodgePay Gift Aid claim pack`,
    `Generated: ${new Date().toISOString()}`,
    `Lodge: ${lodge.name}${lodge.lodge_number ? ` No. ${lodge.lodge_number}` : ""}`,
    `HMRC reference: ${lodge.hmrc_charity_reference ?? "(not set)"}`,
    `Relief Chest: ${lodge.relief_chest_name ?? "(not set)"}`,
    ``,
    `Batch reference: ${batch.claim_reference ?? batch.id}`,
    `Period: ${batch.period_start} -- ${batch.period_end}`,
    `Donations: ${items.length}`,
    `Eligible amount: £${batch.eligible_amount.toFixed(2)}`,
    `Reclaimable amount: £${batch.reclaimable_amount.toFixed(2)}`,
    `Declarations bundled: ${declarations.length}`,
    `Declarations missing evidence: ${missingEvidenceCount}`,
    `Window covered: ${previousBatchCreatedAt ?? "first-ever batch"} -- ${batch.created_at}`,
    ``,
    `--- How to verify ---`,
    `Every declaration evidence file has a SHA-256 listed in`,
    `new-declarations.csv. To verify any file:`,
    `    shasum -a 256 declarations/<filename>`,
    `The result must match the "Evidence SHA-256" column in`,
    `new-declarations.csv. If a file is named *.HASH-MISMATCH.* the`,
    `stored bytes no longer match the hash recorded when the declaration`,
    `was filed -- please contact the LodgePay treasurer immediately.`,
    ``,
    `--- HMRC declaration text ---`,
    `Every declaration in this pack was made under the following wording`,
    `(or earlier-snapshot equivalent visible in the declaration's HTML`,
    `evidence file):`,
    ``,
    `I want to Gift Aid this donation and any donations I make in the`,
    `future or have made in the past 4 years to the named charity. I am a`,
    `UK taxpayer and understand that if I pay less Income Tax and/or`,
    `Capital Gains Tax than the amount of Gift Aid claimed on all my`,
    `donations in that tax year it is my responsibility to pay any`,
    `difference.`,
    ``,
  ].join("\n");
  zip.file("MANIFEST.txt", manifest);

  const buffer = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });

  const slug = batch.claim_reference
    ? batch.claim_reference.replace(/[^a-zA-Z0-9-]/g, "_")
    : batch.id.slice(0, 8);
  return {
    zip: buffer,
    filename: `gift-aid-claim-pack-${slug}.zip`,
    declarationsIncluded: declarations.length,
    declarationsWithMissingEvidence: missingEvidenceCount,
  };
}
