import { NextRequest } from "next/server";
import { Resend } from "resend";
import * as db from "@/lib/db";
import { createServiceClient } from "@/lib/supabase/server";
import {
  lodgePayFromEmail,
  renderMemberInviteEmail,
  renderStaffInviteEmail,
} from "@/lib/email/templates";

export function getBaseUrl(request: NextRequest) {
  const value = (
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.VERCEL_PROJECT_PRODUCTION_URL ??
    request.nextUrl.origin
  ).replace(/\/$/, "");
  return value.startsWith("http") ? value : `https://${value}`;
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
  const { data, error } = staff.auth_user_id
    ? await supabase.auth.admin.generateLink({
        type: "recovery",
        email: staff.email,
        options: { redirectTo },
      })
    : await supabase.auth.admin.generateLink({
        type: "invite",
        email: staff.email,
        options: {
          data: { full_name: staff.full_name, admin_role: staff.role },
          redirectTo,
        },
      });
  if (error || !data.properties?.action_link) {
    return {
      sent: false,
      error: error?.message ?? "Could not create an invite link.",
    };
  }

  if (data.user?.id && data.user.id !== staff.auth_user_id) {
    await db.updateAdminUser(staff.id, { auth_user_id: data.user.id });
  }

  const resend = new Resend(resendKey);
  const roleLabel = staff.role.replaceAll("_", " ");
  const actionLabel = staff.auth_user_id ? "Reset password" : "Accept invite";
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
  const { data, error } = member.auth_user_id
    ? await supabase.auth.admin.generateLink({
        type: "recovery",
        email: member.email,
        options: { redirectTo },
      })
    : await supabase.auth.admin.generateLink({
        type: "invite",
        email: member.email,
        options: {
          data: { full_name: member.full_name, member_id: member.id },
          redirectTo,
        },
      });

  if (error || !data.properties?.action_link) {
    return {
      sent: false,
      error: error?.message ?? "Could not create a member invite link.",
    };
  }

  if (data.user?.id && data.user.id !== member.auth_user_id) {
    await db.updateMember(member.id, member.lodge_id, { auth_user_id: data.user.id });
  }

  const resend = new Resend(resendKey);
  const actionLabel = member.auth_user_id ? "Reset portal access" : "Activate member portal";
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
