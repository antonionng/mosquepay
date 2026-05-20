// crud-audit:ignore
// One-shot guest checkout endpoint reached via a tokenised invitation link.
// Updates and deletions to the resulting guest/rsvp rows happen elsewhere.
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

  const stripeSecret = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecret) {
    return NextResponse.json(
      { error: "Payments are not configured for this lodge." },
      { status: 503 }
    );
  }

  const Stripe = (await import("stripe")).default;
  const stripe = new Stripe(stripeSecret, { apiVersion: "2025-02-24.acacia" });
  const siteUrl = siteUrlFor(args.request);

  type LineItem = {
    price_data: {
      currency: string;
      unit_amount: number;
      product_data: { name: string };
    };
    quantity: number;
  };
  const lineItems: LineItem[] = [];
  const currency = "gbp";

  if (args.meetingFee > 0) {
    lineItems.push({
      price_data: {
        currency,
        unit_amount: Math.round(args.meetingFee * 100),
        product_data: {
          name: event.meeting_fee_description ?? "Meeting fee",
        },
      },
      quantity: 1,
    });
  }
  if (args.diningTotal > 0) {
    lineItems.push({
      price_data: {
        currency,
        unit_amount: Math.round(args.diningTotal * 100),
        product_data: { name: "Dining" },
      },
      quantity: 1,
    });
  }
  if (args.charityAmount > 0) {
    lineItems.push({
      price_data: {
        currency,
        unit_amount: Math.round(args.charityAmount * 100),
        product_data: {
          name: event.charity_name
            ? `Donation: ${event.charity_name}`
            : "Charity donation",
        },
      },
      quantity: 1,
    });
  }

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: lineItems,
    customer_email: args.email ?? undefined,
    success_url: `${siteUrl}${lodgeScopedGuestSuccessPath(
      lodge?.slug ?? "lodge",
      args.token
    )}`,
    cancel_url: `${siteUrl}${lodgeScopedGuestPath(
      lodge?.slug ?? "lodge",
      args.token
    )}`,
    metadata: {
      type: "guest_invitation",
      lodge_slug: lodge?.slug ?? "",
      event_id: event.id,
      rsvp_id: rsvp.id,
      guest_invitation_id: invitation.id,
      guest_id: guestRecord.id,
      user_name: args.fullName,
      user_email: args.email ?? "",
      dining_total: String(args.diningTotal),
      meeting_fee: String(args.meetingFee),
      guest_total: "0",
      charity_amount: String(args.charityAmount),
      raffle_amount: "0",
      gift_aid: "false",
      standalone: "false",
    },
  });

  return NextResponse.json({ url: session.url });
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
