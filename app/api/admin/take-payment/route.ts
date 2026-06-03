// POST /api/admin/take-payment
//
// In-person "take a payment" flow for the Treasurer / duty officer. Mints a
// Mooov payment_intent for an arbitrary amount + description, returns the
// hosted_url so the iPad client can render it as a QR for a guest to scan.
//
// Auth: admin with payments:write on the active lodge.
// Persistence: writes a preflight mooov.payment_attempts row with
// intent='take_payment' so the Mooov webhook handler projects success into
// public.payments the same way it does for any other channel.

import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import * as db from "@/lib/db";
import { getAdminReadContext } from "@/lib/admin/read-context";
import { resolveTodaysMeetingId } from "@/lib/meetings/todays-meeting";
import { requireAdminApiAuth, requireAdminApiPermission } from "@/lib/auth/api";
import { getCurrentAdminContextAny } from "@/lib/auth/permissions";
import { createServiceClient } from "@/lib/supabase/server";
import { callMooovConnect, MooovApiError } from "@/lib/mooov";
import {
  resolveTakePaymentAttribution,
  type GuestInlineInput,
} from "@/lib/take-payment/resolve-attribution";
import {
  parseLineItems,
  lineItemsTotal,
  deriveLineItemsCategory,
  type ParsedLineItem,
} from "@/lib/take-payment/line-items";

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

interface PaymentIntentResponse {
  payment_id: string;
  state: "authorized" | "captured" | "processing" | "failed";
  provider?: {
    provider: string;
    provider_ref?: string;
    hosted_url?: string;
  };
  checkout_session_id?: string;
}

async function loadMooovMerchant(
  supa: ReturnType<typeof createServiceClient>,
  lodgeId: string,
): Promise<string | null> {
  const { data, error } = await supa
    .schema("mooov")
    .from("lodges")
    .select("merchant_id, status")
    .eq("id", lodgeId)
    .maybeSingle<{ merchant_id: string; status: string }>();
  if (error) throw error;
  if (!data) return null;
  if (data.status && data.status !== "active") return null;
  return data.merchant_id ?? null;
}

