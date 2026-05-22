import { NextRequest } from "next/server";
import { Resend } from "resend";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import * as db from "@/lib/db";
import { createServiceClient } from "@/lib/supabase/server";
import {
  lodgePayFromEmail,
  renderMemberInviteEmail,
  renderStaffInviteEmail,
} from "@/lib/email/templates";

const PRODUCTION_SITE_URL = "https://lodgepayments.co.uk";

function withScheme(value: string) {
  const trimmed = value.replace(/\/$/, "");
  return trimmed.startsWith("http") ? trimmed : `https://${trimmed}`;
}

/**
 * Resolve the canonical base URL for invite/recovery action links.
 *
 * Priority:
 *   1. Explicit NEXT_PUBLIC_SITE_URL override (any environment).
 *   2. Production deploys (`VERCEL_ENV === "production"`) always use
 *      https://lodgepayments.co.uk so emails never link to the
 *      auto-generated `*.vercel.app` host.
 *   3. Vercel preview / inferred production URL when available.
 *   4. Fallback to the request origin (covers local dev → http://localhost:3000).
 */
export function getBaseUrl(request: NextRequest) {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return withScheme(process.env.NEXT_PUBLIC_SITE_URL);
  }
  if (process.env.VERCEL_ENV === "production") {
    return PRODUCTION_SITE_URL;
  }
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return withScheme(process.env.VERCEL_PROJECT_PRODUCTION_URL);
  }
  return request.nextUrl.origin.replace(/\/$/, "");
}

/**
 * Look up an auth user by email through the admin API. Used to recover from
 * "user already exists" responses so we can reuse the existing auth row
 * instead of failing the invite.
 */
async function findAuthUserByEmail(
  supabase: SupabaseClient,
  email: string
): Promise<User | null> {
  const target = email.trim().toLowerCase();
  let page = 1;
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) throw error;
    const match = data.users.find(
      (user) => user.email?.toLowerCase() === target
    );
    if (match) return match;
    if (data.users.length < 200) return null;
    page += 1;
  }
  return null;
}

/**
 * Ensure an auth.users record exists for the given email without triggering
 * Supabase's built-in invite mailer. We pre-create the user (email confirmed
 * so they can immediately set a password via the recovery flow), then return
 * the auth user id. Existing users are returned unchanged.
 */
async function ensureAuthUser({
  supabase,
  email,
  fullName,
  metadata,
}: {
  supabase: SupabaseClient;
  email: string;
  fullName: string;
  metadata: Record<string, unknown>;
}): Promise<{ id: string | null; error: string | null }> {
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { full_name: fullName, ...metadata },
  });
  if (!error && data.user?.id) {
    return { id: data.user.id, error: null };
  }
  if (error) {
    const existing = await findAuthUserByEmail(supabase, email).catch(
      () => null
    );
    if (existing?.id) return { id: existing.id, error: null };
    return { id: null, error: error.message };
  }
  return { id: null, error: "Could not create auth user." };
}

/**
 * Sends a Resend-powered invite to an admin/staff user. Idempotent: existing
 * users get a recovery / set-password link; brand new users get an invite
 * link.
 */
