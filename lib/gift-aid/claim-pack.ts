// Generate the downloadable claim pack for the Gift Aid pack at UGLE.
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
  Church,
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

/**
 * Filesystem-safe, human-readable stub for an evidence filename. We newcomer
 * with the donor's surname so a treasurer or UGLE clerk scanning the
 * folder can find a person at a glance, then append a short id fragment to
 * guarantee uniqueness when two Members share a surname.
 */
function safeNameStub(name: string | null | undefined): string {
  const cleaned = (name ?? "")
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return cleaned || "donor";
}

/**
 * Build a declarations subfolder (evidence files + an INDEX.csv) inside the
 * pack. Used twice: once for the genuinely-new declarations and once for
 * the previously-supplied ones. Each evidence file is downloaded from the
 * private bucket and re-hashed; a drift from the row's persisted SHA-256
 * renames the file `*.HASH-MISMATCH.*` so it screams rather than hides.
 */
async function addDeclarationsFolder(opts: {
  zip: JSZip;
  supabase: ReturnType<typeof createServiceClient>;
  declarations: GiftAidDeclaration[];
  folderName: string;
  /** When true, adds a "Status" column noting the evidence was sent before. */
  previouslySupplied: boolean;
}): Promise<{ count: number; missingEvidence: number }> {
  const { zip, supabase, declarations, folderName, previouslySupplied } = opts;
  const folder = zip.folder(folderName);
  const header = [
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
    ...(previouslySupplied ? ["Status"] : []),
  ];
  const lines = [csvRow(header)];
  let missingEvidence = 0;

  for (const decl of declarations) {
    let storedFilename = "";
    if (decl.evidence_storage_bucket && decl.evidence_storage_path) {
      try {
        const { data, error } = await supabase.storage
          .from(decl.evidence_storage_bucket)
          .download(decl.evidence_storage_path);
        if (error) throw error;
        const bytes = Buffer.from(await data.arrayBuffer());
        const reHash = sha256Hex(bytes);
        const matches = decl.evidence_sha256
          ? reHash === decl.evidence_sha256
          : true;
        const ext = extensionFromMimeOrPath(
          decl.evidence_mime_type,
          decl.evidence_storage_path,
        );
        const stub = safeNameStub(
          splitName(decl.donor_name).last || decl.donor_name,
        );
        storedFilename = `${stub}__${decl.id.slice(0, 8)}${
          matches ? "" : ".HASH-MISMATCH"
        }.${ext}`;
        folder?.file(storedFilename, bytes);
      } catch (err) {
        console.warn("claim-pack: evidence download failed", {
          declaration_id: decl.id,
          message: err instanceof Error ? err.message : String(err),
        });
        missingEvidence += 1;
        storedFilename = "<MISSING>";
      }
    } else {
      missingEvidence += 1;
      storedFilename = "<NO EVIDENCE ON FILE>";
    }

    lines.push(
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
        ...(previouslySupplied
          ? ["Evidence previously supplied to UGLE in an earlier pack"]
          : []),
      ]),
    );
  }

  folder?.file("INDEX.csv", lines.join("\n") + "\n");
  return { count: declarations.length, missingEvidence };
}

export type ClaimPackInput = {
  church: Church;
  batch: GiftAidClaimBatch;
  items: GiftAidClaimItem[];
  /**
   * Genuinely-new declarations (inclusion_reason = 'new_in_window').
   * These get their evidence + an INDEX row in the `new-declarations/`
   * folder -- the ones UGLE must retain this cycle.
   */
  newDeclarations: GiftAidDeclaration[];
  /**
   * Declarations that back a donation in this batch but were already
   * shipped in an earlier pack (inclusion_reason = 'donor_in_batch').
   * Evidence is re-attached under `previously-supplied-declarations/` so
   * the pack stays self-contained, but clearly labelled so UGLE knows
   * they already hold these. Empty array -> folder omitted.
   */
  previouslySupplied?: GiftAidDeclaration[];
  /**
   * Address-lookup set covering every declaration referenced by any
   * claim item, used to populate postcode + house number in the ChR1
   * donations CSV. Always supply for production packs so donations whose
   * declaration was filed in an earlier batch still get their address.
   */
  declarationAddressLookup?: GiftAidDeclaration[];
  previousBatchCreatedAt: string | null;
  /**
   * Small-donations (GASDS) figures from the service collection linked to
   * this batch, when there is one. GASDS is claimed separately from Gift
   * Aid but the Gift Aid pack wants the small-cash total alongside the
   * declaration-backed claim, so we include a summary sheet + manifest note.
   */
  gasds?: {
    eligibleAmount: number;
    reclaimableAmount: number;
    taxYear: string | null;
  } | null;
};

