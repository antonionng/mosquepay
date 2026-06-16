// POST /api/admin/take-payment/advance-giving
//
// Admin entry point for "treasurer takes an advance-giving payment for a
// member at the desk". Supports two methods:
//
//   method="card_qr"  Mints a Mooov hosted Checkout against the resolved
//                     advance member_giving row. The cardholder taps the
//                     QR; on capture the existing /api/mooov-webhooks
//                     giving projector flips the giving row paid.
//
//   method="cash"     Records a cash payment_attempts row + projects the
//                     public.payments row + flips the advance giving row
//                     to paid in a single sweep.
//
// All "resolve next year + create advance member_giving" logic delegates to
// lib/giving/advance.ts, the same helper the member-portal pay-in-advance
// route uses.
//
// GET /api/admin/take-payment/advance-giving?member_id=...
// Returns a preview of the resolved next-year giving amount + discount,
// without creating any rows. Used by the dialog to show "we'll charge
// £X for the 2027 year".

import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import * as db from "@/lib/db";
import { getAdminReadContext } from "@/lib/admin/read-context";
import { requireAdminApiAuth, requireAdminApiPermission } from "@/lib/auth/api";
import { getCurrentAdminContextAny } from "@/lib/auth/permissions";
import { createServiceClient } from "@/lib/supabase/server";
import { callMooovConnect, MooovApiError } from "@/lib/mooov";
import { projectTakePaymentCaptured } from "@/lib/take-payment/project-captured";
import { writeAuditLog } from "@/lib/audit";
import {
  checkAdvanceEligibility,
  resolveOrCreateAdvanceGiving,
} from "@/lib/giving/advance";
import { nextYearBounds } from "@/lib/giving/year-position";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// GET — preview the advance giving amount without writing anything
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const unauthorized = await requireAdminApiAuth();
  if (unauthorized) return unauthorized;

  const ctx = await getAdminReadContext();
  if (ctx.mode !== "database" || !ctx.mosqueId) {
    return NextResponse.json({ error: "Mosque not selected." }, { status: 404 });
  }
  const mosqueId = ctx.mosqueId;
  const forbidden = await requireAdminApiPermission("payments:write", mosqueId);
  if (forbidden) return forbidden;

  const memberId = new URL(request.url).searchParams.get("member_id");
  if (!memberId) {
    return NextResponse.json(
      { error: "member_id is required." },
      { status: 400 }
    );
  }
  const member = await db.getMemberById(memberId, mosqueId);
  if (!member) {
    return NextResponse.json(
      { error: "Member not found." },
      { status: 404 }
    );
  }
  const eligibility = await checkAdvanceEligibility(mosqueId, member);
  if (!eligibility.ok) {
    return NextResponse.json(
      {
        eligible: false,
        code: eligibility.code,
        message: eligibility.message,
      },
      { status: 200 }
    );
  }

  // Compute amounts WITHOUT mutating state. Mirrors the resolve helper
  // up to the point of insert.
  const currentYear = await db.getCurrentMosqueYear(mosqueId);
  if (!currentYear) {
    return NextResponse.json({
      eligible: false,
      code: "no_giving_year",
      message: "Mosque has no current giving year configured.",
    });
  }
  const allYears = await db.listMosqueGivingYears(mosqueId);
  const next = allYears.find(
    (y) => y.start_date.slice(0, 10) > currentYear.end_date.slice(0, 10)
  );
  const nextLabel = next
    ? next.label
    : nextYearBounds(currentYear.start_date, currentYear.end_date).label;
  const mosqueGiving = (await db.getMosqueGiving(mosqueId))[0] ?? null;
  const baseAmount =
    next?.annual_giving_amount ??
    mosqueGiving?.amount ??
    currentYear.annual_giving_amount ??
    0;
  const discountPct = mosqueGiving?.advance_discount_percent ?? 0;
  const chargedAmount =
    Math.round(baseAmount * (1 - discountPct / 100) * 100) / 100;

  // Already prepaid?
  const memberGiving = await db.getMemberGiving(mosqueId, {
    memberEmail: member.email,
  });
  const existing = memberGiving.find(
    (d) =>
      d.is_advance &&
      next != null &&
      d.advance_for_year_id === next.id
  );

  return NextResponse.json({
    eligible: true,
    member: {
      id: member.id,
      full_name: member.full_name,
      email: member.email,
    },
    next_year_label: nextLabel,
    base_amount: baseAmount,
    discount_percent: discountPct,
    charged_amount: chargedAmount,
    currency: (mosqueGiving?.currency ?? "gbp").toUpperCase(),
    already_prepaid: existing != null,
    existing_giving_id: existing?.id ?? null,
  });
}

