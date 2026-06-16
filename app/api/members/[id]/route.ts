import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import { rejectIfMockDisabled } from "@/lib/db/reject-mock";
import * as db from "@/lib/db";
import * as mockDb from "@/lib/mock-db";
import { getMosqueSlugFromRequest } from "@/lib/tenant";
import { requireAdminApiAuth, requireAdminApiPermission } from "@/lib/auth/api";
import { writeAuditLog } from "@/lib/audit";
import { createServiceClient } from "@/lib/supabase/server";
import { isRank, RANK_CODES } from "@/lib/members/rank";

type Params = { params: Promise<{ id: string }> };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function GET(request: NextRequest, { params }: Params) {
  const _rejectMock = rejectIfMockDisabled();
  if (_rejectMock) return _rejectMock;

  try {
    const unauthorized = await requireAdminApiAuth();
    if (unauthorized) return unauthorized;

    const { id } = await params;
    const mosqueSlug = getMosqueSlugFromRequest(request);

    if (isSupabaseConfigured()) {
      const mosqueId = await db.resolveMosqueId(mosqueSlug);
      if (!mosqueId) {
        return NextResponse.json({ error: "Mosque not found." }, { status: 404 });
      }

      const member = await db.getMemberById(id, mosqueId);
      if (!member) {
        return NextResponse.json({ error: "Member not found." }, { status: 404 });
      }

      const [dietaryHistory, paymentHistory, givingRecords] = await Promise.all([
        db.getRsvpDietaryByEmail(member.email, mosqueId),
        db.getPaymentsByEmail(member.email, mosqueId),
        db.getMemberGiving(mosqueId, { memberEmail: member.email }),
      ]);

      return NextResponse.json({ member, dietaryHistory, paymentHistory, givingRecords });
    }

    const member = mockDb.getMemberById(id, { mosque_slug: mosqueSlug });
    if (!member) {
      return NextResponse.json({ error: "Member not found." }, { status: 404 });
    }

    const dietaryHistory = mockDb.getRsvpDietaryByEmail(member.email, { mosque_slug: mosqueSlug });
    const paymentHistory = mockDb.getPaymentsByEmail(member.email, { mosque_slug: mosqueSlug });

    return NextResponse.json({ member, dietaryHistory, paymentHistory, givingRecords: [] });
  } catch (e) {
    console.error("Member GET error:", e);
    return NextResponse.json({ error: "Failed to fetch member." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const _rejectMock = rejectIfMockDisabled();
  if (_rejectMock) return _rejectMock;

  try {
    const unauthorized = await requireAdminApiAuth();
    if (unauthorized) return unauthorized;

    const { id } = await params;
    const mosqueSlug = getMosqueSlugFromRequest(request);
    const body = await request.json();

    if (
      Object.prototype.hasOwnProperty.call(body, "rank") &&
      body.rank != null &&
      body.rank !== "" &&
      !isRank(body.rank)
    ) {
      return NextResponse.json(
        {
          error: `Invalid rank "${body.rank}". Must be one of: ${RANK_CODES.join(", ")}.`,
        },
        { status: 400 }
      );
    }

    if (isSupabaseConfigured()) {
      const mosqueId = await db.resolveMosqueId(mosqueSlug);
      if (!mosqueId) {
        return NextResponse.json({ error: "Mosque not found." }, { status: 404 });
      }
      const forbidden = await requireAdminApiPermission("members:write", mosqueId);
      if (forbidden) return forbidden;

      const { email: rawEmail, ...otherFields } = body as Record<string, unknown>;
      const emailChange = await applyMemberEmailChange({
        memberId: id,
        mosqueId,
        rawEmail,
      });
      if (emailChange.kind === "error") {
        return NextResponse.json(
          { error: emailChange.message },
          { status: emailChange.status }
        );
      }

      let updated: db.Member | null = emailChange.member;
      if (Object.keys(otherFields).length > 0) {
        updated = await db.updateMember(id, mosqueId, otherFields);
      }

      if (!updated) {
        return NextResponse.json({ error: "Member not found." }, { status: 404 });
      }

      await writeAuditLog({
        mosqueId,
        action: "updated",
        entityType: "member",
        entityId: updated.id,
        summary: `Updated member ${updated.full_name}`,
        metadata: {
          fields: Object.keys(body),
          ...(emailChange.kind === "changed"
            ? {
                email_change: {
                  from: emailChange.oldEmail,
                  to: emailChange.newEmail,
                  auth_user_updated: emailChange.authUserUpdated,
                  stripe_customer_updated: emailChange.stripeCustomerUpdated,
                  payments_updated: emailChange.paymentsUpdated,
                  rsvps_updated: emailChange.rsvpsUpdated,
                  giving_updated: emailChange.givingUpdated,
                  warnings: emailChange.warnings,
                },
              }
            : {}),
        },
      });
      return NextResponse.json({
        member: updated,
        ...(emailChange.kind === "changed"
          ? {
              email_change: {
                from: emailChange.oldEmail,
                to: emailChange.newEmail,
                payments_updated: emailChange.paymentsUpdated,
                rsvps_updated: emailChange.rsvpsUpdated,
                giving_updated: emailChange.givingUpdated,
                auth_user_updated: emailChange.authUserUpdated,
                stripe_customer_updated: emailChange.stripeCustomerUpdated,
                warnings: emailChange.warnings,
              },
            }
          : {}),
      });
    }

    const updated = mockDb.updateMember(id, body, { mosque_slug: mosqueSlug });
    if (!updated) {
      return NextResponse.json({ error: "Member not found." }, { status: 404 });
    }
    return NextResponse.json({ member: updated });
  } catch (e) {
    console.error("Member PATCH error:", e);
    return NextResponse.json({ error: "Failed to update member." }, { status: 500 });
  }
}

type EmailChangeResult =
  | { kind: "noop"; member: db.Member }
  | {
      kind: "changed";
      member: db.Member;
      oldEmail: string;
      newEmail: string;
      paymentsUpdated: number;
      rsvpsUpdated: number;
      givingUpdated: number;
      authUserUpdated: boolean;
      stripeCustomerUpdated: boolean;
      warnings: string[];
    }
  | { kind: "error"; status: number; message: string };

/**
 * Apply a member email change end-to-end: validate, sync the Supabase auth
 * user (so they can still log in), best-effort sync the Stripe customer
 * record, then rewrite the email in `members` and every email-keyed
 * historical table (payments, rsvps, member_giving) so the admin detail view
 * stays joined up.
 *
 * Returns `noop` when no email change is being requested so the caller can
 * continue with the rest of the PATCH untouched.
 */
async function applyMemberEmailChange({
  memberId,
  mosqueId,
  rawEmail,
}: {
  memberId: string;
  mosqueId: string;
  rawEmail: unknown;
}): Promise<EmailChangeResult> {
  if (rawEmail === undefined) {
    const current = await db.getMemberById(memberId, mosqueId);
    if (!current) {
      return { kind: "error", status: 404, message: "Member not found." };
    }
    return { kind: "noop", member: current };
  }

  if (typeof rawEmail !== "string") {
    return { kind: "error", status: 400, message: "Email must be a string." };
  }

  const normalised = rawEmail.trim().toLowerCase();
  if (!EMAIL_RE.test(normalised)) {
    return {
      kind: "error",
      status: 400,
      message: "Enter a valid email address.",
    };
  }

  const current = await db.getMemberById(memberId, mosqueId);
  if (!current) {
    return { kind: "error", status: 404, message: "Member not found." };
  }

  if (current.email === normalised) {
    return { kind: "noop", member: current };
  }

  const collision = await db.getMemberByEmail(normalised, mosqueId);
  if (collision && collision.id !== memberId) {
    return {
      kind: "error",
      status: 409,
      message: "Another member in this mosque already has that email.",
    };
  }

  const warnings: string[] = [];
  let authUserUpdated = false;
  if (current.auth_user_id) {
    try {
      const supabaseAdmin = createServiceClient();
      const { error } = await supabaseAdmin.auth.admin.updateUserById(
        current.auth_user_id,
        { email: normalised, email_confirm: true }
      );
      if (error) {
        return {
          kind: "error",
          status: 400,
          message: `Could not update portal login email: ${error.message}`,
        };
      }
      authUserUpdated = true;
    } catch (authError) {
      const message =
        authError instanceof Error ? authError.message : "Unknown auth error.";
      return {
        kind: "error",
        status: 500,
        message: `Could not update portal login email: ${message}`,
      };
    }
  }

  let stripeCustomerUpdated = false;
  if (current.stripe_customer_id && process.env.STRIPE_SECRET_KEY) {
    try {
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
        apiVersion: "2025-02-24.acacia",
      });
      await stripe.customers.update(current.stripe_customer_id, {
        email: normalised,
      });
      stripeCustomerUpdated = true;
    } catch (stripeError) {
      const message =
        stripeError instanceof Error
          ? stripeError.message
          : "Unknown Stripe error.";
      warnings.push(`Stripe customer email not updated: ${message}.`);
    }
  }

  const change = await db.changeMemberEmail(memberId, mosqueId, normalised);
  if (!change.member) {
    return { kind: "error", status: 404, message: "Member not found." };
  }

  return {
    kind: "changed",
    member: change.member,
    oldEmail: change.oldEmail,
    newEmail: change.member.email,
    paymentsUpdated: change.paymentsUpdated,
    rsvpsUpdated: change.rsvpsUpdated,
    givingUpdated: change.givingUpdated,
    authUserUpdated,
    stripeCustomerUpdated,
    warnings,
  };
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const _rejectMock = rejectIfMockDisabled();
  if (_rejectMock) return _rejectMock;

  try {
    const unauthorized = await requireAdminApiAuth();
    if (unauthorized) return unauthorized;

    const { id } = await params;
    const mosqueSlug = getMosqueSlugFromRequest(request);

    if (isSupabaseConfigured()) {
      const mosqueId = await db.resolveMosqueId(mosqueSlug);
      if (!mosqueId) {
        return NextResponse.json({ error: "Mosque not found." }, { status: 404 });
      }
      const forbidden = await requireAdminApiPermission("members:write", mosqueId);
      if (forbidden) return forbidden;

      const updated = await db.updateMember(id, mosqueId, { membership_status: "excluded" });
      if (!updated) {
        return NextResponse.json({ error: "Member not found." }, { status: 404 });
      }
      await writeAuditLog({
        mosqueId,
        action: "excluded",
        entityType: "member",
        entityId: updated.id,
        summary: `Excluded member ${updated.full_name}`,
      });
      return NextResponse.json({ member: updated });
    }

    const updated = mockDb.updateMember(id, { membership_status: "excluded" }, { mosque_slug: mosqueSlug });
    if (!updated) {
      return NextResponse.json({ error: "Member not found." }, { status: 404 });
    }
    return NextResponse.json({ member: updated });
  } catch (e) {
    console.error("Member DELETE error:", e);
    return NextResponse.json({ error: "Failed to remove member." }, { status: 500 });
  }
}
