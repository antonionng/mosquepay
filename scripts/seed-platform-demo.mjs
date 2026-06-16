#!/usr/bin/env node
// Seed platform owner + 10 UK demo mosques with realistic community data.
//
// Usage:
//   npm run seed:platform-demo
//   npm run seed:platform-demo -- --reset
//
// Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.

import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { PLATFORM_DEMO_MOSQUES, demoEmailFor } from "../lib/platform-demo-mosques.ts";

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
const RESET = process.argv.includes("--reset");

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Add the service role key to .env.local first."
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const NETWORKS = [
  { slug: "london-mosques", name: "London Mosques Network" },
  { slug: "midlands-mosques", name: "Midlands Mosques Network" },
  { slug: "northern-mosques", name: "Northern Mosques Network" },
  { slug: "scotland-wales-mosques", name: "Scotland & Wales Mosques Network" },
];

/** Map demo mosque slug → network slug for seed grouping. */
const NETWORK_BY_MOSQUE = {
  "central-jamia-demo": "london-mosques",
  "noor-ul-islam-london": "london-mosques",
  "husaini-islamic-centre": "london-mosques",
  "suleymaniye-masjid-london": "london-mosques",
  "madinah-masjid-birmingham": "midlands-mosques",
  "al-falah-bradford": "northern-mosques",
  "masjid-al-rahma-manchester": "northern-mosques",
  "leeds-grand-masjid": "northern-mosques",
  "glasgow-central-masjid": "scotland-wales-mosques",
  "tawakal-masjid-cardiff": "scotland-wales-mosques",
};

const NEWCOMER_STAGE_MAP = {
  expression_of_interest: "enquiry",
  initial_contact: "enquiry",
  new: "enquiry",
  service_scheduled: "follow_up",
  interview_scheduled: "follow_up",
  welcomed: "visited",
  approved: "membership_class",
  "membership decision_pending": "membership_class",
};

function splitName(fullName) {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length <= 1) return { first_name: parts[0] ?? "Member", last_name: "" };
  return { first_name: parts[0], last_name: parts.slice(1).join(" ") };
}

function log(msg) {
  console.log(msg);
}

function mapNewcomerStage(stage) {
  return NEWCOMER_STAGE_MAP[stage] ?? "enquiry";
}

async function wipeSeedMosques() {
  const slugs = PLATFORM_DEMO_MOSQUES.map((m) => m.slug);
  const { data: mosques, error } = await supabase
    .from("mosques")
    .select("id, slug")
    .in("slug", slugs);
  if (error) throw error;
  if (!mosques?.length) return;
  const ids = mosques.map((m) => m.id);
  log(`Removing ${ids.length} existing demo mosques (cascade)...`);
  const { error: delErr } = await supabase.from("mosques").delete().in("id", ids);
  if (delErr) throw delErr;
}

async function upsertNetworks() {
  const map = new Map();
  for (const network of NETWORKS) {
    const { data: existing, error: selErr } = await supabase
      .from("networks")
      .select("id, slug")
      .eq("slug", network.slug)
      .maybeSingle();
    if (selErr) throw selErr;
    if (existing) {
      map.set(network.slug, existing.id);
      continue;
    }
    const { data, error } = await supabase
      .from("networks")
      .insert({
        slug: network.slug,
        name: network.name,
        contact_email: "networks@mosquepay.demo",
      })
      .select("id")
      .single();
    if (error) throw error;
    map.set(network.slug, data.id);
  }
  return map;
}

