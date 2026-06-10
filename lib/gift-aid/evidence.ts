// Gift Aid evidence helpers.
//
// Every declaration carries an evidence artefact stored in a private
// Supabase Storage bucket plus a SHA-256 digest persisted on the row. The
// digest is the answer to "could LP have changed the file after the fact?"
// An auditor can re-hash the downloaded file and compare; a mismatch means
// the row has been tampered with.
//
// Two flavours:
//
//   1. Paper -- treasurer uploads the scanned wet-ink slip via the admin
//      Gift Aid screen. We hash the bytes, store them, and write an
//      `evidence_uploaded` event with the actor + IP + UA.
//
//   2. Digital -- the donate form or the member portal records the
//      e-signature (IP, UA, checkbox state, presented declaration text).
//      We render a deterministic HTML "printable declaration" with all of
//      that on it, hash it, and store it. The HTML is intentionally tiny
//      and self-contained so a future tool can re-render it bit-for-bit
//      from the same DB row and verify the hash without depending on
//      external CSS or assets.
//
// The bucket is created lazily on first use (mirrors the pattern in
// `app/api/admin/site-assets/route.ts`). It is private; reads go through
// signed URLs scoped to the requesting admin or member.

import { createHash, randomUUID } from "node:crypto";
import { createServiceClient } from "@/lib/supabase/server";

export const EVIDENCE_BUCKET = "gift-aid-evidence";

// HMRC current model declaration wording. We snapshot the exact text the
// member saw onto the row so a future wording change doesn't retroactively
// rewrite what was agreed to.
export const HMRC_DECLARATION_TEXT_V1 =
  "I want to Gift Aid this donation and any donations I make in the future or have made in the past 4 years to the named charity. I am a UK taxpayer and understand that if I pay less Income Tax and/or Capital Gains Tax than the amount of Gift Aid claimed on all my donations in that tax year it is my responsibility to pay any difference.";

const ALLOWED_PAPER_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

const MAX_PAPER_BYTES = 12 * 1024 * 1024;

export function isAllowedPaperMime(mime: string): boolean {
  return ALLOWED_PAPER_MIME.has(mime);
}

export function maxPaperBytes(): number {
  return MAX_PAPER_BYTES;
}

/**
 * SHA-256 hex of an arbitrary byte buffer. Lower-case, no separators. The
 * same value is recorded on the declaration row and printed on the audit
 * trail PDF so an auditor can verify the file matches.
 */
