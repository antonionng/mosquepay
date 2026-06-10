import { NextRequest } from "next/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import * as db from "@/lib/db";
import { createServiceClient } from "@/lib/supabase/server";
import {
  renderMemberInviteEmail,
  renderPasswordResetEmail,
  renderStaffInviteEmail,
} from "@/lib/email/templates";
import { sendWithLog } from "@/lib/email/send-with-log";

const PRODUCTION_SITE_URL = "https://churchpay.co.uk";

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
 *      https://churchpay.co.uk so emails never link to the
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
  churchName,
}: {
  request: NextRequest;
  staff: db.AdminUser;
  churchName: string;
}): Promise<{ sent: boolean; error: string | null }> {
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

  const roleLabel = staff.role.replaceAll("_", " ");
  const actionLabel = isFirstInvite ? "Accept invite" : "Reset password";
  const result = await sendWithLog({
    churchId: staff.church_id ?? null,
    toEmail: staff.email,
    toName: staff.full_name,
    adminUserId: staff.id,
    emailType: "staff_invite",
    entityType: "admin_user",
    entityId: staff.id,
    dedupeKey: null,
    subject: "You have been invited to ChurchPay",
    html: renderStaffInviteEmail({
      name: staff.full_name,
      roleLabel,
      churchName,
      actionUrl: data.properties.action_link,
      actionLabel,
    }),
    text: `Hello ${staff.full_name},\n\nYou have been invited to ChurchPay with ${roleLabel} access for ${churchName}.\n\nSet your password here: ${data.properties.action_link}\n`,
    metadata: { is_first_invite: isFirstInvite, role: staff.role },
  });

  if (!result.ok) {
    return { sent: false, error: result.error };
  }
  return { sent: true, error: null };
}

/**
 * Low-level helper that generates a Supabase recovery link and delivers it
 * via Resend with our branded password-reset template. Used directly by the
 * public forgot-password endpoints for platform owners (who may have no
 * admin_users row to anchor on) and indirectly by the higher-level staff
 * and member reset helpers below.
 *
 * Callers are responsible for ensuring the email actually identifies the
 * intended recipient (e.g. by looking it up in admin_users or members
 * first). This function does NOT enforce its own access control.
 */
async function sendPasswordResetEmail({
  email,
  recipientName,
  audience,
  redirectTo,
  churchName,
}: {
  email: string;
  recipientName: string;
  audience: "admin" | "member";
  redirectTo: string;
  churchName: string | null;
}): Promise<{ sent: boolean; error: string | null }> {
  const supabase = createServiceClient();
  const { data, error } = await supabase.auth.admin.generateLink({
    type: "recovery",
    email,
    options: { redirectTo },
  });
  if (error || !data.properties?.action_link) {
    return {
      sent: false,
      error: error?.message ?? "Could not create a password reset link.",
    };
  }

  const subject =
    audience === "admin"
      ? "Reset your ChurchPay admin password"
      : "Reset your ChurchPay member portal password";
  const result = await sendWithLog({
    churchId: null,
    toEmail: email,
    toName: recipientName,
    emailType:
      audience === "admin" ? "staff_password_reset" : "member_password_reset",
    entityType: "auth_user",
    entityId: email.toLowerCase(),
    dedupeKey: null,
    subject,
    html: renderPasswordResetEmail({
      name: recipientName,
      actionUrl: data.properties.action_link,
      audience,
      churchName,
    }),
    text: `Hello ${recipientName},\n\nReset your ChurchPay ${audience === "admin" ? "admin" : "member portal"} password here: ${data.properties.action_link}\n\nIf you did not request this, you can ignore this email.\n`,
    metadata: { audience, church_name: churchName },
  });

  if (!result.ok) {
    return { sent: false, error: result.error };
  }
  return { sent: true, error: null };
}