async function seedMosque(mosqueDef, networkId) {
  const { data: mosque, error } = await supabase
    .from("mosques")
    .upsert(
      {
        slug: mosqueDef.slug,
        name: mosqueDef.name,
        city: mosqueDef.city,
        country: "GB",
        tagline: mosqueDef.tagline,
        governing_body: mosqueDef.governing_body,
        mosque_number: mosqueDef.mosque_number,
        network_id: networkId,
        support_email: mosqueDef.support_email,
        support_phone: mosqueDef.support_phone,
        secretary_name: mosqueDef.secretary_name,
        secretary_address: mosqueDef.secretary_address,
        service_schedule: mosqueDef.service_schedule,
        service_location: mosqueDef.service_location,
        service_location_url: mosqueDef.service_location_url,
        accessibility_notes: mosqueDef.accessibility_notes,
        default_dress_code: mosqueDef.default_dress_code,
        primary_color: mosqueDef.primary_color,
        secondary_color: mosqueDef.secondary_color,
        hmrc_charity_reference: mosqueDef.hmrc_charity_reference,
        gift_aid_default_mode: "both",
        is_active: true,
        accepts_self_registration: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "slug" }
    )
    .select("id, slug, name")
    .single();
  if (error) throw error;

  await supabase
    .from("members")
    .delete()
    .eq("mosque_id", mosque.id)
    .like("email", "%@mosquepay-demo.test");

  const memberRows = mosqueDef.officers.map((officer, i) => {
    const { first_name, last_name } = splitName(officer.full_name);
    return {
      mosque_id: mosque.id,
      email: demoEmailFor(mosqueDef.slug, `officer-${i + 1}`),
      first_name,
      last_name,
      membership_title: officer.office_title,
      membership_sort_order: i + 1,
      membership_status: "active",
      address: mosqueDef.service_location,
      gift_aid_eligible: i === 3,
    };
  });

  for (let i = 0; i < mosqueDef.member_names.length; i++) {
    const fullName = mosqueDef.member_names[i];
    const { first_name, last_name } = splitName(fullName);
    memberRows.push({
      mosque_id: mosque.id,
      email: demoEmailFor(mosqueDef.slug, `member-${i + 1}`),
      first_name,
      last_name,
      membership_title: null,
      membership_sort_order: null,
      membership_status: "active",
      address: mosqueDef.city,
      gift_aid_eligible: i % 2 === 0,
    });
  }

  const { error: memErr } = await supabase.from("members").insert(memberRows);
  if (memErr) throw memErr;

  const now = new Date();
  const upcoming = new Date(now.getTime() + 10 * 86400000).toISOString();
  const past = new Date(now.getTime() - 14 * 86400000).toISOString();

  const events = [
    {
      mosque_id: mosque.id,
      title: "Jumu'ah Prayer",
      slug: `jumuah-${mosqueDef.slug}`,
      description: `Friday Jumu'ah at ${mosqueDef.name}.`,
      type: "jumuah",
      starts_at: upcoming,
      location: mosqueDef.service_location,
      enable_rsvp: true,
    },
    {
      mosque_id: mosque.id,
      title: "Recent Jumu'ah",
      slug: `past-jumuah-${mosqueDef.slug}`,
      description: "Recent Jumu'ah with collection.",
      type: "jumuah",
      starts_at: past,
      location: mosqueDef.service_location,
      enable_rsvp: false,
    },
  ];

  for (const event of events) {
    const { error: evErr } = await supabase.from("events").upsert(event, {
      onConflict: "mosque_id,slug",
    });
    if (evErr) throw evErr;
  }

  await supabase
    .from("newcomers")
    .delete()
    .eq("mosque_id", mosque.id)
    .like("email", "%@mosquepay-demo.test");

  const newcomerRows = mosqueDef.newcomer_names.map((n, i) => ({
    mosque_id: mosque.id,
    first_name: n.first,
    last_name: n.last,
    email: demoEmailFor(mosqueDef.slug, `newcomer-${i + 1}`),
    stage: mapNewcomerStage(n.stage),
    notes: `Interested in ${mosqueDef.name} (${mosqueDef.denomination}).`,
  }));

  const { error: ncErr } = await supabase.from("newcomers").insert(newcomerRows);
  if (ncErr) throw ncErr;

  const { error: siteErr } = await supabase.from("mosque_site_pages").upsert(
    {
      mosque_id: mosque.id,
      slug: "home",
      title: mosqueDef.name,
      sections: [
        {
          type: "hero",
          heading: `Welcome to ${mosqueDef.name}`,
          body: `${mosqueDef.tagline} (${mosqueDef.denomination})`,
        },
      ],
      is_published: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "mosque_id,slug" }
  );
  if (siteErr) throw siteErr;

  const secretaryEmail = demoEmailFor(mosqueDef.slug, "secretary");
  const { error: adminErr } = await supabase.from("admin_users").upsert(
    {
      mosque_id: mosque.id,
      email: secretaryEmail,
      name: mosqueDef.secretary_name,
      role: "secretary",
      is_platform_owner: false,
    },
    { onConflict: "mosque_id,email" }
  );
  if (adminErr) throw adminErr;

  return mosque;
}

async function main() {
  log("Bootstrapping platform owner...");
  const boot = spawnSync("node", ["scripts/bootstrap-platform-owner.mjs"], {
    cwd: process.cwd(),
    env: process.env,
    stdio: "inherit",
  });
  if (boot.status !== 0) {
    process.exit(boot.status ?? 1);
  }

  if (RESET) {
    await wipeSeedMosques();
  }

  log("Upserting networks...");
  const networkIds = await upsertNetworks();

  log(`Seeding ${PLATFORM_DEMO_MOSQUES.length} mosques...`);
  for (const def of PLATFORM_DEMO_MOSQUES) {
    const networkSlug = NETWORK_BY_MOSQUE[def.slug] ?? "london-mosques";
    const networkId = networkIds.get(networkSlug) ?? null;
    const mosque = await seedMosque(def, networkId);
    log(`  ✓ ${mosque.name} (${mosque.slug})`);
  }

  log("");
  log("Platform demo seed complete.");
  log("  Login: see PLATFORM_OWNER_EMAIL / ADMIN_EMAIL in .env.local at /admin/login");
  log("  Platform console: /admin/platform");
}

main().catch((err) => {
  console.error("Seed failed:", err?.message ?? err);
  process.exit(1);
});
