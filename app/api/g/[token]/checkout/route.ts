// crud-audit:ignore
// One-shot guest checkout endpoint reached via a tokenised invitation link.
// Updates and deletions to the resulting guest/rsvp rows happen elsewhere.
//
// Payment surface: 100% Mooov (Mooov Connect -> hosted Stripe Checkout on
// the lodge's connected PSP). No direct Stripe SDK calls and no fallback.
// If the lodge has not connected Mooov the guest sees a 503 + clear copy
// and the RSVP is rolled back to payment_pending without a Stripe session.
import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured, shouldUseInMemoryMock } from "@/lib/db/with-fallback";
import { rejectIfMockDisabled } from "@/lib/db/reject-mock";
import * as db from "@/lib/db";
import * as mockDb from "@/lib/mock-db";
import { sendGuestWelcomeEmail } from "@/lib/email/guest";
import {
  lodgeScopedGuestPath,
  lodgeScopedGuestSuccessPath,
  lodgeScopedVisitorPath,
} from "@/lib/public-links";
import { createServiceClient } from "@/lib/supabase/server";
import { callMooovConnect, MooovApiError } from "@/lib/mooov";

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

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function siteUrlFor(request: NextRequest) {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ??
    request.nextUrl.origin ??
    "http://localhost:3000"
  ).replace(/\/$/, "");
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const _rejectMock = rejectIfMockDisabled();
  if (_rejectMock) return _rejectMock;

  try {
    const { token } = await params;
    const body = await request.json().catch(() => ({}));
    const fullName = String(body.full_name ?? "").trim();
    const email = String(body.email ?? "").trim() || null;
    const phone = String(body.phone ?? "").trim() || null;
    const motherLodgeName = String(body.mother_lodge_name ?? "").trim() || null;
    const motherLodgeNumber = String(body.mother_lodge_number ?? "").trim() || null;
    const constitution = String(body.constitution ?? "").trim() || null;
    const rank = String(body.rank ?? "").trim() || null;
    const partnerName = String(body.partner_name ?? "").trim() || null;
    const dietary = String(body.dietary_requirements ?? "").trim() || null;
    const attendingDining = body.attending_dining === true;
    const charityAmount = Math.max(0, Number(body.charity_amount ?? 0) || 0);
    const meetingFee = Math.max(0, Number(body.meeting_fee ?? 0) || 0);
    const diningTotal = Math.max(0, Number(body.dining_total ?? 0) || 0);

    if (!fullName) {
      return NextResponse.json(
        { error: "Your name is required." },
        { status: 400 }
      );
    }

    const tokenHash = hashToken(token);

    if (isSupabaseConfigured()) {
      return await handleDb({
        request,
        tokenHash,
        token,
        fullName,
        email,
        phone,
        motherLodgeName,
        motherLodgeNumber,
        constitution,
        rank,
        partnerName,
        dietary,
        attendingDining,
        charityAmount,
        meetingFee,
        diningTotal,
      });
    }

    if (!shouldUseInMemoryMock()) {
      return NextResponse.json({ error: "Database not configured." }, { status: 503 });
    }

    return await handleMock({
      request,
      tokenHash,
      fullName,
      email,
      phone,
      partnerName,
      dietary,
      attendingDining,
      charityAmount,
      meetingFee,
      diningTotal,
    });
  } catch (error) {
    console.error("Guest checkout error:", error);
    return NextResponse.json(
      { error: "Could not confirm your booking." },
      { status: 500 }
    );
  }
}

type DbArgs = {
  request: NextRequest;
  tokenHash: string;
  token: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  motherLodgeName: string | null;
  motherLodgeNumber: string | null;
  constitution: string | null;
  rank: string | null;
  partnerName: string | null;
  dietary: string | null;
  attendingDining: boolean;
  charityAmount: number;
  meetingFee: number;
  diningTotal: number;
};

