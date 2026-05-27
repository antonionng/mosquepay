// POST /api/admin/take-payment/cash
//
// Treasurer-recorded cash payment. Old masons still bring notes; this is the
// canonical place for the duty officer to log them so they hit the same
// ledger and Gift Aid reclaim flow as the QR/card payments without sitting
// on a paper sheet that gets lost between meetings.
//
// Persistence model mirrors the QR flow on purpose:
//   1. Insert a mooov.payment_attempts row with intent='take_payment_cash',
//      status='captured', captured_at=now(). Idempotency keyed on the
//      client_token the form generates so a double-tap is a no-op.
//   2. Insert public.payments via the shared projector. Sets
//      payment_method='cash', recorded_by_email=adminEmail, and runs the
//      same Gift Aid auto-logging when category=charity and the attributed
//      member has an active declaration.
//
// Auth: admin with payments:write on the active lodge.

import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import * as db from "@/lib/db";
import { getAdminReadContext } from "@/lib/admin/read-context";
import { requireAdminApiAuth, requireAdminApiPermission } from "@/lib/auth/api";
import { getCurrentAdminContextAny } from "@/lib/auth/permissions";
import { createServiceClient } from "@/lib/supabase/server";
import {
  resolveTakePaymentAttribution,
  type GuestInlineInput,
} from "@/lib/take-payment/resolve-attribution";
import { projectTakePaymentCaptured } from "@/lib/take-payment/project-captured";
import { sendTakePaymentReceipt } from "@/lib/email/take-payment-receipt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function trimOrNull(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseGuestInline(value: unknown): GuestInlineInput | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  const full_name = trimOrNull(v.full_name);
  if (!full_name) return null;
  return {
    full_name,
    email: trimOrNull(v.email),
    phone: trimOrNull(v.phone),
    mother_lodge_name: trimOrNull(v.mother_lodge_name),
    mother_lodge_number: trimOrNull(v.mother_lodge_number),
  };
}