export function sha256Hex(bytes: Uint8Array | Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/**
 * Strict, predictable filename: <declaration_id>__<sha8>.<ext>. Hash
 * fragment lets a human spot a swapped file at a glance. We never let the
 * caller pick the path -- it always lives under the bucket-scoped folder
 * `<church_id>/<declaration_id>/...` so two churches cannot collide and the
 * RLS path-prefix scheme keeps tidy.
 */
export function buildEvidencePath(opts: {
  churchId: string;
  declarationId: string;
  sha256Hex: string;
  extension: string;
}): string {
  const ext = opts.extension.replace(/^\.+/, "").toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
  const short = opts.sha256Hex.slice(0, 8);
  return `${opts.churchId}/${opts.declarationId}/${opts.declarationId}__${short}.${ext}`;
}

export function extensionForMime(mime: string): string {
  const map: Record<string, string> = {
    "application/pdf": "pdf",
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/heic": "heic",
    "image/heif": "heif",
    "text/html": "html",
  };
  return map[mime] ?? "bin";
}

/** Lazily create the private evidence bucket on first use. */
async function ensureBucket() {
  const supabase = createServiceClient();
  const existing = await supabase.storage.getBucket(EVIDENCE_BUCKET);
  if (!existing.error) return supabase;

  const created = await supabase.storage.createBucket(EVIDENCE_BUCKET, {
    public: false,
    fileSizeLimit: MAX_PAPER_BYTES,
    allowedMimeTypes: [...ALLOWED_PAPER_MIME, "text/html"],
  });
  if (created.error && !/already exists/i.test(created.error.message)) {
    throw created.error;
  }
  return supabase;
}

/**
 * Upload bytes to the evidence bucket. Refuses overwrite so a malicious or
 * accidental re-POST cannot replace the original file silently; callers
 * that need to attach a corrected scan should write a new declaration row
 * and revoke the old one (paper trail intact).
 */
export async function uploadEvidence(opts: {
  churchId: string;
  declarationId: string;
  bytes: Uint8Array | Buffer;
  mimeType: string;
}): Promise<{
  path: string;
  bucket: string;
  sha256: string;
  size: number;
  mime: string;
}> {
  const sha = sha256Hex(opts.bytes);
  const ext = extensionForMime(opts.mimeType);
  const path = buildEvidencePath({
    churchId: opts.churchId,
    declarationId: opts.declarationId,
    sha256Hex: sha,
    extension: ext,
  });
  const supabase = await ensureBucket();
  const { error } = await supabase.storage
    .from(EVIDENCE_BUCKET)
    .upload(path, opts.bytes, {
      contentType: opts.mimeType,
      upsert: false,
    });
  if (error) throw error;
  return {
    path,
    bucket: EVIDENCE_BUCKET,
    sha256: sha,
    size: opts.bytes.byteLength,
    mime: opts.mimeType,
  };
}

/**
 * Time-limited download link. Defaults to 5 minutes which is plenty for an
 * admin click-to-download or for an HMRC inspector previewing in the
 * browser. Long-lived URLs would defeat the access-control story.
 */
export async function createEvidenceDownloadUrl(opts: {
  bucket: string;
  path: string;
  expiresInSeconds?: number;
}): Promise<string> {
  const supabase = createServiceClient();
  const { data, error } = await supabase.storage
    .from(opts.bucket)
    .createSignedUrl(opts.path, opts.expiresInSeconds ?? 300);
  if (error) throw error;
  return data.signedUrl;
}

export type DigitalSignatureContext = {
  declarationId: string;
  donorName: string;
  donorEmail: string;
  donorAddressLine1: string | null;
  donorAddressLine2: string | null;
  donorCity: string | null;
  donorPostcode: string | null;
  donorCountry: string | null;
  declarationText: string;
  signedAtIso: string;
  ipAddress: string | null;
  userAgent: string | null;
  churchName: string;
  churchNumber: string | null;
  /** Charity reference, e.g. "GA-12345" or the gift aid pack's id. */
  charityReference: string | null;
  source: string;
};

/**
 * Deterministic, self-contained HTML representation of a digital
 * declaration. This is the file we hash and store, and it is what we
 * surface to Lester when he insists on something he can print. No external
 * fonts, no JS, no images: an auditor on a Chromebook in 2030 can still
 * open and print it.
 *
 * Critical: the output MUST be byte-stable for a given input so that
 * re-rendering from the persisted row produces the same hash. We avoid
 * `new Date()`, locale formatting, and any non-deterministic source.
 */
export function renderDigitalDeclarationHtml(
  ctx: DigitalSignatureContext,
): string {
  const safe = (value: string | null | undefined): string => {
    if (value === null || value === undefined) return "";
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  };
  const addressLines = [
    ctx.donorAddressLine1,
    ctx.donorAddressLine2,
    ctx.donorCity,
    ctx.donorPostcode,
    ctx.donorCountry,
  ]
    .filter((line) => line && line.trim())
    .map((line) => `<div>${safe(line)}</div>`) // one per row, deterministic order
    .join("");
  return [
    "<!doctype html>",
    "<html lang=\"en\">",
    "<head>",
    "<meta charset=\"utf-8\">",
    `<title>Gift Aid declaration ${safe(ctx.declarationId)}</title>`,
    "<style>",
    "body{font-family:Georgia,serif;color:#111;max-width:720px;margin:48px auto;line-height:1.5;padding:0 24px}",
    "h1{font-size:22px;margin:0 0 4px}",
    "h2{font-size:14px;text-transform:uppercase;letter-spacing:.08em;margin-top:32px}",
    ".block{border:1px solid #ccc;padding:16px;border-radius:4px;margin-top:8px}",
    ".meta{font-size:12px;color:#555}",
    ".meta div{margin:2px 0}",
    "footer{margin-top:48px;font-size:11px;color:#666;border-top:1px solid #ddd;padding-top:12px}",
    "</style>",
    "</head>",
    "<body>",
    `<h1>Gift Aid declaration</h1>`,
    `<div class=\"meta\">${safe(ctx.churchName)}${
      ctx.churchNumber ? ` No. ${safe(ctx.churchNumber)}` : ""
    }${
      ctx.charityReference ? ` &middot; HMRC ref ${safe(ctx.charityReference)}` : ""
    }</div>`,
    `<h2>Donor</h2>`,
    `<div class=\"block\">`,
    `<div><strong>${safe(ctx.donorName)}</strong></div>`,
    `<div>${safe(ctx.donorEmail)}</div>`,
    addressLines,
    `</div>`,
    `<h2>Declaration</h2>`,
    `<div class=\"block\">${safe(ctx.declarationText)}</div>`,
    `<h2>Electronic signature</h2>`,
    `<div class=\"block meta\">`,
    `<div>Declaration ID: ${safe(ctx.declarationId)}</div>`,
    `<div>Signed at (UTC): ${safe(ctx.signedAtIso)}</div>`,
    `<div>Source: ${safe(ctx.source)}</div>`,
    `<div>IP address: ${safe(ctx.ipAddress ?? "not recorded")}</div>`,
    `<div>User agent: ${safe(ctx.userAgent ?? "not recorded")}</div>`,
    `</div>`,
    `<footer>This document was generated by ChurchPay as a tamper-evident record of an electronic Gift Aid declaration. The SHA-256 of these bytes is recorded against the declaration row in the ChurchPay database; re-hashing this file should produce the same digest. To verify: <code>shasum -a 256 thisfile.html</code>.</footer>`,
    "</body></html>",
  ].join("\n");
}

/**
 * One-shot helper: render the digital declaration HTML, upload it, return
 * everything the caller needs to stamp on the declaration row.
 */
export async function persistDigitalEvidence(
  ctx: DigitalSignatureContext & { churchId: string },
): Promise<{
  path: string;
  bucket: string;
  sha256: string;
  size: number;
  mime: string;
}> {
  const html = renderDigitalDeclarationHtml(ctx);
  const bytes = Buffer.from(html, "utf8");
  return uploadEvidence({
    churchId: ctx.churchId,
    declarationId: ctx.declarationId,
    bytes,
    mimeType: "text/html",
  });
}

/** Convenience used by the take-payment paper-on-the-day capture. */
export function newDeclarationId(): string {
  return randomUUID();
}