export async function sendStaffInvite({
  request,
  staff,
  lodgeName,
}: {
  request: NextRequest;
  staff: db.AdminUser;
  lodgeName: string;
}): Promise<{ sent: boolean; error: string | null }> {
  const resendKey = process.env.RESEND_API_KEY;
  const from = lodgePayFromEmail(
    process.env.RESEND_FROM_EMAIL ??
    process.env.EMAIL_FROM ??
    "LodgePay <noreply@lodgepayments.co.uk>"
  );
  if (!resendKey) {
    return { sent: false, error: "Resend is not configured." };
  }

  const baseUrl = getBaseUrl(request);
  const redirectTo = `${baseUrl}/admin/accept-invite`;
  const supabase = createServiceClient();

  let authUserId = staff.auth_user_id;
  const isFirstInvite = !authUserId;
  if (!authUserId) {
    const ensured = await ensureAuthUser({
      supabase,
      email: staff.email,
      fullName: staff.full_name,
      metadata: { admin_role: staff.role },
    });
    if (!ensured.id) {
      return {
        sent: false,
        error: ensured.error ?? "Could not create the staff auth user.",
      };
    }
    authUserId = ensured.id;
    await db.updateAdminUser(staff.id, { auth_user_id: authUserId });
  }

  const { data, error } = await supabase.auth.admin.generateLink({
    type: "recovery",
    email: staff.email,
    options: { redirectTo },
  });
  if (error || !data.properties?.action_link) {
    return {
      sent: false,
      error: error?.message ?? "Could not create an invite link.",
    };
  }

  const resend = new Resend(resendKey);
  const roleLabel = staff.role.replaceAll("_", " ");
  const actionLabel = isFirstInvite ? "Accept invite" : "Reset password";
  const { error: resendError } = await resend.emails.send({
    from,
    to: staff.email,
    subject: "You have been invited to LodgePay",
    html: renderStaffInviteEmail({
      name: staff.full_name,
      roleLabel,
      lodgeName,
      actionUrl: data.properties.action_link,
      actionLabel,
    }),
    text: `Hello ${staff.full_name},\n\nYou have been invited to LodgePay with ${roleLabel} access for ${lodgeName}.\n\nSet your password here: ${data.properties.action_link}\n`,
  });

  if (resendError) {
    return { sent: false, error: resendError.message };
  }

  return { sent: true, error: null };
}

/**
 * Sends a Resend-powered invite to an existing lodge member. Existing portal
 * users receive a recovery link; brand new users receive an invite link.
 */
export async function sendMemberInvite({
  request,
  member,
  lodgeName,
}: {
  request: NextRequest;
  member: db.Member;
  lodgeName: string;
}): Promise<{ sent: boolean; error: string | null }> {
  const resendKey = process.env.RESEND_API_KEY;
  const from = lodgePayFromEmail(
    process.env.RESEND_FROM_EMAIL ??
    process.env.EMAIL_FROM ??
    "LodgePay <noreply@lodgepayments.co.uk>"
  );
  if (!resendKey) {
    return { sent: false, error: "Resend is not configured." };
  }

  const baseUrl = getBaseUrl(request);
  const redirectTo = `${baseUrl}/member/accept-invite`;
  const supabase = createServiceClient();

  let authUserId = member.auth_user_id;
  const isFirstInvite = !authUserId;
  if (!authUserId) {
    const ensured = await ensureAuthUser({
      supabase,
      email: member.email,
      fullName: member.full_name,
      metadata: { member_id: member.id },
    });
    if (!ensured.id) {
      return {
        sent: false,
        error: ensured.error ?? "Could not create the member auth user.",
      };
    }
    authUserId = ensured.id;
    await db.updateMember(member.id, member.lodge_id, {
      auth_user_id: authUserId,
    });
  }

  const { data, error } = await supabase.auth.admin.generateLink({
    type: "recovery",
    email: member.email,
    options: { redirectTo },
  });
  if (error || !data.properties?.action_link) {
    return {
      sent: false,
      error: error?.message ?? "Could not create a member invite link.",
    };
  }

  const resend = new Resend(resendKey);
  const actionLabel = isFirstInvite
    ? "Activate member portal"
    : "Reset portal access";
  const { error: resendError } = await resend.emails.send({
    from,
    to: member.email,
    subject: "Your LodgePay member portal invite",
    html: renderMemberInviteEmail({
      name: member.full_name,
      lodgeName,
      actionUrl: data.properties.action_link,
      actionLabel,
    }),
    text: `Hello ${member.full_name},\n\nYou have been invited to access the LodgePay member portal for ${lodgeName}.\n\nSet your password here: ${data.properties.action_link}\n`,
  });

  if (resendError) {
    return { sent: false, error: resendError.message };
  }

  return { sent: true, error: null };
}