// ---------------------------------------------------------------------------
// POST — resolve giving row and either mint a Mooov QR or record cash
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const unauthorized = await requireAdminApiAuth();
  if (unauthorized) return unauthorized;

  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Database not configured." },
      { status: 503 }
    );
  }

  const ctx = await getAdminReadContext();
  if (ctx.mode !== "database" || !ctx.mosqueId) {
    return NextResponse.json({ error: "Mosque not selected." }, { status: 404 });
  }
  const mosqueId = ctx.mosqueId;
  const mosqueSlug = ctx.mosqueSlug;
  const forbidden = await requireAdminApiPermission("payments:write", mosqueId);
  if (forbidden) return forbidden;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const memberId = typeof body.member_id === "string" ? body.member_id : null;
  const method = typeof body.method === "string" ? body.method : null;
  const clientToken =
    typeof body.client_token === "string" ? body.client_token : null;
  const amountOverride =
    typeof body.amount === "number" && body.amount > 0
      ? Number(body.amount)
      : undefined;
  const note = typeof body.note === "string" ? body.note.trim() : "";

  if (!memberId) {
    return NextResponse.json(
      { error: "member_id is required." },
      { status: 400 }
    );
  }
  if (method !== "cash" && method !== "card_qr") {
    return NextResponse.json(
      { error: "method must be 'cash' or 'card_qr'." },
      { status: 400 }
    );
  }
  if (!clientToken) {
    return NextResponse.json(
      { error: "client_token is required (idempotency key)." },
      { status: 400 }
    );
  }

  const member = await db.getMemberById(memberId, mosqueId);
  if (!member) {
    return NextResponse.json(
      { error: "Member not found." },
      { status: 404 }
    );
  }

  const eligibility = await checkAdvanceEligibility(mosqueId, member);
  if (!eligibility.ok) {
    return NextResponse.json(
      { error: eligibility.message, code: eligibility.code },
      { status: 409 }
    );
  }

  const resolved = await resolveOrCreateAdvanceGiving({
    mosqueId,
    member,
    amountOverride,
  });

  if (!resolved.already_existed) {
    await writeAuditLog({
      mosqueId,
      action: "advance_giving_created",
      entityType: "giving",
      entityId: resolved.member_giving_id,
      summary: `Advance giving created at desk for ${member.email} (${resolved.next_year_label})`,
      metadata: {
        next_year_label: resolved.next_year_label,
        base_amount: resolved.base_amount,
        discount_percent: resolved.discount_percent,
        charged_amount: resolved.charged_amount,
        source: "admin_take_payment",
        method,
      },
    });
  }

  if (method === "card_qr") {
    return await mintCardQrForAdvanceGiving({
      mosqueId,
      mosqueSlug,
      member,
      resolvedAmount: resolved.charged_amount,
      currency: resolved.currency,
      givingId: resolved.member_giving_id,
      nextYearLabel: resolved.next_year_label,
      clientToken,
    });
  }

  return await recordCashForAdvanceGiving({
    mosqueId,
    mosqueSlug,
    member,
    resolved,
    clientToken,
    note,
  });
}

// ---------------------------------------------------------------------------
// card_qr: hosted Mooov Checkout against the resolved advance giving row.
// Webhook handler's existing giving projector flips the giving row paid on
// payment.captured because the body sets intent="giving" + giving_id.
// ---------------------------------------------------------------------------

