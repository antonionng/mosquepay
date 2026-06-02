#!/usr/bin/env node
// Seed Gift Aid demo data for a tenant lodge so the treasurer can play with
// meeting close + Gift Aid claim packs end-to-end.
//
// What it creates (against LODGE_SLUG, default: lodgepay-test-9999):
//
//   * Fills in the lodge's Gift Aid + Relief Chest config (reference, email).
//   * Ensures the private `gift-aid-evidence` Supabase Storage bucket exists.
//   * 30 demo members with realistic UK addresses.
//   * 30 declarations spread across three windows so consecutive claim packs
//     show different "new in window" counts:
//       - 22 historic paper declarations dated weeks before meeting #1
//       -  4 paper declarations collected on meeting #2 / meeting #3
//       -  3 digital declarations signed via the portal between meetings
//       -  1 revoked declaration (so the panel + pack manifest show it)
//   * Real evidence artefacts uploaded to Storage:
//       - paper  -> deterministic minimal PDF rendered in JS
//       - digital -> identical HTML to lib/gift-aid/evidence.ts so a
//                    re-render reproduces the same SHA-256 (the pack
//                    endpoint's defence-in-depth re-hash will pass).
//   * 5 past meetings + 1 future meeting. Each past meeting gets:
//       - 18 to 32 charitable donations (mix of cash, charge, online)
//       - 1 meeting_collection row
//       - 1 gift_aid_claim_batch with claim_reference LP-DEMO-MEET-<date>
//       - 1 claim item per donation with eligible_amount + reclaimable_amount
//       - declaration link rows for declarations newly in window
//       - meeting_closed_at + meeting_closed_by_email set
//
// Every demo entity is keyed off "DEMO-" / "demo-" / "demo+" so a re-run
// with --reset cleanly wipes and re-creates. Without --reset the script
// will refuse to run if demo data already exists.
//
// Usage:
//   node scripts/seed-gift-aid-demo.mjs           # fresh seed (errors if exists)
//   node scripts/seed-gift-aid-demo.mjs --reset   # wipe + reseed
//   LODGE_SLUG=other-lodge node scripts/seed-gift-aid-demo.mjs --reset