export async function POST(request: NextRequest) {
  const unauthorized = await requireAdminApiAuth();
  if (unauthorized) return unauthorized;

  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Cash payments are not configured." },
      { status: 503 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const amount = Number(body.amount);
  const description =
    typeof body.description === "string" ? body.description.trim() : "";
  const reference =
    typeof body.reference === "string" ? body.reference.trim() : "";
  const category =
    typeof body.category === "string" ? body.category.trim() : "general";
  const memberId =
    typeof body.member_id === "string" && body.member_id.trim()
      ? body.member_id.trim()
      : null;
  const guestId =
    typeof body.guest_id === "string" && body.guest_id.trim()
      ? body.guest_id.trim()
      : null;
  // Optional meeting attribution. When set, the projected public.payments
  // row sets event_id so per-meeting "Money raised" totals see it. The
  // event itself is validated below (must belong to the active lodge).
  const eventIdInput =
    typeof body.event_id === "string" && body.event_id.trim()
      ? body.event_id.trim()
      : null;
  const guestInline = parseGuestInline(body.guest_inline);
  const clientToken =
    typeof body.client_token === "string" && body.client_token.trim()
      ? body.client_token.trim()
      : null;
  const note =
    typeof body.note === "string" ? body.note.trim() : "";

  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json(
      { error: "A valid amount in pounds is required." },
      { status: 400 },
    );
  }
  if (amount > 5000) {
    return NextResponse.json(
      { error: "Amounts above £5,000 cannot be recorded on the in-person flow." },
      { status: 400 },
    );
  }
  if (!clientToken) {
    return NextResponse.json(
      { error: "client_token is required (idempotency key)." },
      { status: 400 },
    );
  }

  // Anchor on the admin's scoped lodge (same logic as the page) so a
  // lodge-scoped treasurer whose ADMIN_LODGE_COOKIE has not been set
  // doesn't fall through to the platform default lodge and 401 here while
  // the page renders fine.
  const ctx = await getAdminReadContext();
  if (ctx.mode !== "database" || !ctx.lodgeId) {
    return NextResponse.json({ error: "Lodge not selected." }, { status: 404 });
  }
  const lodgeId = ctx.lodgeId;
  const lodgeSlug = ctx.lodgeSlug;

  const forbidden = await requireAdminApiPermission("payments:write", lodgeId);
  if (forbidden) return forbidden;

  // Validate any provided event_id is for this lodge before we accept it on
  // the projection. Anonymous payments (no event picked) are still fine.
  let resolvedEventId: string | null = null;
  if (eventIdInput) {
    try {
      const eventRow = await db.getEventById(eventIdInput, lodgeId);
      if (eventRow) {
        resolvedEventId = eventRow.id;
      } else {
        return NextResponse.json(
          { error: "Selected meeting not found in this lodge." },
          { status: 400 },
        );
      }
    } catch (err) {
      console.warn("Cash payment POST: event lookup failed (non-fatal)", {
        lodge_id: lodgeId,
        event_id: eventIdInput,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  let createdByEmail: string | null = null;
  let createdByRole: string | null = null;
  try {
    const admin = await getCurrentAdminContextAny(lodgeId);
    createdByEmail = admin?.email ?? null;
    createdByRole = admin?.role ?? null;
  } catch (err) {
    console.warn("Cash payment POST: could not resolve admin identity", {
      lodge_id: lodgeId,
      message: err instanceof Error ? err.message : String(err),
    });
  }

  let supa: ReturnType<typeof createServiceClient>;
  try {
    supa = createServiceClient();
  } catch (err) {
    console.error(
      "Cash payment POST: supabase service client unavailable",
      { message: err instanceof Error ? err.message : String(err) },
    );
    return NextResponse.json(
      { error: "Cash payments are not configured." },
      { status: 503 },
    );
  }

  // Idempotency: same admin retrying with the same client_token returns the
  // already-recorded row. payment_attempts has a (lodge_id, idempotency_key)
  // unique constraint so this is safe to call concurrently — at most one
  // attempt row exists per token.
  const idempotencyKey = `cash_${clientToken}`;
  const { data: dupe } = await supa
    .schema("mooov")
    .from("payment_attempts")
    .select("payment_id, status, amount, currency")
    .eq("lodge_id", lodgeId)
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle<{
      payment_id: string;
      status: string;
      amount: number;
      currency: string;
    }>();
  if (dupe) {
    return NextResponse.json(
      {
        payment_id: dupe.payment_id,
        amount: dupe.amount,
        currency: dupe.currency,
        idempotent: true,
      },
      { status: 200 },
    );
  }

  const attribution = await resolveTakePaymentAttribution(lodgeId, {
    memberId,
    guestId,
    guestInline,
  });
  const {
    memberId: resolvedMemberId,
    guestId: resolvedGuestId,
    payerName,
    payerEmail,
    giftAidDeclarationId,
    giftAidEligible,
  } = attribution;

  const amountMinor = Math.round(amount * 100);
  const currency = "GBP";
  const paymentId = `cash_${lodgeId}_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 10)}`;

  // Build a metadata block that mirrors the QR mint route so the history
  // endpoint can render cash rows with the same shape.
  const intentDescription =
    description || `Cash payment to lodge (${reference || "in-person"})`;
  const metadata: Record<string, unknown> = {
    source: "lodgepay_take_payment_cash",
    lodge_slug: lodgeSlug,
    lodge_id: lodgeId,
    intent: "take_payment_cash",
    category,
    reference: reference || null,
    description: intentDescription,
    note: note || null,
    method: "cash",
    created_by_email: createdByEmail,
    created_by_role: createdByRole,
    created_at_iso: new Date().toISOString(),
    member_id: resolvedMemberId,
    guest_id: resolvedGuestId,
    event_id: resolvedEventId,
    payer_name: payerName,
    payer_email: payerEmail,
    member_name: payerName,
    member_email: payerEmail,
    gift_aid_declaration_id: giftAidDeclarationId,
    gift_aid_eligible: giftAidEligible,
  };

  const capturedAt = new Date().toISOString();
  const { error: insertError } = await supa
    .schema("mooov")
    .from("payment_attempts")
    .insert({
      payment_id: paymentId,
      lodge_id: lodgeId,
      member_id: null,
      amount: amountMinor,
      currency,
      intent: "take_payment_cash",
      status: "captured",
      idempotency_key: idempotencyKey,
      captured_at: capturedAt,
      metadata,
      guest_descriptor: {
        source: "in_person_take_payment_cash",
        lodge_slug: lodgeSlug,
        reference: reference || null,
        category,
        member_id: resolvedMemberId,
        guest_id: resolvedGuestId,
        event_id: resolvedEventId,
        payer_name: payerName,
        payer_email: payerEmail,
        gift_aid_declaration_id: giftAidDeclarationId,
        gift_aid_eligible: giftAidEligible,
      },
    });
  if (insertError) {
    // Race against another concurrent submit with the same client_token. The
    // unique constraint on (lodge_id, idempotency_key) lets us recover by
    // returning the row that won.
    if (insertError.code === "23505") {
      const { data: existing } = await supa
        .schema("mooov")
        .from("payment_attempts")
        .select("payment_id, amount, currency")
        .eq("lodge_id", lodgeId)
        .eq("idempotency_key", idempotencyKey)
        .maybeSingle<{
          payment_id: string;
          amount: number;
          currency: string;
        }>();
      if (existing) {
        return NextResponse.json({
          payment_id: existing.payment_id,
          amount: existing.amount,
          currency: existing.currency,
          idempotent: true,
        });
      }
    }
    console.error("Cash payment POST: attempt insert failed", {
      lodge_id: lodgeId,
      payment_id: paymentId,
      code: insertError.code,
      message: insertError.message,
    });
    return NextResponse.json(
      { error: "Could not record the cash payment." },
      { status: 500 },
    );
  }

  // Project to public.payments + optional GA donation. Failures here would
  // leave a captured payment_attempts row without a ledger row — surface as
  // a 500 so the form can show the admin and they can retry (the retry uses
  // the same client_token and re-uses the existing attempt row).
  try {
    const projection = await projectTakePaymentCaptured({
      lodgeId,
      mooovPaymentId: paymentId,
      amountMajor: amount,
      currency,
      category,
      reference: reference || null,
      eventId: resolvedEventId,
      charityName: null,
      payerName,
      payerEmail,
      memberId: resolvedMemberId,
      guestId: resolvedGuestId,
      giftAidDeclarationId,
      giftAidEligible,
      paymentMethod: "cash",
      recordedByEmail: createdByEmail,
      paymentMethodNote: note || null,
      completedAt: capturedAt,
    });

    // Best-effort receipt. If the payer has an email on file, send a short
    // confirmation so the in-person handoff feels real (and so the audit
    // trail extends beyond the duty officer's notebook). Failures here are
    // logged but never block the API response — the cash is already in the
    // ledger, the email can be re-sent from the payment detail page.
    if (payerEmail) {
      try {
        await sendTakePaymentReceipt({
          toEmail: payerEmail,
          toName: payerName ?? "Friend of the lodge",
          amountMajor: amount,
          currency,
          category,
          reference: reference || null,
          description: intentDescription,
          paymentMethod: "cash",
          recordedByEmail: createdByEmail,
          giftAidEligible,
          lodgeId,
        });
      } catch (err) {
        console.warn("Cash payment POST: receipt email failed (non-fatal)", {
          payment_id: paymentId,
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return NextResponse.json({
      payment_id: paymentId,
      ledger_payment_id: projection.paymentId,
      donation_id: projection.donationId,
      amount: amountMinor,
      currency,
      payer_name: payerName,
      payer_email: payerEmail,
      gift_aid_eligible: giftAidEligible,
    });
  } catch (err) {
    console.error("Cash payment POST: projection failed", {
      lodge_id: lodgeId,
      payment_id: paymentId,
      message: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      {
        error:
          "Recorded the cash entry but the ledger did not update. Please retry; nothing duplicate will be created.",
      },
      { status: 500 },
    );
  }
}