async function mintCardQrForAdvanceGiving(args: {
  mosqueId: string;
  mosqueSlug: string;
  member: NonNullable<Awaited<ReturnType<typeof db.getMemberById>>>;
  resolvedAmount: number;
  currency: string;
  givingId: string;
  nextYearLabel: string;
  clientToken: string;
}): Promise<NextResponse> {
  const supa = createServiceClient();
  const { data: merchantRow } = await supa
    .schema("mooov")
    .from("mosques")
    .select("merchant_id, status")
    .eq("id", args.mosqueId)
    .maybeSingle<{ merchant_id: string; status: string }>();
  if (
    !merchantRow ||
    !merchantRow.merchant_id ||
    (merchantRow.status && merchantRow.status !== "active")
  ) {
    return NextResponse.json(
      {
        error: "This mosque has not finished setting up online payments yet.",
        code: "mosque_not_connected",
      },
      { status: 503 }
    );
  }

  const idempotencyKey = `advance_qr_${args.clientToken}`;
  const { data: dupe } = await supa
    .schema("mooov")
    .from("payment_attempts")
    .select("payment_id, metadata")
    .eq("mosque_id", args.mosqueId)
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle<{
      payment_id: string;
      metadata: Record<string, unknown> | null;
    }>();
  if (dupe?.metadata && typeof dupe.metadata.hosted_url === "string") {
    return NextResponse.json({
      url: dupe.metadata.hosted_url,
      payment_id: dupe.payment_id,
      giving_id: args.givingId,
      amount: args.resolvedAmount,
      currency: args.currency.toUpperCase(),
      idempotent: true,
    });
  }

  const amountMinor = Math.round(args.resolvedAmount * 100);
  const currency = args.currency.toUpperCase();
  const paymentId = `pay_giving_advance_${args.givingId}_${Date.now().toString(36)}`;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const successUrl = `${siteUrl}/take-payment/done?payment_id=${encodeURIComponent(paymentId)}`;
  const cancelUrl = `${siteUrl}/admin/take-payment`;
  const description = `Advance giving — ${args.nextYearLabel}`;

  const guestDescriptor: Record<string, unknown> = {
    source: "admin_take_payment_advance_giving",
    giving_id: args.givingId,
    member_id: args.member.id,
    mosque_slug: args.mosqueSlug,
    donor_email: args.member.email,
    donor_name: args.member.full_name,
    next_year_label: args.nextYearLabel,
    is_advance: true,
    charitable_amount: 0,
  };

  const initialMetadata: Record<string, unknown> = {
    source: "mosquepay_admin_take_payment_advance_giving",
    mosque_slug: args.mosqueSlug,
    mosque_id: args.mosqueId,
    intent: "giving",
    giving_id: args.givingId,
    is_advance: true,
    next_year_label: args.nextYearLabel,
  };

  const { error: insertError } = await supa
    .schema("mooov")
    .from("payment_attempts")
    .insert({
      payment_id: paymentId,
      mosque_id: args.mosqueId,
      member_id: null,
      amount: amountMinor,
      currency,
      intent: "giving",
      status: "pending",
      idempotency_key: idempotencyKey,
      metadata: initialMetadata,
      guest_descriptor: guestDescriptor,
    });
  if (insertError) {
    console.error("advance giving qr mint: payment_attempts insert failed", {
      mosque_id: args.mosqueId,
      payment_id: paymentId,
      message: insertError.message,
      code: insertError.code,
    });
    return NextResponse.json(
      { error: "Could not start advance payment." },
      { status: 500 }
    );
  }

  try {
    const result = await callMooovConnect<{
      payment_id: string;
      state: string;
      provider?: { provider: string; provider_ref?: string; hosted_url?: string };
    }>("POST", "/v1/payment_intents", {
      merchant: merchantRow.merchant_id,
      idempotencyKey,
      body: {
        payment_id: paymentId,
        amount: amountMinor,
        currency,
        flow: "redirect",
        success_url: successUrl,
        cancel_url: cancelUrl,
        description,
        customer_email: args.member.email,
        metadata: {
          intent: "giving",
          source: "admin_take_payment_advance_giving",
          giving_id: args.givingId,
          mosque_slug: args.mosqueSlug,
          next_year_label: args.nextYearLabel,
          is_advance: "true",
        },
      },
    });

    const hostedUrl = result.provider?.hosted_url ?? null;
    if (!hostedUrl) {
      return NextResponse.json(
        { error: "Payment processor did not return a checkout URL." },
        { status: 502 }
      );
    }

    await supa
      .schema("mooov")
      .from("payment_attempts")
      .update({
        status: result.state,
        provider_ref: result.provider?.provider_ref ?? null,
        metadata: {
          ...initialMetadata,
          hosted_url: hostedUrl,
          flow: "redirect",
        },
      })
      .eq("payment_id", paymentId);

    return NextResponse.json({
      url: hostedUrl,
      payment_id: paymentId,
      giving_id: args.givingId,
      amount: args.resolvedAmount,
      currency,
    });
  } catch (err) {
    if (err instanceof MooovApiError) {
      console.error("advance giving qr mint: Mooov call failed", {
        payment_id: paymentId,
        status: err.status,
        category: err.category,
      });
      await supa
        .schema("mooov")
        .from("payment_attempts")
        .update({ status: "failed", failure_reason: err.category })
        .eq("payment_id", paymentId);
      return NextResponse.json(
        {
          error: "Could not create payment session.",
          code: err.category,
        },
        { status: 502 }
      );
    }
    throw err;
  }
}

// ---------------------------------------------------------------------------
// cash: payment_attempts(captured) + project payments + flip giving paid
// ---------------------------------------------------------------------------

