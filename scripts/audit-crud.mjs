#!/usr/bin/env node
/**
 * audit-crud.mjs
 *
 * Walks app/api/**\/route.ts and reports resources that expose create (POST on
 * a collection route) without a matching delete (DELETE on the sibling [id]
 * route), or without a matching update (PATCH/PUT).
 *
 * Heuristic, not a parser: we look for top-level `export async function GET|...`
 * declarations in each route.ts. Resources we know are not full CRUD by design
 * (auth, webhooks, cron, exports, etc.) are filtered via SKIP_PATTERNS so the
 * report stays signal-only.
 *
 * Per-route opt-out: drop one of these magic comments anywhere in the route
 * file to silence that specific gap (the route itself documents the choice).
 *
 *   // crud-audit:ignore         -> skip the whole resource
 *   // crud-audit:ignore-update  -> resource has no UPDATE by design
 *   // crud-audit:ignore-delete  -> resource has no DELETE by design
 *
 * Usage:  node scripts/audit-crud.mjs              (table report)
 *         node scripts/audit-crud.mjs --json       (machine-readable)
 *         node scripts/audit-crud.mjs --strict     (exit 1 if any gaps)
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = join(fileURLToPath(import.meta.url), "..", "..");
const API_ROOT = join(REPO_ROOT, "app", "api");

const METHOD_RE =
  /^\s*export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE)\s*\(/m;
const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];

/**
 * Path fragments we skip because they are not CRUD resources in the standard
 * sense. Authentication, webhook receivers, file exports, cron triggers, AI
 * one-shot endpoints, bulk operations, and similar belong here.
 */
const SKIP_PATTERNS = [
  /^app\/api\/auth\//,
  /^app\/api\/cron\//,
  /^app\/api\/mooov-webhooks\//,
  /^app\/api\/payments\/webhook/,
  /^app\/api\/payments\/create-checkout-session/,
  /^app\/api\/ai\//,
  /^app\/api\/jobs\/process/,
  /^app\/api\/oauth\//,
  /^app\/api\/admin\/exports\//,
  /\/calendar\//,
  /\/annual-returns\.csv\//,
  /\/sample-data\//,
  /\/lodge-context\//,
  /\/website-readiness\//,
  /\/ledger\//,
  /\/data-retention\//,
  /\/operator\/stats/,
  /\/profile\/route\.ts$/,
  /\/feature-flags\//,
  /\/billing\//,
  /\/domain\//,
  /\/dues\/start/,
  /\/dues\/pay/,
  /\/dues\/reminders/,
  /\/dues\/bulk-run/,
  /\/bank\/imports/,
  /\/summons\/[^/]+\/send/,
  /\/leads\/[^/]+\/convert/,
  /\/members\/[^/]+\/(sar|invite|archive|consents)/,
  /\/lodges\/[^/]+\/(site|ai-draft)/,
  /\/provinces\/[^/]+\/(annual-returns\.csv|lodges\/bulk)/,
  /\/gift-aid\/claims/,
  /\/gasds\/claims/,
  /\/mentor\/assignments\/[^/]+\/contacts/,
  /\/welfare\/cases\/[^/]+\/visits/,
  /\/integrations\//,
  /\/templates\/marketplace/,
  /\/communications\/(newsletters|automations)/,
  /\/site-assets\//,
  /\/lodges\/current\//,
  /\/dues\/route\.ts$/,
  /\/admin\/staff\/route\.ts$/,
  /\/admin\/platform\/admins\/route\.ts$/,
  /\/admin\/platform\/lodges\/route\.ts$/,
  /\/contact\/route\.ts$/,
  /\/demo-requests\/route\.ts$/,
];

function shouldSkip(routeRelPath) {
  const posix = routeRelPath.split(sep).join("/");
  return SKIP_PATTERNS.some((re) => re.test(posix));
}

function listRouteFiles(dir, acc = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      listRouteFiles(full, acc);
    } else if (entry === "route.ts") {
      acc.push(full);
    }
  }
  return acc;
}

function methodsIn(filePath) {
  const text = readFileSync(filePath, "utf8");
  const found = new Set();
  for (const m of METHODS) {
    const re = new RegExp(
      `^\\s*export\\s+async\\s+function\\s+${m}\\s*\\(`,
      "m"
    );
    if (re.test(text)) found.add(m);
  }
  return found;
}

function directivesIn(filePath) {
  const text = readFileSync(filePath, "utf8");
  // Only honour directives inside a comment somewhere on the line, so we do
  // not accidentally match string literals or code identifiers.
  const inComment = (token) => {
    const re = new RegExp(`(?:^|//|\\*|\\s)${token}\\b(?!-)`, "im");
    return re.test(text);
  };
  return {
    ignoreAll: inComment("crud-audit:ignore"),
    ignoreUpdate: inComment("crud-audit:ignore-update"),
    ignoreDelete: inComment("crud-audit:ignore-delete"),
  };
}

/**
 * Group route files into "resources" by collapsing dynamic segments. A
 * resource has a collection route (POST/GET on a non-dynamic leaf) and an
 * item route (the sibling /[id]/route.ts).
 */