export type ClaimPackResult = {
  zip: Buffer;
  filename: string;
  newDeclarationsIncluded: number;
  previouslySuppliedIncluded: number;
  declarationsWithMissingEvidence: number;
};

/**
 * Build the claim pack ZIP. Pure function over the inputs; the caller is
 * responsible for fetching declarations/items and providing them.
 */
export async function buildClaimPack(
  input: ClaimPackInput,
): Promise<ClaimPackResult> {
  const {
    church,
    batch,
    items,
    newDeclarations,
    previouslySupplied = [],
    declarationAddressLookup,
    previousBatchCreatedAt,
    gasds = null,
  } = input;
  const zip = new JSZip();
  const supabase = createServiceClient();

  // ---- 1. HMRC donation CSV (root) -------------------------------------
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
  // Address lookup spans every declaration referenced by any item in this
  // batch (so the ChR1 CSV gets the donor's address even when their
  // declaration was filed and exported in an earlier batch). Falls back to
  // the new + previously-supplied union.
  const addressLookupById = new Map(
    (declarationAddressLookup ?? [...newDeclarations, ...previouslySupplied]).map(
      (d) => [d.id, d],
    ),
  );
  const donationLines = [csvRow(donationHeader)];
  for (const item of items) {
    const decl = item.gift_aid_declaration_id
      ? addressLookupById.get(item.gift_aid_declaration_id)
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

  // ---- 1b. GASDS small-donations summary (only when present) -----------
  // GASDS (Gift Aid Small Donations Scheme) lets the church reclaim the
  // basic-rate top-up on small anonymous cash donations without a
  // declaration. It's a separate HMRC claim, but the Gift Aid pack likes
  // the figure bundled so it can be reconciled with the same service.
  if (gasds && gasds.eligibleAmount > 0) {
    const gasdsLines = [
      csvRow(["Tax year", "Eligible small cash", "Reclaimable (25%)"]),
      csvRow([
        gasds.taxYear ?? "",
        gasds.eligibleAmount.toFixed(2),
        gasds.reclaimableAmount.toFixed(2),
      ]),
    ];
    zip.file("gasds-summary.csv", gasdsLines.join("\n") + "\n");
  }

  // ---- 2. New declarations folder (evidence UGLE must retain) ----------
  const newResult = await addDeclarationsFolder({
    zip,
    supabase,
    declarations: newDeclarations,
    folderName: "new-declarations",
    previouslySupplied: false,
  });

  // ---- 3. Previously-supplied folder (only if any) ---------------------
  let prevResult = { count: 0, missingEvidence: 0 };
  if (previouslySupplied.length > 0) {
    prevResult = await addDeclarationsFolder({
      zip,
      supabase,
      declarations: previouslySupplied,
      folderName: "previously-supplied-declarations",
      previouslySupplied: true,
    });
  }

  const missingEvidenceCount =
    newResult.missingEvidence + prevResult.missingEvidence;

  // ---- 4. Manifest ------------------------------------------------------
  const prevFolderLine =
    prevResult.count > 0
      ? `Previously-supplied declarations: ${prevResult.count}  (folder: previously-supplied-declarations/)`
      : `Previously-supplied declarations: 0  (none -- folder omitted)`;
  const manifest = [
    `ChurchPay Gift Aid claim pack`,
    `============================`,
    ``,
    `WHAT THIS IS`,
    `Everything the UGLE Gift Aid pack needs for one Gift Aid claim from`,
    `this church: a ChR1-shaped list of donations, plus copies of the`,
    `signed declarations that back them. Forward the whole ZIP to the`,
    `Gift Aid pack -- nothing else needs assembling by hand.`,
    ``,
    `Generated: ${new Date().toISOString()}`,
    `Church: ${church.name}${church.church_number ? ` No. ${church.church_number}` : ""}`,
    `HMRC reference: ${church.hmrc_charity_reference ?? "(not set)"}`,
    `Gift Aid pack: ${church.gift_aid_pack_name ?? "(not set)"}`,
    ``,
    `Batch reference: ${batch.claim_reference ?? batch.id}`,
    `Period: ${batch.period_start} -- ${batch.period_end}`,
    `Donations in claim: ${items.length}`,
    `Eligible amount: £${batch.eligible_amount.toFixed(2)}`,
    `Reclaimable (25%): £${batch.reclaimable_amount.toFixed(2)}`,
    ...(gasds && gasds.eligibleAmount > 0
      ? [
          ``,
          `GASDS small donations (separate scheme, see gasds-summary.csv):`,
          `  Tax year: ${gasds.taxYear ?? "(not set)"}`,
          `  Eligible small cash: £${gasds.eligibleAmount.toFixed(2)}`,
          `  Reclaimable (25%): £${gasds.reclaimableAmount.toFixed(2)}`,
        ]
      : []),
    ``,
    `New declarations in this pack: ${newResult.count}  (folder: new-declarations/)`,
    prevFolderLine,
    `Declarations missing evidence: ${missingEvidenceCount}`,
    `Window covered: ${previousBatchCreatedAt ?? "first-ever batch"} -- ${batch.created_at}`,
    ``,
    `WHAT'S IN EACH FILE`,
    `- claim-pack.csv`,
    `    One row per donation in this claim, in HMRC ChR1 column order.`,
    `    This is the figure list the Gift Aid pack works from.`,
    `- new-declarations/INDEX.csv + evidence files`,
    `    Declarations signed since your last claim. THESE are the ones`,
    `    UGLE needs to retain for this cycle. Paper declarations are the`,
    `    scanned slip; digital ones are a printable HTML snapshot of what`,
    `    the member signed (IP, timestamp, exact wording).`,
    prevResult.count > 0
      ? `- previously-supplied-declarations/INDEX.csv + evidence files\n    Donors who gave in this period whose declaration was already sent\n    in an earlier pack. Included so the pack is self-contained; no\n    action needed if you already hold them.`
      : `- previously-supplied-declarations/  (not present in this pack)`,
    ``,
    `HOW TO VERIFY (tamper-evidence)`,
    `Every evidence file has a SHA-256 listed in its folder's INDEX.csv.`,
    `To verify any file:`,
    `    shasum -a 256 new-declarations/<filename>`,
    `The result must match the "Evidence SHA-256" column. If a file is`,
    `named *.HASH-MISMATCH.* the stored bytes no longer match the hash`,
    `recorded when the declaration was filed -- contact the church`,
    `treasurer before relying on it.`,
    ``,
    `HMRC DECLARATION WORDING`,
    `Every declaration in this pack was made under the following wording`,
    `(or an earlier-snapshot equivalent visible in the declaration's HTML`,
    `evidence file):`,
    ``,
    `"I want to Gift Aid this donation and any donations I make in the`,
    `future or have made in the past 4 years to the named charity. I am a`,
    `UK taxpayer and understand that if I pay less Income Tax and/or`,
    `Capital Gains Tax than the amount of Gift Aid claimed on all my`,
    `donations in that tax year it is my responsibility to pay any`,
    `difference."`,
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
    newDeclarationsIncluded: newResult.count,
    previouslySuppliedIncluded: prevResult.count,
    declarationsWithMissingEvidence: missingEvidenceCount,
  };
}
