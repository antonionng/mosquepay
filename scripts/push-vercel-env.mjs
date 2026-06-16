#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";

const ROOT = resolve(import.meta.dirname, "..");

function loadDotEnv(file) {
  const path = resolve(ROOT, file);
  if (!existsSync(path)) return {};
  const env = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
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
    env[key] = value;
  }
  return env;
}

const local = loadDotEnv(".env.local");
const defaults = {
  ADMIN_ROLE: "super_admin",
  CONTACT_EMAIL: "ag@experrt.com",
  EMAIL_LOGO_URL: "https://www.mosque-pay.com/brand/mosquepay-email-logo.png",
  MOOOV_API_BASE: "https://staging.api.mooov.money",
  MOSQUEPAY_GIVING_SUBSCRIPTION_ENABLED: "false",
  PLATFORM_OWNER_PASSWORD: local.PLATFORM_OWNER_PASSWORD || local.ADMIN_PASSWORD || "Brandnew4",
};

const SENSITIVE = new Set([
  "OPENAI_API_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "RESEND_API_KEY",
  "SESSION_SECRET",
  "ADMIN_PASSWORD",
  "PLATFORM_OWNER_PASSWORD",
]);

const KEYS = [
  "ADMIN_EMAIL",
  "ADMIN_PASSWORD",
  "ADMIN_ROLE",
  "ALLOW_IN_MEMORY_MOCK",
  "MOSQUEPAY_GIVING_SUBSCRIPTION_ENABLED",
  "CONTACT_EMAIL",
  "E2E_TEST_EMAIL",
  "EMAIL_FROM",
  "EMAIL_LOGO_URL",
  "MOOOV_API_BASE",
  "MOOOV_CONNECT_BASE",
  "MOOOV_CONNECT_MODE",
  "MOOOV_DEMO_MOSQUE_ID",
  "MOOOV_GATEWAY_BASE_URL",
  "MOOOV_PLATFORM_ID",
  "MOOOV_PLATFORM_SLUG",
  "MOOOV_REDIRECT_URI",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_SUPABASE_URL",
  "OPENAI_API_KEY",
  "PAYMENTS_PROVIDER",
  "PLATFORM_OWNER_PASSWORD",
  "RESEND_API_KEY",
  "RESEND_FROM_EMAIL",
  "SESSION_SECRET",
  "SUPABASE_SERVICE_ROLE_KEY",
];

const PROD_SITE = "https://www.mosque-pay.com";
const PROD_MOOV_REDIRECT =
  local.MOOV_REDIRECT_URI?.replace(/churchpay\.co\.uk|churchpayment\.com/, "mosque-pay.com") ||
  "https://www.mosque-pay.com/oauth/mooov/callback";

function pushVar(key, value, env) {
  if (!value) {
    console.log(`  skip ${key} (${env}): empty`);
    return true;
  }
  const args = ["env", "add", key, env, "--force", "--yes", "--value", value];
  if (SENSITIVE.has(key) && env !== "development") args.push("--sensitive");
  const result = spawnSync("vercel", args, {
    cwd: ROOT,
    encoding: "utf8",
  });
  if (result.status !== 0) {
    console.error(`  ✗ ${key} (${env}): ${result.stderr || result.stdout}`);
    return false;
  }
  console.log(`  ✓ ${key} → ${env}`);
  return true;
}

function valuesForEnv(env) {
  const base = { ...defaults, ...local };
  if (env === "production") {
    base.NEXT_PUBLIC_SITE_URL = PROD_SITE;
    base.ALLOW_IN_MEMORY_MOCK = "false";
    base.MOOV_REDIRECT_URI = PROD_MOOV_REDIRECT;
    base.SESSION_SECRET = randomBytes(32).toString("hex");
  } else if (env === "preview") {
    base.NEXT_PUBLIC_SITE_URL = PROD_SITE;
    base.ALLOW_IN_MEMORY_MOCK = "false";
    base.MOOV_REDIRECT_URI = PROD_MOOV_REDIRECT;
    base.SESSION_SECRET = randomBytes(32).toString("hex");
  } else {
    base.NEXT_PUBLIC_SITE_URL = local.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    base.ALLOW_IN_MEMORY_MOCK = local.ALLOW_IN_MEMORY_MOCK || "true";
    base.MOOV_REDIRECT_URI = local.MOOV_REDIRECT_URI || PROD_MOOV_REDIRECT;
    base.SESSION_SECRET = local.SESSION_SECRET || "local-development-session-secret";
  }
  return base;
}

const whoami = spawnSync("vercel", ["whoami"], { cwd: ROOT, encoding: "utf8" });
if (whoami.status !== 0) {
  console.error("Not logged in to Vercel. Run: vercel login");
  process.exit(1);
}

if (!existsSync(resolve(ROOT, ".vercel/project.json"))) {
  spawnSync("vercel", ["link", "--project", "mosquepay", "--yes"], {
    cwd: ROOT,
    stdio: "inherit",
  });
}

console.log("Pushing environment variables to Vercel (mosquepay)...");

for (const env of ["production", "preview", "development"]) {
  console.log(`\n== ${env} ==`);
  const vals = valuesForEnv(env);
  for (const key of KEYS) {
  pushVar(key, vals[key], env);
  }
  pushVar("NEXT_PUBLIC_SITE_URL", vals.NEXT_PUBLIC_SITE_URL, env);
}

console.log("\nDone.");
