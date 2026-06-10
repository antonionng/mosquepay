#!/usr/bin/env node
// Idempotent platform owner bootstrap.
// Creates or updates the Supabase Auth user for the platform owner,
// links it to the global admin_users row created by migration 019,
// and sets the password.
//
// Usage:
//   NEXT_PUBLIC_SUPABASE_URL=... \
//   SUPABASE_SERVICE_ROLE_KEY=... \
//   PLATFORM_OWNER_EMAIL=ag@experrt.com \
//   PLATFORM_OWNER_PASSWORD='Brandnew4' \
//   node scripts/bootstrap-platform-owner.mjs

import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadDotEnv() {
  const newcomers = [".env.local", ".env"];
  for (const file of newcomers) {
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
const EMAIL = (process.env.PLATFORM_OWNER_EMAIL ?? "ag@experrt.com")
  .trim()
  .toLowerCase();
const PASSWORD = process.env.PLATFORM_OWNER_PASSWORD ?? "Brandnew4";
const FULL_NAME = process.env.PLATFORM_OWNER_NAME ?? "Platform Owner";

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Set them in .env.local or the environment."
  );
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function findAuthUserByEmail(email) {
  let page = 1;
  const perPage = 200;
  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const match = data?.users?.find(
      (user) => (user.email ?? "").toLowerCase() === email
    );
    if (match) return match;
    if (!data?.users?.length || data.users.length < perPage) return null;
    page += 1;
    if (page > 50) return null;
  }
}

async function ensureAuthUser() {
  const existing = await findAuthUserByEmail(EMAIL);
  if (existing) {
    console.log(`Auth user already exists (${existing.id}); updating password and metadata.`);
    const { data, error } = await admin.auth.admin.updateUserById(existing.id, {
      password: PASSWORD,
      email_confirm: true,
      user_metadata: {
        ...(existing.user_metadata ?? {}),
        full_name: FULL_NAME,
      },
      app_metadata: {
        ...(existing.app_metadata ?? {}),
        admin_role: "super_admin",
      },
    });
    if (error) throw error;
    return data.user ?? existing;
  }

  console.log("Creating Supabase Auth user...");
  const { data, error } = await admin.auth.admin.createUser({
    email: EMAIL,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: FULL_NAME },
    app_metadata: { admin_role: "super_admin" },
  });
  if (error) throw error;
  if (!data?.user) throw new Error("Failed to create auth user.");
  return data.user;
}

async function ensureAdminUserRow(authUserId) {
  const { data: existing, error: selectError } = await admin
    .from("admin_users")
    .select("*")
    .eq("email", EMAIL)
    .maybeSingle();
  if (selectError) throw selectError;

  if (existing) {
    const updates = {};
    if (existing.role !== "super_admin") updates.role = "super_admin";
    if (existing.church_id !== null) updates.church_id = null;
    if (existing.active !== true) updates.active = true;
    if (existing.full_name !== FULL_NAME) updates.full_name = FULL_NAME;
    if (existing.auth_user_id !== authUserId) updates.auth_user_id = authUserId;
    if (Object.keys(updates).length === 0) {
      console.log("admin_users row already aligned.");
      return existing;
    }
    updates.updated_at = new Date().toISOString();
    const { data, error } = await admin
      .from("admin_users")
      .update(updates)
      .eq("id", existing.id)
      .select("*")
      .maybeSingle();
    if (error) throw error;
    console.log("admin_users row updated.");
    return data ?? existing;
  }

  const { data, error } = await admin
    .from("admin_users")
    .insert({
      email: EMAIL,
      full_name: FULL_NAME,
      role: "super_admin",
      church_id: null,
      active: true,
      permissions: [],
      auth_user_id: authUserId,
    })
    .select("*")
    .single();
  if (error) throw error;
  console.log("admin_users row created.");
  return data;
}

async function main() {
  const user = await ensureAuthUser();
  const adminRow = await ensureAdminUserRow(user.id);
  console.log("");
  console.log("Platform owner ready.");
  console.log(`  Email:          ${adminRow.email}`);
  console.log(`  Role:           ${adminRow.role}`);
  console.log(`  Church scope:    ${adminRow.church_id ?? "(global)"}`);
  console.log(`  Auth user id:   ${user.id}`);
  console.log(`  Login at:       /admin/login`);
}

main().catch((error) => {
  console.error("Bootstrap failed:", error?.message ?? error);
  process.exit(1);
});