export async function POST(request: NextRequest) {
  const unauthorized = await requireAdminApiAuth();
  if (unauthorized) return unauthorized;

  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "In-person payments are not configured." },
      { status: 503 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  // Optional itemised basket. When present, the total to charge is the sum of
  // the line items (the top-level `amount` is ignored) and the QR splits into
  // raffle/charity/dining sub-totals once captured. See lib/take-payment.
  const parsedLineItems = parseLineItems(body.line_items);
  if (parsedLineItems.error) {
    return NextResponse.json({ error: parsedLineItems.error }, { status: 400 });
  }
  const lineItems: ParsedLineItem[] | null = parsedLineItems.items ?? null;
  const itemised = Array.isArray(lineItems) && lineItems.length > 0;

  const amount = itemised
    ? lineItemsTotal(lineItems as ParsedLineItem[])
    : Number(body.amount);
  const description =
    typeof body.description === "string" ? body.description.trim() : "";
  const reference =
    typeof body.reference === "string" ? body.reference.trim() : "";
  const category = itemised
    ? deriveLineItemsCategory(lineItems as ParsedLineItem[])
    : typeof body.category === "string"
      ? body.category.trim()
      : "general";
  const memberId =
    typeof body.member_id === "string" && body.member_id.trim()
      ? body.member_id.trim()
      : null;
  const guestId =
    typeof body.guest_id === "string" && body.guest_id.trim()
      ? body.guest_id.trim()
      : null;
  // Optional meeting attribution. When set, the webhook projector pulls this
  // out of metadata.event_id and writes payments.event_id so the meeting
  // detail page can roll it up.
  const eventIdInput =
    typeof body.event_id === "string" && body.event_id.trim()
      ? body.event_id.trim()
      : null;
  const guestInline = parseGuestInline(body.guest_inline);

  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json(
      { error: "A valid amount in pounds is required." },
      { status: 400 },
    );
  }
  if (amount > 5000) {
    // Soft ceiling — in-person hand-to-card payments rarely exceed this and
    // we want a tripwire against a fat-finger £45000 typed at reception.
    return NextResponse.json(
      { error: "Amounts above £5,000 cannot be taken on the in-person flow." },
      { status: 400 },
    );
  }

  // Use the admin's scoped lodge (same logic as the page) so a lodge-scoped
  // treasurer whose ADMIN_LODGE_COOKIE has not been set never mints a QR
  // against the wrong lodge -- they'd previously fall through to the
  // platform default lodge here and 401 on the permission check.
  const ctx = await getAdminReadContext();
  if (ctx.mode !== "database" || !ctx.lodgeId) {
    return NextResponse.json({ error: "Lodge not selected." }, { status: 404 });
  }
  const lodgeId = ctx.lodgeId;
  const lodgeSlug = ctx.lodgeSlug;

  const forbidden = await requireAdminApiPermission("payments:write", lodgeId);
  if (forbidden) return forbidden;

  // Validate any provided event_id is for this lodge. If the lookup throws
  // we treat it as non-fatal and proceed without an event link rather than
  // failing the QR mint outright.
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
      console.warn("Take payment POST: event lookup failed (non-fatal)", {
        lodge_id: lodgeId,
        event_id: eventIdInput,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }
  // No meeting chosen: if exactly one meeting is dated today, attribute the
  // takings to it so reconciliation rolls up cleanly without the treasurer
  // having to pick the event each time during a live meeting.
  if (!resolvedEventId) {
    resolvedEventId = await resolveTodaysMeetingId(lodgeId);
  }

  // Capture who is generating this QR so the history view can show
  // "created by Bro. Smith" and so audit trails attribute correctly.
  // Failure to resolve identity is non-fatal; the history just shows
  // "Admin" in that case.
  let createdByEmail: string | null = null;
  let createdByRole: string | null = null;
  try {
    const admin = await getCurrentAdminContextAny(lodgeId);
    createdByEmail = admin?.email ?? null;
    createdByRole = admin?.role ?? null;
  } catch (err) {
    console.warn("Take payment POST: could not resolve admin identity", {
      lodge_id: lodgeId,
      message: err instanceof Error ? err.message : String(err),
    });
  }

  let supa: ReturnType<typeof createServiceClient>;
  try {
    supa = createServiceClient();
  } catch (err) {
    console.error("Take payment POST: supabase service client unavailable", {
      message: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: "In-person payments are not configured." },
      { status: 503 },
    );
  }

  let merchantId: string | null;
  try {
    merchantId = await loadMooovMerchant(supa, lodgeId);
  } catch (err) {
    console.error("Take payment POST: mooov merchant lookup failed", {
      lodge_id: lodgeId,
      message: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: "Could not look up payment processor for this lodge." },
      { status: 500 },
    );
  }
  if (!merchantId) {
    return NextResponse.json(
      {
        error:
          "This lodge has not connected its payment processor yet. Visit Integrations to connect Mooov before taking in-person payments.",
        code: "lodge_not_connected",
      },
      { status: 503 },
    );
  }

  const amountMinor = Math.round(amount * 100);
  const currency = "GBP";
  const paymentId = `tip_${lodgeId}_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 10)}`;
  const idempotencyKey = `tip_${paymentId}`;

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  // Mooov redirects the *cardholder* (not the treasurer) to these URLs after
  // the hosted page closes, so both targets must be public and unprefixed by
  // /admin — otherwise the payer hits our auth proxy and gets bounced into a
  // login screen, or worse, a 404 if the route doesn't exist. The treasurer's
  // active-session card keeps polling the LP-side status independently.
  const successUrl = `${siteUrl}/take-payment/done?payment_id=${encodeURIComponent(paymentId)}`;
  const cancelUrl = `${siteUrl}/take-payment/cancelled?payment_id=${encodeURIComponent(paymentId)}`;
  const intentDescription = description || `Payment to lodge (${reference || "in-person"})`;

  // Payer attribution. Resolved up front so the downstream webhook projector
  // credits user_name / user_email correctly and we can auto-attach a Gift
  // Aid declaration when the payer has an active one on this lodge. Shared
  // with the cash endpoint; supports member, existing guest, and inline-new
  // guest (created via find-or-create on the guests directory).
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

  const initialMetadata: Record<string, unknown> = {
    source: "lodgepay_take_payment",
    lodge_slug: lodgeSlug,
    lodge_id: lodgeId,
    intent: "take_payment",
    category,
    line_items: itemised ? lineItems : null,
    reference: reference || null,
    description: intentDescription,
    created_by_email: createdByEmail,
    created_by_role: createdByRole,
    created_at_iso: new Date().toISOString(),
    member_id: resolvedMemberId,
    guest_id: resolvedGuestId,
    event_id: resolvedEventId,
    payer_name: payerName,
    payer_email: payerEmail,
    // Legacy aliases retained so the webhook projector + history endpoint
    // keep working unchanged for in-flight QR codes minted on the old shape.
    member_name: payerName,
    member_email: payerEmail,
    gift_aid_declaration_id: giftAidDeclarationId,
    gift_aid_eligible: giftAidEligible,
  };

  const { error: insertError } = await supa
    .schema("mooov")
    .from("payment_attempts")
    .insert({
      payment_id: paymentId,
      lodge_id: lodgeId,
      member_id: null,
      amount: amountMinor,
      currency,
      intent: "take_payment",
      status: "pending",
      idempotency_key: idempotencyKey,
      metadata: initialMetadata,
      guest_descriptor: {
        source: "in_person_take_payment",
        lodge_slug: lodgeSlug,
        reference: reference || null,
        category,
        line_items: itemised ? lineItems : null,
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
    console.error("Take payment POST: preflight insert failed", {
      lodge_id: lodgeId,
      payment_id: paymentId,
      code: insertError.code,
      message: insertError.message,
    });
    return NextResponse.json(
      { error: "Could not start the in-person payment." },
      { status: 500 },
    );
  }

  try {
    const result = await callMooovConnect<PaymentIntentResponse>(
      "POST",
      "/v1/payment_intents",
      {
        merchant: merchantId,
        idempotencyKey,
        body: {
          payment_id: paymentId,
          amount: amountMinor,
          currency,
          flow: "embedded",
          success_url: successUrl,
          cancel_url: cancelUrl,
          description: intentDescription,
          metadata: {
            intent: "take_payment",
            lodge_id: lodgeId,
            lodge_slug: lodgeSlug,
            category,
            reference: reference || undefined,
            event_id: resolvedEventId ?? undefined,
          },
        },
      },
    );

    const hostedUrl = result.provider?.hosted_url ?? null;
    if (!hostedUrl) {
      console.error("Take payment POST: Mooov returned no hosted_url", {
        payment_id: paymentId,
        merchant_id: merchantId,
        state: result.state,
        provider: result.provider ?? null,
        full_response: result,
      });
      return NextResponse.json(
        { error: "Payment processor did not return a checkout URL." },
        { status: 502 },
      );
    }

    const persistedMetadata: Record<string, unknown> = {
      ...initialMetadata,
      hosted_url: hostedUrl,
      flow: "embedded",
      checkout_session_id: result.checkout_session_id ?? null,
    };
    const { error: updateError } = await supa
      .schema("mooov")
      .from("payment_attempts")
      .update({
        status: result.state,
        provider_ref: result.provider?.provider_ref ?? null,
        metadata: persistedMetadata,
      })
      .eq("payment_id", paymentId);
    if (updateError) {
      console.error(
        "Take payment POST: post-mint update failed (will rely on webhook)",
        {
          payment_id: paymentId,
          code: updateError.code,
          message: updateError.message,
        },
      );
    }

    return NextResponse.json({
      url: hostedUrl,
      payment_id: paymentId,
      amount: amountMinor,
      currency,
      // Surface the resolved Gift Aid attribution so the client's success
      // screen knows immediately (at mint time) that this payer has an
      // active declaration, instead of waiting for the webhook projection
      // and falsely flashing "No Gift Aid declaration on file".
      gift_aid_eligible: giftAidEligible,
      gift_aid_declaration_id: giftAidDeclarationId,
    });
  } catch (err) {
    if (err instanceof MooovApiError) {
      console.error("Take payment POST: Mooov call failed", {
        payment_id: paymentId,
        category: err.category,
        status: err.status,
      });
      await supa
        .schema("mooov")
        .from("payment_attempts")
        .update({ status: "failed", failure_reason: err.category })
        .eq("payment_id", paymentId);
      if (err.category === "merchant_setup_required" && err.setupHint) {
        return NextResponse.json(
          {
            error:
              "This lodge has not finished setting up online payments yet.",
            code: "lodge_setup_incomplete",
            setup_url: err.setupHint.setupUrl,
          },
          { status: 503 },
        );
      }
      return NextResponse.json(
        { error: "Could not create payment session.", code: err.category },
        { status: 502 },
      );
    }
    console.error("Take payment POST unexpected error:", err);
    await supa
      .schema("mooov")
      .from("payment_attempts")
      .update({ status: "failed", failure_reason: "unexpected_error" })
      .eq("payment_id", paymentId);
    return NextResponse.json(
      { error: "Could not create payment session." },
      { status: 500 },
    );
  }
}