async function handleDb(args: DbArgs) {
  const invitation = await db.getGuestInvitationByTokenHash(args.tokenHash);
  if (!invitation) {
    return NextResponse.json({ error: "Invitation not found." }, { status: 404 });
  }
  if (invitation.revoked_at) {
    return NextResponse.json({ error: "This invitation has been revoked." }, { status: 410 });
  }
  if (invitation.expires_at && new Date(invitation.expires_at) < new Date()) {
    return NextResponse.json({ error: "This invitation has expired." }, { status: 410 });
  }
  if (invitation.max_uses != null && invitation.uses >= invitation.max_uses) {
    return NextResponse.json({ error: "This invitation has reached its limit." }, { status: 410 });
  }

  const event = await db.getEventById(invitation.event_id, invitation.lodge_id);
  if (!event) {
    return NextResponse.json({ error: "Event no longer available." }, { status: 404 });
  }
  if (event.guest_policy === "closed") {
    return NextResponse.json({ error: "Guests are not accepted for this event." }, { status: 403 });
  }

  const lodge = await db.getLodgeById(invitation.lodge_id);

  const payerIsGuest = invitation.payer === "guest";
  const total = payerIsGuest
    ? args.meetingFee + args.diningTotal + args.charityAmount
    : args.charityAmount;

  const guestRecord = await db.upsertGuest(invitation.lodge_id, {
    full_name: args.fullName,
    email: args.email,
    phone: args.phone,
    mother_lodge_name: args.motherLodgeName,
    mother_lodge_number: args.motherLodgeNumber,
    constitution: args.constitution,
    rank: args.rank,
    dietary_requirements: args.dietary,
    is_mason: event.guest_policy === "blue_table",
    event_id: event.id,
    source: invitation.inviter_member_id ? "member_invite" : "self_invite_event",
  });

  let visitorPortalUrl: string | null = null;
  if (!guestRecord.visitor_token_hash) {
    const { generateVisitorToken, hashVisitorToken } = await import(
      "@/lib/guest-tokens"
    );
    const visitorToken = generateVisitorToken();
    await db.setGuestVisitorTokenHash(
      guestRecord.id,
      invitation.lodge_id,
      hashVisitorToken(visitorToken)
    );
    const origin = (
      process.env.NEXT_PUBLIC_SITE_URL ?? args.request.nextUrl.origin
    ).replace(/\/$/, "");
    visitorPortalUrl = `${origin}${lodgeScopedVisitorPath(
      lodge?.slug ?? "lodge",
      visitorToken
    )}`;
  }

  const rsvp = await db.addRsvp(invitation.lodge_id, {
    event_id: event.id,
    user_name: args.fullName,
    user_email: args.email ?? "",
    user_phone: args.phone,
    attending_ceremony: true,
    attending_dining: args.attendingDining,
    number_of_guests: args.partnerName ? 1 : 0,
    dietary_requirements: args.dietary,
    special_requests: null,
    payment_required: total > 0,
    payment_completed: total === 0,
    payment_id: null,
    status: total > 0 ? "payment_pending" : "confirmed",
  });

  await db.addEventGuests(invitation.lodge_id, [
    {
      rsvp_id: rsvp.id,
      event_id: event.id,
      guest_name: args.fullName,
      dietary_requirements: args.dietary,
      email: args.email,
      phone: args.phone,
      guest_id: guestRecord.id,
      guest_invitation_id: invitation.id,
      source: invitation.inviter_member_id ? "member_party" : "self_invite",
      welcome_email_sent_at: null,
    },
  ]);

  if (args.partnerName) {
    await db.addEventGuests(invitation.lodge_id, [
      {
        rsvp_id: rsvp.id,
        event_id: event.id,
        guest_name: args.partnerName,
        dietary_requirements: null,
        email: null,
        phone: null,
        guest_id: null,
        guest_invitation_id: invitation.id,
        source: invitation.inviter_member_id ? "member_party" : "self_invite",
        welcome_email_sent_at: null,
      },
    ]);
  }

  await db.recordGuestInvitationUse(invitation.id, invitation.uses);

  if (total === 0) {
    if (args.email) {
      await sendGuestWelcomeEmail({
        toEmail: args.email,
        toName: args.fullName,
        lodgeName: lodge?.name ?? "the lodge",
        eventTitle: event.title,
        eventDate: event.event_date,
        eventTime: event.event_time,
        location: event.location,
        dressCode: event.dress_code,
        visitorPortalUrl,
      }).catch((err) => console.error("Guest welcome email failed:", err));
    }
    return NextResponse.json({ ok: true, rsvp_id: rsvp.id });
  }

  let supa: ReturnType<typeof createServiceClient>;
  try {
    supa = createServiceClient();
  } catch (err) {
    console.error("guest checkout: supabase service client unavailable", {
      message: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: "Payments are not configured for this lodge." },
      { status: 503 }
    );
  }

  let merchantId: string | null;
  try {
    merchantId = await loadMooovMerchant(supa, invitation.lodge_id);
  } catch (err) {
    console.error("guest checkout: mooov merchant lookup failed", {
      lodge_id: invitation.lodge_id,
      message: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: "Could not look up payment processor for this lodge." },
      { status: 500 }
    );
  }
  if (!merchantId) {
    // The lodge has not finished Mooov Connect. The RSVP was already
    // persisted above with status='payment_pending'; we surface a 503 so
    // the public guest page can render a clear message and an admin can
    // complete onboarding before re-sharing the invite link.
    return NextResponse.json(
      {
        error:
          "This lodge has not finished setting up online payments yet. Please contact the lodge directly.",
        code: "lodge_not_connected",
      },
      { status: 503 }
    );
  }

  const siteUrl = siteUrlFor(args.request);
  // Mooov takes amount in minor units (pence). Aggregate the line items
  // (meeting_fee + dining + charity) into a single total -- Mooov's
  // hosted Stripe Checkout shows the description we pass plus the total.
  // We keep the split on payment_attempts.guest_descriptor so the Mooov
  // webhook handler can write the LP `payments` row with the same
  // breakdown the legacy Stripe webhook used to (dining_amount /
  // meeting_fee_amount / charity_amount on public.payments).
  const totalMinor = Math.round(
    (args.meetingFee + args.diningTotal + args.charityAmount) * 100
  );
  const currency = "GBP";
  const paymentId = `evt_${invitation.lodge_id}_${rsvp.id}_${Date.now().toString(36)}`;
  const idempotencyKey = `evt_rsvp_${rsvp.id}_${Date.now().toString(36)}`;
  const description = event.title
    ? `${event.title}${args.fullName ? ` -- ${args.fullName}` : ""}`
    : "Event booking";
  const lodgeSlug = lodge?.slug ?? "lodge";
  const successUrl = `${siteUrl}${lodgeScopedGuestSuccessPath(
    lodgeSlug,
    args.token
  )}`;
  const cancelUrl = `${siteUrl}${lodgeScopedGuestPath(lodgeSlug, args.token)}`;

  // guest_descriptor carries everything the Mooov webhook handler needs to
  // project this charge into LP-side rows when payment.captured arrives.
  // Mirrors the Stripe metadata bag the legacy webhook used to read.
  const guestDescriptor: Record<string, unknown> = {
    source: "event_guest",
    rsvp_id: rsvp.id,
    event_id: event.id,
    guest_id: guestRecord.id,
    guest_invitation_id: invitation.id,
    lodge_slug: lodgeSlug,
    donor_email: args.email,
    donor_name: args.fullName,
    dining_total: args.diningTotal,
    meeting_fee: args.meetingFee,
    charity_amount: args.charityAmount,
    guest_total: 0,
    raffle_amount: 0,
    standalone: false,
  };
  const initialMetadata: Record<string, unknown> = {
    source: "lodgepay_guest_checkout",
    lodge_slug: lodgeSlug,
    lodge_id: invitation.lodge_id,
    intent: "event",
    rsvp_id: rsvp.id,
    event_id: event.id,
  };
  const { error: insertError } = await supa
    .schema("mooov")
    .from("payment_attempts")
    .insert({
      payment_id: paymentId,
      lodge_id: invitation.lodge_id,
      member_id: null,
      amount: totalMinor,
      currency,
      intent: "event",
      status: "pending",
      idempotency_key: idempotencyKey,
      metadata: initialMetadata,
      guest_descriptor: guestDescriptor,
    });
  if (insertError) {
    console.error("guest checkout: preflight insert failed", {
      lodge_id: invitation.lodge_id,
      payment_id: paymentId,
      code: insertError.code,
      message: insertError.message,
    });
    return NextResponse.json(
      {
        error: "Could not start payment.",
        payment_id: paymentId,
        db_code: insertError.code ?? null,
      },
      { status: 500 }
    );
  }

  try {
    const result = await callMooovConnect<{
      payment_id: string;
      state: "authorized" | "captured" | "processing" | "failed";
      provider?: { provider: string; provider_ref?: string; hosted_url?: string };
    }>("POST", "/v1/payment_intents", {
      merchant: merchantId,
      idempotencyKey,
      body: {
        payment_id: paymentId,
        amount: totalMinor,
        currency,
        flow: "redirect",
        success_url: successUrl,
        cancel_url: cancelUrl,
        description,
        customer_email: args.email ?? undefined,
        metadata: {
          intent: "event",
          lodge_id: invitation.lodge_id,
          lodge_slug: lodgeSlug,
          rsvp_id: rsvp.id,
          event_id: event.id,
        },
      },
    });

    const hostedUrl = result.provider?.hosted_url ?? null;
    if (!hostedUrl) {
      console.error("guest checkout: Mooov returned no hosted_url", {
        payment_id: paymentId,
        state: result.state,
      });
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
        metadata: { ...initialMetadata, hosted_url: hostedUrl },
      })
      .eq("payment_id", paymentId);

    // Stash the Mooov payment_id on the rsvp so admin views can correlate
    // pending bookings to in-flight Mooov payments. payment_completed
    // stays false until the webhook fires.
    await db.updateRsvp(rsvp.id, invitation.lodge_id, {
      payment_id: paymentId,
    });

    return NextResponse.json({ url: hostedUrl, payment_id: paymentId });
  } catch (err) {
    if (err instanceof MooovApiError) {
      console.error("guest checkout: Mooov call failed", {
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
              "This lodge has not finished setting up online payments yet. Please contact the lodge directly.",
            code: "lodge_setup_incomplete",
            setup_url: err.setupHint.setupUrl,
          },
          { status: 503 }
        );
      }
      return NextResponse.json(
        { error: "Could not start payment.", code: err.category },
        { status: 502 }
      );
    }
    console.error("guest checkout: unexpected error", err);
    await supa
      .schema("mooov")
      .from("payment_attempts")
      .update({ status: "failed", failure_reason: "unexpected_error" })
      .eq("payment_id", paymentId);
    return NextResponse.json(
      { error: "Could not start payment." },
      { status: 500 }
    );
  }
}