function buildResources(routeFiles) {
  const map = new Map();

  for (const file of routeFiles) {
    const rel = relative(REPO_ROOT, file).split(sep).join("/");
    if (shouldSkip(rel)) continue;

    const parts = rel.split("/");
    // last two are the file ("route.ts") and the immediate dir
    const dir = parts.slice(0, -1);
    const lastSegment = dir[dir.length - 1] ?? "";
    const isDynamicLeaf = /^\[.+\]$/.test(lastSegment);

    // resource key is the dir path without the trailing dynamic segment(s)
    const resourceParts = isDynamicLeaf ? dir.slice(0, -1) : dir;
    const resourceKey = resourceParts.join("/");
    if (!resourceKey) continue;

    const entry = map.get(resourceKey) ?? {
      key: resourceKey,
      collection: null,
      item: null,
      collectionMethods: new Set(),
      itemMethods: new Set(),
      ignoreAll: false,
      ignoreUpdate: false,
      ignoreDelete: false,
    };

    const methods = methodsIn(file);
    const directives = directivesIn(file);
    entry.ignoreAll ||= directives.ignoreAll;
    entry.ignoreUpdate ||= directives.ignoreUpdate;
    entry.ignoreDelete ||= directives.ignoreDelete;
    if (isDynamicLeaf) {
      entry.item = rel;
      for (const m of methods) entry.itemMethods.add(m);
    } else {
      entry.collection = rel;
      for (const m of methods) entry.collectionMethods.add(m);
    }
    map.set(resourceKey, entry);
  }

  return [...map.values()].sort((a, b) => a.key.localeCompare(b.key));
}

function analyze(resources) {
  const findings = [];
  for (const r of resources) {
    if (r.ignoreAll) continue;

    const hasCreate = r.collectionMethods.has("POST");
    const hasList = r.collectionMethods.has("GET");
    const hasReadOne = r.itemMethods.has("GET");
    // PATCH/PUT/DELETE conventionally live on the [id] route, but a few
    // resources implement them on the collection route with the id in the
    // body. Treat either location as satisfying the requirement.
    const hasUpdate =
      r.itemMethods.has("PATCH") ||
      r.itemMethods.has("PUT") ||
      r.collectionMethods.has("PATCH") ||
      r.collectionMethods.has("PUT");
    const hasDelete =
      r.itemMethods.has("DELETE") || r.collectionMethods.has("DELETE");

    // Only flag resources that look like a real CRUD surface, i.e. you can
    // create a row through the API. Read-only or one-shot endpoints get
    // skipped here even if the SKIP list missed them.
    if (!hasCreate) continue;

    const gaps = [];
    if (!hasUpdate && !r.ignoreUpdate) gaps.push("UPDATE (PATCH/PUT)");
    if (!hasDelete && !r.ignoreDelete) gaps.push("DELETE");

    findings.push({
      resource: "/" + r.key.replace(/^app\//, ""),
      collection: r.collection,
      item: r.item,
      methods: {
        list: hasList,
        readOne: hasReadOne,
        create: hasCreate,
        update: hasUpdate,
        delete: hasDelete,
      },
      ignoredUpdate: r.ignoreUpdate,
      ignoredDelete: r.ignoreDelete,
      gaps,
    });
  }
  return findings;
}

function renderTable(findings) {
  const ok = findings.filter((f) => f.gaps.length === 0);
  const gaps = findings.filter((f) => f.gaps.length > 0);

  const rows = findings.map((f) => ({
    resource: f.resource,
    list: f.methods.list ? "Y" : "-",
    read: f.methods.readOne ? "Y" : "-",
    create: f.methods.create ? "Y" : "-",
    update: f.methods.update ? "Y" : f.ignoredUpdate ? "n/a" : "-",
    delete: f.methods.delete ? "Y" : f.ignoredDelete ? "n/a" : "-",
    gaps: f.gaps.join(", ") || "ok",
  }));

  const headers = ["resource", "list", "read", "create", "update", "delete", "gaps"];
  const widths = headers.map((h) =>
    Math.max(h.length, ...rows.map((r) => String(r[h]).length))
  );
  const fmt = (cells) =>
    cells.map((c, i) => String(c).padEnd(widths[i], " ")).join("  ");

  console.log(fmt(headers));
  console.log(fmt(widths.map((w) => "-".repeat(w))));
  for (const r of rows) {
    console.log(fmt(headers.map((h) => r[h])));
  }
  console.log("");
  console.log(
    `${findings.length} CRUD resource(s) scanned, ${ok.length} full, ${gaps.length} with gaps.`
  );
  if (gaps.length > 0) {
    console.log("");
    console.log("Resources missing operations:");
    for (const f of gaps) {
      console.log(`  ${f.resource}  ->  missing ${f.gaps.join(", ")}`);
    }
  }
}

const args = process.argv.slice(2);
const wantJson = args.includes("--json");
const strict = args.includes("--strict");

const routeFiles = listRouteFiles(API_ROOT);
const resources = buildResources(routeFiles);
const findings = analyze(resources);

if (wantJson) {
  console.log(JSON.stringify(findings, null, 2));
} else {
  renderTable(findings);
}

if (strict && findings.some((f) => f.gaps.length > 0)) {
  process.exit(1);
}