async function recordCashForAdvanceGiving(args: {
  mosqueId: string;
  mosqueSlug: string;
  member: NonNullable<Awaited<ReturnType<typeof db.getMemberById>>>;
  resolved: Awaited<ReturnType<typeof resolveOrCreateAdvanceGiving>>;
  clientToken: string;
  note: string;
}): Promise<NextResponse> {
  const { mosqueId, mosqueSlug, member, resolved } = args;
  const supa = createServiceClient();

  const idempotencyKey = `advance_cash_${args.clientToken}`;
  const { data: dupe } = await supa
    .schema("mooov")
    .from("payment_attempts")
    .select("payment_id, amount, currency")
    .eq("mosque_id", mosqueId)
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle<{
      payment_id: string;
      amount: number;
      currency: string;
    }>();
  if (dupe) {
    return NextResponse.json({
      payment_id: dupe.payment_id,
      giving_id: resolved.member_giving_id,
      amount: dupe.amount,
      currency: dupe.currency,
      idempotent: true,
      method: "cash",
    });
  }

  let createdByEmail: string | null = null;
  let createdByRole: string | null = null;
  try {
    const admin = await getCurrentAdminContextAny(mosqueId);
    createdByEmail = admin?.email ?? null;
    createdByRole = admin?.role ?? null;
  } catch (err) {
    console.warn("advance giving cash: admin identity unresolved", {
      message: err instanceof Error ? err.message : String(err),
    });
  }

  const amountMinor = Math.round(resolved.charged_amount * 100);
  const currency = resolved.currency.toUpperCase();
  const paymentId = `cash_advance_${mosqueId}_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 10)}`;
  const description = `Advance giving — ${resolved.next_year_label}`;
  const capturedAt = new Date().toISOString();

  const metadata: Record<string, unknown> = {
    source: "mosquepay_admin_take_payment_advance_giving_cash",
    mosque_slug: mosqueSlug,
    mosque_id: mosqueId,
    intent: "giving",
    is_advance: true,
    next_year_label: resolved.next_year_label,
    giving_id: resolved.member_giving_id,
    member_id: member.id,
    member_name: member.full_name,
    member_email: member.email,
    method: "cash",
    note: args.note || null,
    description,
    created_by_email: createdByEmail,
    created_by_role: createdByRole,
    created_at_iso: capturedAt,
  };

  const { error: insertError } = await supa
    .schema("mooov")
    .from("payment_attempts")
    .insert({
      payment_id: paymentId,
      mosque_id: mosqueId,
      member_id: null,
      amount: amountMinor,
      currency,
      intent: "giving",
      status: "captured",
      idempotency_key: idempotencyKey,
      captured_at: capturedAt,
      metadata,
      guest_descriptor: {
        source: "admin_take_payment_advance_giving_cash",
        mosque_slug: mosqueSlug,
        giving_id: resolved.member_giving_id,
        member_id: member.id,
        donor_email: member.email,
        donor_name: member.full_name,
        is_advance: true,
        next_year_label: resolved.next_year_label,
      },
    });
  if (insertError) {
    console.error("advance giving cash: attempt insert failed", {
      mosque_id: mosqueId,
      message: insertError.message,
      code: insertError.code,
    });
    return NextResponse.json(
      { error: "Could not record cash payment." },
      { status: 500 }
    );
  }

  // Project the public.payments row + Gift Aid donation if the mosque
  // has a charitable portion + active declaration.
  const giftAidRefused = member.gift_aid_consent_status === "declined";
  const declaration = giftAidRefused
    ? null
    : await db.getActiveGiftAidDeclarationByEmail(mosqueId, member.email);
  const projection = await projectTakePaymentCaptured({
    mosqueId,
    mooovPaymentId: paymentId,
    amountMajor: resolved.charged_amount,
    currency,
    category: "subscriptions",
    reference: `Advance giving ${resolved.next_year_label}`,
    eventId: null,
    charityName: null,
    payerName: member.full_name,
    payerEmail: member.email,
    memberId: member.id,
    guestId: null,
    giftAidDeclarationId: declaration?.id ?? null,
    giftAidEligible: declaration != null,
    giftAidRefused,
    completedAt: capturedAt,
    paymentMethod: "cash",
    recordedByEmail: createdByEmail,
  });

  // Flip the advance giving row to paid.
  await db.updateMemberGivingStatus(resolved.member_giving_id, mosqueId, {
    status: "paid",
    payment_id: projection.paymentId,
    paid_at: capturedAt,
  });

  return NextResponse.json({
    payment_id: paymentId,
    ledger_payment_id: projection.paymentId,
    giving_id: resolved.member_giving_id,
    amount: amountMinor,
    currency,
    payer_name: member.full_name,
    payer_email: member.email,
    method: "cash",
    next_year_label: resolved.next_year_label,
    gift_aid_eligible: declaration != null,
  });
}