type MockArgs = {
  request: NextRequest;
  tokenHash: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  partnerName: string | null;
  dietary: string | null;
  attendingDining: boolean;
  charityAmount: number;
  meetingFee: number;
  diningTotal: number;
};

async function handleMock(args: MockArgs) {
  const invitation = mockDb.getGuestInvitationByTokenHash(args.tokenHash);
  if (!invitation) {
    return NextResponse.json({ error: "Invitation not found." }, { status: 404 });
  }
  if (invitation.revoked_at) {
    return NextResponse.json({ error: "This invitation has been revoked." }, { status: 410 });
  }
  if (invitation.max_uses != null && invitation.uses >= invitation.max_uses) {
    return NextResponse.json({ error: "This invitation has reached its limit." }, { status: 410 });
  }

  const event = mockDb.getEventById(invitation.event_id, {
    lodge_slug: invitation.lodge_slug,
  });
  if (!event) {
    return NextResponse.json({ error: "Event no longer available." }, { status: 404 });
  }
  if (event.guest_policy === "closed") {
    return NextResponse.json({ error: "Guests are not accepted for this event." }, { status: 403 });
  }

  const guest = mockDb.upsertGuest({
    full_name: args.fullName,
    email: args.email,
    phone: args.phone,
    dietary_requirements: args.dietary,
    is_mason: event.guest_policy === "blue_table",
    event_id: event.id,
    source: invitation.inviter_member_id ? "member_invite" : "self_invite_event",
    lodge_slug: invitation.lodge_slug,
  });

  const total =
    invitation.payer === "guest"
      ? args.meetingFee + args.diningTotal + args.charityAmount
      : args.charityAmount;

  const rsvp = mockDb.addRsvp({
    event_id: event.id,
    user_name: args.fullName,
    user_email: args.email ?? "",
    user_phone: args.phone,
    attending_ceremony: true,
    attending_dining: args.attendingDining,
    number_of_guests: args.partnerName ? 1 : 0,
    dietary_requirements: args.dietary,
    special_requests: null,
    payment_required: total > 0,
    payment_completed: total === 0,
    payment_id: null,
    status: total > 0 ? "payment_pending" : "confirmed",
    lodge_slug: invitation.lodge_slug,
  });

  mockDb.addEventGuests(
    [
      {
        rsvp_id: rsvp.id,
        event_id: event.id,
        guest_name: args.fullName,
        dietary_requirements: args.dietary,
        email: args.email,
        phone: args.phone,
        guest_id: guest.id,
        guest_invitation_id: invitation.id,
        source: invitation.inviter_member_id ? "member_party" : "self_invite",
      },
    ],
    invitation.lodge_slug
  );
  if (args.partnerName) {
    mockDb.addEventGuests(
      [
        {
          rsvp_id: rsvp.id,
          event_id: event.id,
          guest_name: args.partnerName,
          dietary_requirements: null,
          email: null,
          phone: null,
          guest_id: null,
          guest_invitation_id: invitation.id,
          source: invitation.inviter_member_id ? "member_party" : "self_invite",
        },
      ],
      invitation.lodge_slug
    );
  }
  mockDb.recordGuestInvitationUse(invitation.id);

  return NextResponse.json({ ok: true, rsvp_id: rsvp.id });
}