import { createClient } from "@supabase/supabase-js";
import { createHash, randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadDotEnv() {
  for (const file of [".env.local", ".env"]) {
    const path = resolve(process.cwd(), file);
    if (!existsSync(path)) continue;
    const content = readFileSync(path, "utf8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = value;
    }
  }
}

loadDotEnv();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const LODGE_SLUG = process.env.LODGE_SLUG ?? "lodgepay-test-9999";
const RESET = process.argv.includes("--reset");
const DEMO_REF_PREFIX = "LP-DEMO";
const DEMO_EMAIL_PREFIX = "demo+";
const DEMO_EMAIL_DOMAIN = "lodgepay-test.test";
const DEMO_PAYMENT_PREFIX = "LP-DEMO-PAY";
const DEMO_EVENT_SLUG_PREFIX = "demo-";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ---------------------------------------------------------------------------
// Static demo content
// ---------------------------------------------------------------------------

const HMRC_DECLARATION_TEXT_V1 =
  "I want to Gift Aid this donation and any donations I make in the future or have made in the past 4 years to the named charity. I am a UK taxpayer and understand that if I pay less Income Tax and/or Capital Gains Tax than the amount of Gift Aid claimed on all my donations in that tax year it is my responsibility to pay any difference.";

const EVIDENCE_BUCKET = "gift-aid-evidence";

const LODGE_CONFIG_PATCH = {
  gift_aid_default_mode: "both",
  hmrc_charity_reference: "GA-12345-LP",
  relief_chest_name: "LodgePay Test Lodge Relief Chest",
  relief_chest_email: "relief.chest+demo@example.org",
  relief_chest_charity_number: "1066327-LP",
};

// 30 donor profiles. Names and addresses are obviously synthetic to keep
// production data clean.
const MEMBERS = [
  { full_name: "W Bro Alistair Caine", address: "12 Cavendish Mews, Marylebone", city: "London", postcode: "W1G 8DT" },
  { full_name: "W Bro Bernard Holloway", address: "47 Brockley Road", city: "London", postcode: "SE4 2RA" },
  { full_name: "W Bro Cyril Pemberton", address: "9 Steyne Avenue, Hayling Island", city: "Hampshire", postcode: "PO11 0LS" },
  { full_name: "W Bro Derek Whitmore", address: "23 The Crescent, Twickenham", city: "London", postcode: "TW1 2DU" },
  { full_name: "W Bro Edward Fairbrother", address: "5 Old Park Lane, Mayfair", city: "London", postcode: "W1K 1QR" },
  { full_name: "Bro Felix Marston", address: "78 Acacia Avenue, Surbiton", city: "Surrey", postcode: "KT6 4NA" },
  { full_name: "Bro Gareth Llewellyn", address: "31 Penlan Drive, Mumbles", city: "Swansea", postcode: "SA3 4HS" },
  { full_name: "W Bro Harold Tindall", address: "6 St Augustine's Road, Camden", city: "London", postcode: "NW1 9RP" },
  { full_name: "W Bro Ivor Standish", address: "14 Manor Park, Chislehurst", city: "Kent", postcode: "BR7 5PR" },
  { full_name: "Bro Jasper Quincey", address: "62 Tudor Drive, Kingston upon Thames", city: "Surrey", postcode: "KT2 5QH" },
  { full_name: "W Bro Kenneth Ashworth", address: "8 Pavilion Court, Knightsbridge", city: "London", postcode: "SW1X 7HJ" },
  { full_name: "Bro Lawrence Drummond", address: "44 The Avenue, Beckenham", city: "Kent", postcode: "BR3 5EE" },
  { full_name: "W Bro Marcus Eldridge", address: "5 Mulberry Walk, Chelsea", city: "London", postcode: "SW3 6DT" },
  { full_name: "Bro Nathaniel Boswell", address: "17 Highfield Road, Edgware", city: "Middlesex", postcode: "HA8 5HE" },
  { full_name: "W Bro Oliver Pendlebury", address: "29 Park Crescent, Wimbledon", city: "London", postcode: "SW19 5DG" },
  { full_name: "Bro Percival Wainwright", address: "11 Glebe Lane, Barnes", city: "London", postcode: "SW13 0EX" },
  { full_name: "W Bro Quentin Sharrock", address: "3 The Old Vicarage, Petersfield", city: "Hampshire", postcode: "GU32 2BG" },
  { full_name: "Bro Roderick Mainwaring", address: "26 Brookside Close, Pinner", city: "Middlesex", postcode: "HA5 1RQ" },
  { full_name: "W Bro Stanley Calderwood", address: "55 Westbourne Terrace, Bayswater", city: "London", postcode: "W2 3UR" },
  { full_name: "Bro Tobias Renfield", address: "9 Linden Gardens, Notting Hill", city: "London", postcode: "W2 4HB" },
  { full_name: "W Bro Ulric Vainshtein", address: "18 Park Hill, Ealing", city: "London", postcode: "W5 2JT" },
  { full_name: "Bro Vincent Threadgold", address: "7 Beech Grove, Sevenoaks", city: "Kent", postcode: "TN13 2NQ" },
  { full_name: "W Bro Walter Bramhall", address: "21 Holland Park Avenue", city: "London", postcode: "W11 3RB" },
  { full_name: "Bro Xavier Lockhart", address: "12 Cumberland Place, Regent's Park", city: "London", postcode: "NW1 5LE" },
  { full_name: "W Bro Yardley Pickersgill", address: "4 Cathedral Close, Salisbury", city: "Wiltshire", postcode: "SP1 2EF" },
  { full_name: "Bro Zachary Greenhalgh", address: "33 Albany Road, Wandsworth", city: "London", postcode: "SW17 9AY" },
  { full_name: "W Bro Adrian Fortescue", address: "16 Royal Crescent, Bath", city: "Somerset", postcode: "BA1 2LR" },
  { full_name: "Bro Cedric Maybury", address: "8 Ashford Mews, Chiswick", city: "London", postcode: "W4 4DR" },
  { full_name: "W Bro Hubert Verity", address: "27 Stanhope Gardens, South Kensington", city: "London", postcode: "SW7 5QX" },
  { full_name: "W Bro Sebastian Quirk", address: "1 Old Square, Lincoln's Inn", city: "London", postcode: "WC2A 3UE" },
].map((m, i) => ({
  ...m,
  email: `${DEMO_EMAIL_PREFIX}mem${String(i + 1).padStart(2, "0")}@${DEMO_EMAIL_DOMAIN}`,
  // Constrained to the members_rank_check enum (EA, FC, MM, Master, PM).
  rank: i % 8 === 0 ? "PM" : i % 8 === 1 ? "Master" : i % 8 === 7 ? "EA" : i % 8 === 6 ? "FC" : "MM",
  country: "United Kingdom",
}));

// 5 past meetings (closed) + 1 upcoming. Dates are chosen so they straddle
// the boundaries of the declaration windows below.
const TODAY = new Date("2026-05-30T19:00:00+01:00");
function isoAt(date, hour = 18) {
  const d = new Date(date);
  d.setUTCHours(hour, 0, 0, 0);
  return d.toISOString();
}
const MEETINGS = [
  {
    title: "Regular Meeting (DEMO Sep 2025)",
    slug: `${DEMO_EVENT_SLUG_PREFIX}2025-09-16`,
    event_date: isoAt("2025-09-16"),
    event_type: "regular_meeting",
    description: "First regular meeting of the season. Almoner's appeal collection.",
    location: "Mark Masons' Hall",
    donations: 22,
    cashRatio: 0.45,
    closed: true,
    chargeAmounts: [10, 20, 25, 50],
  },
  {
    title: "Regular Meeting (DEMO Oct 2025)",
    slug: `${DEMO_EVENT_SLUG_PREFIX}2025-10-21`,
    event_date: isoAt("2025-10-21"),
    event_type: "regular_meeting",
    description: "Festive board with charity steward's appeal for the Provincial Grand Charity.",
    location: "Mark Masons' Hall",
    donations: 18,
    cashRatio: 0.55,
    closed: true,
    chargeAmounts: [5, 10, 20, 30, 50],
  },
  {
    title: "Installation Meeting (DEMO Dec 2025)",
    slug: `${DEMO_EVENT_SLUG_PREFIX}2025-12-11`,
    event_date: isoAt("2025-12-11"),
    event_type: "installation",
    description: "Installation of W Bro Sebastian Quirk. Substantial attendance, larger collection.",
    location: "Mark Masons' Hall",
    donations: 32,
    cashRatio: 0.35,
    closed: true,
    chargeAmounts: [10, 25, 50, 100, 250],
  },
  {
    title: "Regular Meeting (DEMO Feb 2026)",
    slug: `${DEMO_EVENT_SLUG_PREFIX}2026-02-17`,
    event_date: isoAt("2026-02-17"),
    event_type: "regular_meeting",
    description: "Quiet meeting, smaller alms collection.",
    location: "Mark Masons' Hall",
    donations: 14,
    cashRatio: 0.50,
    closed: true,
    chargeAmounts: [5, 10, 20],
  },
  {
    title: "Regular Meeting (DEMO Apr 2026)",
    slug: `${DEMO_EVENT_SLUG_PREFIX}2026-04-21`,
    event_date: isoAt("2026-04-21"),
    event_type: "regular_meeting",
    description: "Spring meeting with RMBI appeal and a top-up donation for the Master's List.",
    location: "Mark Masons' Hall",
    donations: 26,
    cashRatio: 0.40,
    closed: true,
    chargeAmounts: [10, 20, 50, 100],
  },
  {
    title: "Regular Meeting (DEMO Jun 2026)",
    slug: `${DEMO_EVENT_SLUG_PREFIX}2026-06-16`,
    event_date: isoAt("2026-06-16"),
    event_type: "regular_meeting",
    description: "Upcoming meeting -- not yet closed, no donations yet.",
    location: "Mark Masons' Hall",
    donations: 0,
    cashRatio: 0,
    closed: false,
    chargeAmounts: [],
  },
];

// Declaration scheduling. Each entry is { memberIndex, source, signedAtIso,
// revoked? }. They are filed in order; "new in window" sweep is computed per
// claim batch using each declaration's created_at vs the previous claim
// batch's created_at.
const DECLARATIONS = [
  // 22 historic paper declarations filed in the lead-up to meeting #1.
  ...Array.from({ length: 22 }, (_, i) => ({
    memberIndex: i,
    source: "paper",
    signedAt: `2025-08-${String(10 + (i % 18) + 1).padStart(2, "0")}T12:00:00Z`,
  })),
  // 3 paper declarations collected on the day at meeting #2 (Oct).
  { memberIndex: 22, source: "paper", signedAt: "2025-10-21T19:30:00Z" },
  { memberIndex: 23, source: "paper", signedAt: "2025-10-21T19:35:00Z" },
  { memberIndex: 24, source: "paper", signedAt: "2025-10-21T19:40:00Z" },
  // 1 paper collected on the day at meeting #3 (Dec).
  { memberIndex: 25, source: "paper", signedAt: "2025-12-11T19:45:00Z" },
  // 3 digital declarations signed via the portal between meetings.
  { memberIndex: 26, source: "digital", signedAt: "2026-01-08T20:14:00Z" },
  { memberIndex: 27, source: "digital", signedAt: "2026-03-02T08:55:00Z" },
  { memberIndex: 28, source: "digital", signedAt: "2026-04-10T13:22:00Z" },
  // 1 revoked declaration -- created early but revoked before meeting #5.
  { memberIndex: 29, source: "paper", signedAt: "2025-08-04T10:00:00Z", revokedAt: "2026-04-15T09:00:00Z", revokedReason: "Member ceased to be a UK taxpayer." },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function log(...args) {
  console.log(...args);
}

function sha256Hex(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function pickFrom(arr, seed) {
  // Deterministic pick using seed string.
  const h = createHash("md5").update(seed).digest();
  return arr[h[0] % arr.length];
}

function escapePdfText(text) {
  return String(text)
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function wrapText(text, width) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = "";
  for (const w of words) {
    if ((line + " " + w).trim().length > width) {
      if (line) lines.push(line);
      line = w;
    } else {
      line = (line ? line + " " : "") + w;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * Minimal but valid PDF representing a "scanned" wet-ink Gift Aid slip.
 * Renders the declaration text + donor details + signature line so the
 * file is genuinely useful as evidence. Helvetica is a PDF base font so
 * no embedded font data is required.
 */
function buildPaperScanPdf({ donor, address, dateSigned, signatureName, charityRef, lodgeName }) {
  const lines = [
    "GIFT AID DECLARATION (scanned wet-ink original)",
    "",
    `Charity: ${lodgeName}`,
    `HMRC reference: ${charityRef}`,
    "",
    "Donor:",
    `  ${donor}`,
    ...(address ? address.split("\n").map((l) => `  ${l}`) : []),
    "",
    "Declaration text:",
    ...wrapText(HMRC_DECLARATION_TEXT_V1, 75).map((l) => `  ${l}`),
    "",
    `Signed: ${signatureName}`,
    `Date:   ${dateSigned}`,
    "",
    "  [ Wet-ink signature scan reproduction -- demo evidence file ]",
    "",
    "This file was generated by the LodgePay demo seeder to represent",
    "a scanned paper Gift Aid declaration. In production this would be",
    "the actual upload (PDF or image of the signed slip).",
  ];
  const contentStream = [
    "BT",
    "/F1 11 Tf",
    "72 740 Td",
    "14 TL",
    ...lines.map((l) => `(${escapePdfText(l)}) Tj T*`),
    "ET",
  ].join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(contentStream, "latin1")} >>\nstream\n${contentStream}\nendstream`,
  ];
  let body = "%PDF-1.4\n%\xff\xff\xff\xff\n";
  const offsets = [];
  for (let i = 0; i < objects.length; i++) {
    offsets.push(Buffer.byteLength(body, "latin1"));
    body += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xrefStart = Buffer.byteLength(body, "latin1");
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) {
    body += String(off).padStart(10, "0") + " 00000 n \n";
  }
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  return Buffer.from(body, "latin1");
}

/**
 * MUST byte-match lib/gift-aid/evidence.ts:renderDigitalDeclarationHtml so
 * the SHA-256 we store matches what the production code would compute when
 * re-rendering from the row. If you change one, change the other.
 */
function renderDigitalDeclarationHtml(ctx) {
  const safe = (value) => {
    if (value === null || value === undefined) return "";
    return String(value)
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
    .filter((line) => line && String(line).trim())
    .map((line) => `<div>${safe(line)}</div>`)
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
    `<div class=\"meta\">${safe(ctx.lodgeName)}${
      ctx.lodgeNumber ? ` No. ${safe(ctx.lodgeNumber)}` : ""
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
    `<footer>This document was generated by LodgePay as a tamper-evident record of an electronic Gift Aid declaration. The SHA-256 of these bytes is recorded against the declaration row in the LodgePay database; re-hashing this file should produce the same digest. To verify: <code>shasum -a 256 thisfile.html</code>.</footer>`,
    "</body></html>",
  ].join("\n");
}

async function ensureBucket() {
  const existing = await supabase.storage.getBucket(EVIDENCE_BUCKET);
  if (!existing.error) return;
  const { error } = await supabase.storage.createBucket(EVIDENCE_BUCKET, {
    public: false,
    fileSizeLimit: 12 * 1024 * 1024,
    allowedMimeTypes: [
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/heic",
      "image/heif",
      "text/html",
    ],
  });
  if (error && !/already exists/i.test(error.message)) throw error;
  log(`  Created storage bucket "${EVIDENCE_BUCKET}".`);
}

function buildEvidencePath({ lodgeId, declarationId, sha256, extension }) {
  const ext = extension.replace(/^\.+/, "").toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
  return `${lodgeId}/${declarationId}/${declarationId}__${sha256.slice(0, 8)}.${ext}`;
}

async function uploadEvidenceFile({ lodgeId, declarationId, bytes, mime, extension }) {
  const sha = sha256Hex(bytes);
  const path = buildEvidencePath({ lodgeId, declarationId, sha256: sha, extension });
  const { error } = await supabase.storage
    .from(EVIDENCE_BUCKET)
    .upload(path, bytes, { contentType: mime, upsert: true });
  if (error) throw error;
  return {
    path,
    bucket: EVIDENCE_BUCKET,
    sha256: sha,
    size: bytes.byteLength,
    mime,
  };
}

function fmtDateIso(iso) {
  return new Date(iso).toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Reset
// ---------------------------------------------------------------------------

async function resetDemoData(lodgeId) {
  log("Resetting existing demo data via _demo_reset_gift_aid_data RPC...");
  // The RPC bypasses the gift_aid_declaration_events append-only trigger
  // (which would otherwise block deletion of demo declarations) and deletes
  // everything in the right FK order. Defined in
  // supabase/migrations/061_demo_reset_gift_aid_function.sql.
  const { error } = await supabase.rpc("_demo_reset_gift_aid_data", {
    p_lodge_id: lodgeId,
  });
  if (error) {
    throw new Error(
      `Failed to reset demo data: ${error.message}. ` +
        "Has migration 061_demo_reset_gift_aid_function.sql been applied?",
    );
  }
  log("  Reset complete.");
}

async function detectExistingDemo(lodgeId) {
  const { data } = await supabase
    .from("gift_aid_claim_batches")
    .select("id")
    .eq("lodge_id", lodgeId)
    .like("claim_reference", `${DEMO_REF_PREFIX}-MEET-%`)
    .limit(1);
  return (data ?? []).length > 0;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  log(`Resolving lodge "${LODGE_SLUG}"...`);
  const { data: lodge, error: lodgeErr } = await supabase
    .from("lodges")
    .select("id, name, lodge_number")
    .eq("slug", LODGE_SLUG)
    .maybeSingle();
  if (lodgeErr) throw lodgeErr;
  if (!lodge) throw new Error(`Lodge ${LODGE_SLUG} not found.`);
  log(`  Lodge: ${lodge.name} (${lodge.id})`);

  if (await detectExistingDemo(lodge.id)) {
    if (!RESET) {
      console.error(
        "Demo data already exists for this lodge. Re-run with --reset to wipe and reseed."
      );
      process.exit(2);
    }
    await resetDemoData(lodge.id);
  }

  log("Updating lodge Gift Aid + Relief Chest config...");
  const { error: lodgeUpdErr } = await supabase
    .from("lodges")
    .update({ ...LODGE_CONFIG_PATCH, updated_at: new Date().toISOString() })
    .eq("id", lodge.id);
  if (lodgeUpdErr) throw lodgeUpdErr;

  await ensureBucket();

  // --- Members ----------------------------------------------------------
  log(`Inserting ${MEMBERS.length} demo members...`);
  const memberRows = MEMBERS.map((m) => ({
    lodge_id: lodge.id,
    email: m.email,
    full_name: m.full_name,
    rank: m.rank,
    address_line_1: m.address,
    city: m.city,
    postcode: m.postcode,
    country: m.country,
    membership_status: "active",
    show_on_website: false,
    gift_aid_consent_status: "unknown",
  }));
  const { data: insertedMembers, error: memErr } = await supabase
    .from("members")
    .upsert(memberRows, { onConflict: "lodge_id,email" })
    .select("id, email");
  if (memErr) throw memErr;
  const memberByEmail = new Map(insertedMembers.map((m) => [m.email, m]));
  log(`  Members ready: ${insertedMembers.length}`);

  // --- Events -----------------------------------------------------------
  log(`Inserting ${MEETINGS.length} meetings...`);
  const eventByMeeting = new Map();
  for (const meeting of MEETINGS) {
    const { data, error } = await supabase
      .from("events")
      .insert({
        lodge_id: lodge.id,
        title: meeting.title,
        slug: meeting.slug,
        description: meeting.description,
        event_type: meeting.event_type,
        event_date: meeting.event_date,
        location: meeting.location,
        enable_rsvp: true,
        enable_payments: meeting.donations > 0,
        enable_charity_donation: meeting.donations > 0,
        enable_raffle_donation: false,
        enable_dining_rsvp: false,
        enable_guest_tickets: false,
        enable_meeting_fee: false,
      })
      .select("id")
      .single();
    if (error) throw error;
    eventByMeeting.set(meeting.slug, data.id);
  }
  log(`  Events created: ${eventByMeeting.size}`);

  // --- Declarations ----------------------------------------------------
  log(`Filing ${DECLARATIONS.length} Gift Aid declarations + evidence...`);
  const declRecords = []; // { id, memberEmail, member, signedAt, revokedAt, source, eligible }
  for (let i = 0; i < DECLARATIONS.length; i++) {
    const d = DECLARATIONS[i];
    const member = MEMBERS[d.memberIndex];
    const memberRow = memberByEmail.get(member.email);
    if (!memberRow) throw new Error(`Member not found for ${member.email}`);
    const declarationId = randomUUID();
    const filingRef = `${DEMO_REF_PREFIX}-DECL-${String(i + 1).padStart(3, "0")}`;

    let evidence;
    if (d.source === "paper") {
      const pdf = buildPaperScanPdf({
        donor: member.full_name,
        address: `${member.address}\n${member.city}\n${member.postcode}\n${member.country}`,
        dateSigned: fmtDateIso(d.signedAt),
        signatureName: member.full_name,
        charityRef: LODGE_CONFIG_PATCH.hmrc_charity_reference,
        lodgeName: lodge.name,
      });
      evidence = await uploadEvidenceFile({
        lodgeId: lodge.id,
        declarationId,
        bytes: pdf,
        mime: "application/pdf",
        extension: "pdf",
      });
    } else {
      const html = renderDigitalDeclarationHtml({
        declarationId,
        donorName: member.full_name,
        donorEmail: member.email,
        donorAddressLine1: member.address,
        donorAddressLine2: null,
        donorCity: member.city,
        donorPostcode: member.postcode,
        donorCountry: member.country,
        declarationText: HMRC_DECLARATION_TEXT_V1,
        signedAtIso: d.signedAt,
        ipAddress: "203.0.113.42",
        userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605 LP-Demo",
        lodgeName: lodge.name,
        lodgeNumber: lodge.lodge_number ?? null,
        charityReference: LODGE_CONFIG_PATCH.hmrc_charity_reference,
        source: "member_portal",
      });
      evidence = await uploadEvidenceFile({
        lodgeId: lodge.id,
        declarationId,
        bytes: Buffer.from(html, "utf8"),
        mime: "text/html",
        extension: "html",
      });
    }

    const isDigital = d.source === "digital";
    const { error: declErr } = await supabase
      .from("gift_aid_declarations")
      .insert({
        id: declarationId,
        lodge_id: lodge.id,
        member_id: memberRow.id,
        donor_name: member.full_name,
        donor_email: member.email,
        donor_address_line_1: member.address,
        donor_city: member.city,
        donor_postcode: member.postcode,
        donor_country: member.country,
        declaration_text: HMRC_DECLARATION_TEXT_V1,
        declaration_confirmed: true,
        confirmation_method: isDigital ? "checkout_checkbox" : "paper_signature",
        hmrc_eligible: true,
        declaration_source: isDigital ? "member_portal" : "paper_upload",
        retained_until: "2032-12-31",
        evidence_source: isDigital ? "digital" : "paper",
        evidence_storage_bucket: evidence.bucket,
        evidence_storage_path: evidence.path,
        evidence_sha256: evidence.sha256,
        evidence_size_bytes: evidence.size,
        evidence_mime_type: evidence.mime,
        evidence_uploaded_at: d.signedAt,
        evidence_uploaded_by_email: isDigital ? member.email : "treasurer+demo@lodgepay-test.test",
        paper_received_date: isDigital ? null : fmtDateIso(d.signedAt),
        paper_filing_reference: filingRef,
        digital_signature_ip: isDigital ? "203.0.113.42" : null,
        digital_signature_user_agent: isDigital
          ? "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605 LP-Demo"
          : null,
        digital_declaration_text_snapshot: isDigital ? HMRC_DECLARATION_TEXT_V1 : null,
        revoked_at: d.revokedAt ?? null,
        revoked_reason: d.revokedReason ?? null,
        created_at: d.signedAt,
        updated_at: d.revokedAt ?? d.signedAt,
      });
    if (declErr) throw declErr;

    // Audit events: created + (revoked if applicable)
    const eventsToInsert = [
      {
        lodge_id: lodge.id,
        declaration_id: declarationId,
        event_type: isDigital ? "created_digital" : "created_paper",
        actor_kind: isDigital ? "member" : "admin",
        actor_email: isDigital ? member.email : "treasurer+demo@lodgepay-test.test",
        after_state: {
          source: isDigital ? "member_portal" : "paper_upload",
          evidence_sha256: evidence.sha256,
        },
        evidence_sha256: evidence.sha256,
        notes: isDigital
          ? "Member signed via the portal Gift Aid onboarding flow (demo seed)."
          : `Paper slip received and scanned, filing ref ${filingRef} (demo seed).`,
        created_at: d.signedAt,
      },
    ];
    if (d.revokedAt) {
      eventsToInsert.push({
        lodge_id: lodge.id,
        declaration_id: declarationId,
        event_type: "revoked",
        actor_kind: "admin",
        actor_email: "treasurer+demo@lodgepay-test.test",
        notes: d.revokedReason,
        created_at: d.revokedAt,
      });
    }
    const { error: evtErr } = await supabase
      .from("gift_aid_declaration_events")
      .insert(eventsToInsert);
    if (evtErr) throw evtErr;

    // Update member consent status to active.
    // members.gift_aid_consent_status enum: unknown | declared | declined
    if (!d.revokedAt) {
      await supabase
        .from("members")
        .update({
          gift_aid_consent_status: "declared",
          gift_aid_prompted_at: d.signedAt,
          updated_at: d.signedAt,
        })
        .eq("id", memberRow.id);
    } else {
      await supabase
        .from("members")
        .update({
          gift_aid_consent_status: "declined",
          gift_aid_prompted_at: d.signedAt,
          updated_at: d.revokedAt,
        })
        .eq("id", memberRow.id);
    }

    declRecords.push({
      id: declarationId,
      memberEmail: member.email,
      member,
      signedAt: d.signedAt,
      revokedAt: d.revokedAt ?? null,
      source: d.source,
    });
  }
  log(`  Declarations + evidence: ${declRecords.length}`);

  // --- Donations + meeting close per past meeting ----------------------
  log("Generating donations, meeting collections, claim batches per meeting...");
  // Sort meetings chronologically so each subsequent claim batch's "new in
  // window" sweep is anchored to the previous batch's created_at.
  const sortedClosed = MEETINGS.filter((m) => m.closed).slice().sort(
    (a, b) => new Date(a.event_date) - new Date(b.event_date),
  );

  let previousBatchCreatedAt = null;
  let cumulativeDonationCount = 0;
  let cumulativeReclaim = 0;
  for (let mi = 0; mi < sortedClosed.length; mi++) {
    const meeting = sortedClosed[mi];
    const eventId = eventByMeeting.get(meeting.slug);
    const meetingDate = fmtDateIso(meeting.event_date);

    // Pick donors deterministically per meeting. Use members whose
    // declaration was filed BEFORE the meeting (active or not yet revoked)
    // for the "Gift Aid eligible" subset; mix in some without to make the
    // breakdown realistic.
    const declarationsByEmail = new Map();
    for (const decl of declRecords) {
      const declCreated = new Date(decl.signedAt);
      const revoked = decl.revokedAt ? new Date(decl.revokedAt) : null;
      const declUsable =
        declCreated <= new Date(meeting.event_date) &&
        (!revoked || revoked > new Date(meeting.event_date));
      if (declUsable) declarationsByEmail.set(decl.memberEmail, decl);
    }

    // Donor pool: 70% donors with declaration, 30% without.
    const donorsWithDecl = [...declarationsByEmail.keys()];
    const donorsWithoutDecl = MEMBERS.map((m) => m.email).filter(
      (e) => !declarationsByEmail.has(e),
    );

    const donationsToMake = meeting.donations;
    const donations = [];
    for (let i = 0; i < donationsToMake; i++) {
      // Deterministic ratio
      const useDecl = (i * 31) % 10 < 7 && donorsWithDecl.length > 0;
      const pool = useDecl ? donorsWithDecl : (donorsWithoutDecl.length ? donorsWithoutDecl : donorsWithDecl);
      const donorEmail = pool[(i * 17 + mi * 7) % pool.length];
      const donor = MEMBERS.find((m) => m.email === donorEmail);
      const memberRow = memberByEmail.get(donorEmail);
      const isCash = ((i * 13 + mi) % 100) / 100 < meeting.cashRatio;
      const amount = pickFrom(meeting.chargeAmounts, `${meeting.slug}-${i}`);
      const decl = declarationsByEmail.get(donorEmail) ?? null;
      const giftAidEligibleAmount = decl ? amount : null;
      donations.push({
        donorEmail,
        donorName: donor.full_name,
        memberId: memberRow.id,
        amount,
        isCash,
        declId: decl?.id ?? null,
        eligibleAmount: giftAidEligibleAmount,
      });
    }

    // Insert payment per donation (mixture of cash and charge).
    log(`  ${meeting.title}: ${donations.length} donations`);
    const payments = [];
    for (let i = 0; i < donations.length; i++) {
      const d = donations[i];
      const paymentMethod = d.isCash ? "cash" : "card_qr";
      const mooovId = `${DEMO_PAYMENT_PREFIX}-${meeting.slug}-${String(i + 1).padStart(3, "0")}`;
      const completedAt = new Date(meeting.event_date);
      completedAt.setUTCMinutes(i % 60);
      const { data: payRow, error: payErr } = await supabase
        .from("payments")
        .insert({
          lodge_id: lodge.id,
          event_id: eventId,
          user_email: d.donorEmail,
          user_name: d.donorName,
          charity_amount: d.amount,
          dining_amount: 0,
          raffle_amount: 0,
          meeting_fee_amount: 0,
          guest_ticket_amount: 0,
          total_amount: d.amount,
          currency: "GBP",
          charity_name: "Lodge Charity Appeal",
          status: "succeeded",
          mooov_payment_id: mooovId,
          payment_method: paymentMethod,
          recorded_by_email: "treasurer+demo@lodgepay-test.test",
          created_at: completedAt.toISOString(),
          completed_at: completedAt.toISOString(),
          updated_at: completedAt.toISOString(),
        })
        .select("id")
        .single();
      if (payErr) throw payErr;
      payments.push({ ...d, paymentId: payRow.id, completedAt: completedAt.toISOString() });
    }

    // Insert donation rows.
    const donationRows = payments.map((d) => ({
      lodge_id: lodge.id,
      event_id: eventId,
      payment_id: d.paymentId,
      donor_name: d.donorName,
      donor_email: d.donorEmail,
      amount: d.amount,
      currency: "GBP",
      source: "event",
      status: "succeeded",
      gift_aid_declaration_id: d.declId,
      gift_aid_status: d.declId ? "eligible" : "unknown",
      gift_aid_eligible_amount: d.declId ? d.amount : null,
      gasds_eligible: !d.declId && d.isCash && d.amount <= 30,
      created_at: d.completedAt,
    }));
    const { data: insertedDons, error: donErr } = await supabase
      .from("donations")
      .insert(donationRows)
      .select("id, donor_email, gift_aid_declaration_id, gift_aid_eligible_amount, amount, created_at");
    if (donErr) throw donErr;

    // Meeting collection summary.
    const cashAmt = payments.filter((p) => p.isCash).reduce((s, p) => s + p.amount, 0);
    const cardAmt = payments.filter((p) => !p.isCash).reduce((s, p) => s + p.amount, 0);
    const donorLinkedAmt = payments.filter((p) => p.declId).reduce((s, p) => s + p.amount, 0);
    const anonAmt = payments.filter((p) => !p.declId && p.isCash).reduce((s, p) => s + p.amount, 0);
    const giftAidReclaim = +(donorLinkedAmt * 0.25).toFixed(2);
    const gasdsCap = 8000;
    const gasdsEligibleAmt = Math.min(anonAmt, gasdsCap);

    const closedAt = new Date(meeting.event_date);
    closedAt.setUTCHours(22, 0, 0, 0);

    // Claim batch -- create with created_at = closedAt so subsequent batches
    // can compute "declarations newly in window since previous batch" using
    // (previousBatchCreatedAt, closedAt].
    const claimRef = `${DEMO_REF_PREFIX}-MEET-${meetingDate}`;
    const periodStart = previousBatchCreatedAt
      ? fmtDateIso(previousBatchCreatedAt)
      : fmtDateIso(new Date(meeting.event_date).setUTCDate(new Date(meeting.event_date).getUTCDate() - 90));
    const { data: batch, error: batchErr } = await supabase
      .from("gift_aid_claim_batches")
      .insert({
        lodge_id: lodge.id,
        claim_reference: claimRef,
        period_start: periodStart,
        period_end: meetingDate,
        status: "draft",
        donation_count: donations.length,
        eligible_amount: donorLinkedAmt,
        reclaimable_amount: giftAidReclaim,
        notes: `Per-meeting Gift Aid pack for ${meeting.title} (demo seed).`,
        created_by_email: "treasurer+demo@lodgepay-test.test",
        created_at: closedAt.toISOString(),
        updated_at: closedAt.toISOString(),
      })
      .select("id, created_at")
      .single();
    if (batchErr) throw batchErr;

    // Claim items -- one per donation that is Gift Aid eligible.
    const claimItemRows = insertedDons
      .filter((d) => d.gift_aid_declaration_id)
      .map((d) => ({
        lodge_id: lodge.id,
        claim_batch_id: batch.id,
        donation_id: d.id,
        gift_aid_declaration_id: d.gift_aid_declaration_id,
        donor_name: payments.find((p) => p.donorEmail === d.donor_email)?.donorName ?? d.donor_email,
        donor_email: d.donor_email,
        donation_date: fmtDateIso(d.created_at),
        source: "event",
        eligible_amount: d.gift_aid_eligible_amount ?? d.amount,
        reclaimable_amount: +(((d.gift_aid_eligible_amount ?? d.amount) * 0.25).toFixed(2)),
      }));
    if (claimItemRows.length) {
      const { error: itemErr } = await supabase.from("gift_aid_claim_items").insert(claimItemRows);
      if (itemErr) throw itemErr;
    }

    // "New in window" declarations since the previous batch.
    const windowStart = previousBatchCreatedAt;
    const windowEnd = closedAt;
    const newDeclsInWindow = declRecords.filter((decl) => {
      const ts = new Date(decl.signedAt);
      if (windowStart && ts <= new Date(windowStart)) return false;
      return ts <= windowEnd;
    });
    const newDeclIdSet = new Set(newDeclsInWindow.map((d) => d.id));

    // donor_in_batch: declarations backing a donation in this batch that
    // were NOT new in this window (i.e. signed before the previous batch).
    // Mirrors resolveDeclarationsForBatch so the demo packs surface the
    // previously-supplied-declarations/ folder exactly like production.
    const donorInBatchIds = [
      ...new Set(
        insertedDons
          .map((d) => d.gift_aid_declaration_id)
          .filter((id) => id && !newDeclIdSet.has(id)),
      ),
    ];

    const claimDeclRows = [
      ...newDeclsInWindow.map((decl) => ({
        lodge_id: lodge.id,
        claim_batch_id: batch.id,
        gift_aid_declaration_id: decl.id,
        inclusion_reason: "new_in_window",
        created_at: closedAt.toISOString(),
      })),
      ...donorInBatchIds.map((id) => ({
        lodge_id: lodge.id,
        claim_batch_id: batch.id,
        gift_aid_declaration_id: id,
        inclusion_reason: "donor_in_batch",
        created_at: closedAt.toISOString(),
      })),
    ];
    if (claimDeclRows.length) {
      const { error: cdErr } = await supabase
        .from("gift_aid_claim_declarations")
        .insert(claimDeclRows);
      if (cdErr) throw cdErr;
    }
    // declarations_count tracks NEW declarations only (what UGLE retains
    // this cycle); previously-supplied ones aren't counted here.
    await supabase
      .from("gift_aid_claim_batches")
      .update({ declarations_count: newDeclsInWindow.length })
      .eq("id", batch.id);

    // Update donations to point at this batch.
    if (insertedDons.some((d) => d.gift_aid_declaration_id)) {
      const giftAidIds = insertedDons.filter((d) => d.gift_aid_declaration_id).map((d) => d.id);
      await supabase
        .from("donations")
        .update({ gift_aid_claim_batch_id: batch.id, gift_aid_claimed_at: closedAt.toISOString() })
        .in("id", giftAidIds);
    }
    const gasdsIds = insertedDons
      .filter((d) => !d.gift_aid_declaration_id)
      .map((d) => d.id);
    if (gasdsIds.length && anonAmt > 0) {
      await supabase
        .from("donations")
        .update({ gasds_claimed_at: closedAt.toISOString() })
        .in("id", gasdsIds);
    }

    // Meeting collection row pointing at the claim batch.
    const { error: collErr } = await supabase.from("meeting_collections").insert({
      lodge_id: lodge.id,
      event_id: eventId,
      collection_date: meetingDate,
      collection_type: meeting.event_type === "installation" ? "installation" : "festive_board",
      title: `${meeting.title} -- alms collection`,
      cash_amount: cashAmt,
      card_amount: cardAmt,
      donor_linked_amount: donorLinkedAmt,
      anonymous_cash_amount: anonAmt,
      gift_aid_reclaimable_amount: giftAidReclaim,
      gasds_eligible_amount: gasdsEligibleAmt,
      gasds_tax_year: meetingDate >= "2026-04-06" ? "2026-27" : "2025-26",
      notes: `Auto-generated by demo seed. Donations: ${donations.length}. Cash: \u00a3${cashAmt.toFixed(2)}, Card: \u00a3${cardAmt.toFixed(2)}.`,
      recorded_by_email: "treasurer+demo@lodgepay-test.test",
      gift_aid_claim_batch_id: batch.id,
      created_at: closedAt.toISOString(),
      updated_at: closedAt.toISOString(),
    });
    if (collErr) throw collErr;

    // Close the event.
    await supabase
      .from("events")
      .update({
        meeting_closed_at: closedAt.toISOString(),
        meeting_closed_by_email: "treasurer+demo@lodgepay-test.test",
        meeting_close_notes: `Meeting closed via demo seeder. ${donations.length} donations, \u00a3${giftAidReclaim.toFixed(2)} reclaimable.`,
      })
      .eq("id", eventId);

    cumulativeDonationCount += donations.length;
    cumulativeReclaim += giftAidReclaim;
    previousBatchCreatedAt = batch.created_at;
  }

  log("");
  log("Done.");
  log(`  Total donations: ${cumulativeDonationCount}`);
  log(`  Total reclaimable Gift Aid across batches: \u00a3${cumulativeReclaim.toFixed(2)}`);
  log("");
  log("Try it:");
  log(`  http://localhost:3000/admin/meetings           # closed meetings show pack badges`);
  log(`  http://localhost:3000/admin/gift-aid           # claim batches list + pack downloads`);
  log(`  http://localhost:3000/admin/members            # 'Missing Gift Aid' filter populated`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