/**
 * Public forgot-password entry point. Resolves the redirect target from the
 * caller's request origin (so dev/staging/prod all work) and delegates to
 * sendPasswordResetEmail. Use this directly for platform owners that have
 * no admin_users row to anchor on.
 */
export async function sendPasswordResetByEmail({
  request,
  email,
  recipientName,
  audience,
  churchName,
}: {
  request: NextRequest;
  email: string;
  recipientName: string;
  audience: "admin" | "member";
  churchName: string | null;
}): Promise<{ sent: boolean; error: string | null }> {
  const baseUrl = getBaseUrl(request);
  const redirectTo =
    audience === "admin"
      ? `${baseUrl}/admin/reset-password`
      : `${baseUrl}/member/reset-password`;
  return sendPasswordResetEmail({
    email,
    recipientName,
    audience,
    redirectTo,
    churchName,
  });
}

/**
 * Sends a password reset email to an admin/staff user. The link lands on the
 * admin reset-password page where Supabase exchanges it for a session and
 * lets the user choose a new password.
 *
 * Safe to call for both first-time and existing users: if no auth.users row
 * exists yet, one is created on the fly so the recovery link works.
 */
/**
 * Sends a password reset email to a staff/admin user. Ensures an auth.users
 * row exists first (and back-links it onto admin_users) so first-time staff
 * can use the link to set their initial password.
 */
export async function sendStaffPasswordReset({
  request,
  staff,
  churchName,
}: {
  request: NextRequest;
  staff: db.AdminUser;
  churchName: string;
}): Promise<{ sent: boolean; error: string | null }> {
  if (!staff.auth_user_id) {
    const supabase = createServiceClient();
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
    await db.updateAdminUser(staff.id, { auth_user_id: ensured.id });
  }

  return sendPasswordResetByEmail({
    request,
    email: staff.email,
    recipientName: staff.full_name,
    audience: "admin",
    churchName,
  });
}

/**
 * Sends a password reset email to a church member. Same shape as
 * sendStaffPasswordReset but lands on the member reset-password page.
 */
export async function sendMemberPasswordReset({
  request,
  member,
  churchName,
}: {
  request: NextRequest;
  member: db.Member;
  churchName: string;
}): Promise<{ sent: boolean; error: string | null }> {
  if (!member.email) {
    return { sent: false, error: "Member has no email on file." };
  }

  if (!member.auth_user_id) {
    const supabase = createServiceClient();
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
    await db.updateMember(member.id, member.church_id, {
      auth_user_id: ensured.id,
    });
  }

  return sendPasswordResetByEmail({
    request,
    email: member.email,
    recipientName: member.full_name,
    audience: "member",
    churchName,
  });
}

/**
 * Sends a Resend-powered invite to an existing church member. Existing portal
 * users receive a recovery link; brand new users receive an invite link.
 */
export async function sendMemberInvite({
  request,
  member,
  churchName,
}: {
  request: NextRequest;
  member: db.Member;
  churchName: string;
}): Promise<{ sent: boolean; error: string | null }> {
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
    await db.updateMember(member.id, member.church_id, {
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

  const actionLabel = isFirstInvite
    ? "Activate member portal"
    : "Reset portal access";
  const result = await sendWithLog({
    churchId: member.church_id,
    toEmail: member.email,
    toName: member.full_name,
    memberId: member.id,
    emailType: "member_invite",
    entityType: "member",
    entityId: member.id,
    dedupeKey: null,
    subject: "Your ChurchPay member portal invite",
    html: renderMemberInviteEmail({
      name: member.full_name,
      churchName,
      actionUrl: data.properties.action_link,
      actionLabel,
    }),
    text: `Hello ${member.full_name},\n\nYou have been invited to access the ChurchPay member portal for ${churchName}.\n\nSet your password here: ${data.properties.action_link}\n`,
    metadata: { is_first_invite: isFirstInvite },
  });

  if (!result.ok) {
    return { sent: false, error: result.error };
  }
  return { sent: true, error: null };
}
