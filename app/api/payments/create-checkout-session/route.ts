import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import * as db from "@/lib/db";
import * as mockDb from "@/lib/mock-db";
import { getDefaultLodgeSlug, getLodgeSlugFromRequest } from "@/lib/tenant";

export async function POST(request: NextRequest) {
  const stripeSecret = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecret) {
    return NextResponse.json(
      { error: "Payments are not configured. Please complete RSVP without payment or contact the lodge." },
      { status: 503 }
    );
  }

  try {
    const lodgeSlug = getLodgeSlugFromRequest(request);
    const lodgeQuery =
      lodgeSlug === getDefaultLodgeSlug() ? "" : `?lodge=${encodeURIComponent(lodgeSlug)}`;
    const body = await request.json();
    const {
      event_id,
      user_name,
      user_email,
      user_phone,
      attending_ceremony,
      attending_dining,
      number_of_guests,
      dietary_requirements,
      special_requests,
      dining_total,
      meeting_fee,
      guest_total,
      guests,
      charity_amount,
      raffle_amount,
      gift_aid,
      gift_aid_address_line_1,
      gift_aid_address_line_2,
      gift_aid_city,
      gift_aid_postcode,
      standalone,
    } = body;

    const meetingFeeVal = meeting_fee ?? 0;
    const guestTotalVal = guest_total ?? 0;
    const total = (dining_total ?? 0) + meetingFeeVal + guestTotalVal + (charity_amount ?? 0) + (raffle_amount ?? 0);
    if (!event_id || !user_email || total <= 0) {
      return NextResponse.json(
        { error: "Invalid payment request." },
        { status: 400 }
      );
    }

    let rsvpId: string | null = null;

    if (!standalone) {
      const rsvpData = {
        event_id,
        user_name: user_name ?? "",
        user_email,
        user_phone: user_phone ?? null,
        attending_ceremony: attending_ceremony !== false,
        attending_dining: attending_dining === true,
        number_of_guests: Math.min(10, Math.max(0, Number(number_of_guests) || 0)),
        dietary_requirements: dietary_requirements?.trim() ?? null,
        special_requests: special_requests?.trim() ?? null,
        payment_required: true,
        payment_completed: false,
        payment_id: null,
        status: "payment_pending",
      };

      if (isSupabaseConfigured()) {
        const lodgeId = await db.resolveLodgeId(lodgeSlug);
        if (!lodgeId) {
          return NextResponse.json({ error: "Lodge not found." }, { status: 404 });
        }
        const rsvp = await db.addRsvp(lodgeId, rsvpData);
        rsvpId = rsvp.id;

        if (Array.isArray(guests) && guests.length > 0) {
          await db.addEventGuests(
            lodgeId,
            guests.map((g: { guest_name: string; dietary_requirements?: string }) => ({
              rsvp_id: rsvpId,
              event_id,
              guest_name: g.guest_name,
              dietary_requirements: g.dietary_requirements?.trim() || null,
            }))
          );
        }
      } else {
        const rsvp = mockDb.addRsvp({ ...rsvpData, lodge_slug: lodgeSlug });
        rsvpId = rsvp.id;

        if (Array.isArray(guests) && guests.length > 0) {
          mockDb.addEventGuests(
            guests.map((g: { guest_name: string; dietary_requirements?: string }) => ({
              rsvp_id: rsvpId,
              event_id,
              guest_name: g.guest_name,
              dietary_requirements: g.dietary_requirements?.trim() || null,
            })),
            lodgeSlug
          );
        }
      }
    }

    const Stripe = (await import("stripe")).default;
    const stripe = new Stripe(stripeSecret, { apiVersion: "2025-02-24.acacia" });
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

    type LineItem = { price_data: { currency: string; unit_amount: number; product_data: { name: string } }; quantity: number };
    const lineItems: LineItem[] = [];

    if (meetingFeeVal > 0) {
      lineItems.push({
        price_data: {
          currency: "gbp",
          unit_amount: Math.round(meetingFeeVal * 100),
          product_data: { name: "Meeting fee" },
        },
        quantity: 1,
      });
    }
    if (dining_total > 0) {
      lineItems.push({
        price_data: {
          currency: "gbp",
          unit_amount: Math.round(dining_total * 100),
          product_data: { name: "Dining" },
        },
        quantity: 1,
      });
    }
    if (guestTotalVal > 0) {
      lineItems.push({
        price_data: {
          currency: "gbp",
          unit_amount: Math.round(guestTotalVal * 100),
          product_data: { name: `Guest tickets (${Array.isArray(guests) ? guests.length : 0})` },
        },
        quantity: 1,
      });
    }
    if (charity_amount > 0) {
      lineItems.push({
        price_data: {
          currency: "gbp",
          unit_amount: Math.round(charity_amount * 100),
          product_data: { name: "Charity donation" },
        },
        quantity: 1,
      });
    }
    if (raffle_amount > 0) {
      lineItems.push({
        price_data: {
          currency: "gbp",
          unit_amount: Math.round(raffle_amount * 100),
          product_data: { name: "Raffle contribution" },
        },
        quantity: 1,
      });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: lineItems,
      success_url: `${siteUrl}/events/rsvp/success?session_id={CHECKOUT_SESSION_ID}${
        lodgeQuery ? `&lodge=${encodeURIComponent(lodgeSlug)}` : ""
      }`,
      cancel_url: `${siteUrl}/events${lodgeQuery}`,
      customer_email: user_email,
      metadata: {
        lodge_slug: lodgeSlug,
        event_id,
        rsvp_id: rsvpId ?? "",
        user_name: user_name ?? "",
        standalone: standalone ? "true" : "false",
        dining_total: String(dining_total ?? 0),
        meeting_fee: String(meetingFeeVal),
        guest_total: String(guestTotalVal),
        charity_amount: String(charity_amount ?? 0),
        raffle_amount: String(raffle_amount ?? 0),
        gift_aid: gift_aid ? "true" : "false",
        gift_aid_donor_name: gift_aid ? (user_name ?? "") : "",
        gift_aid_donor_email: gift_aid ? (user_email ?? "") : "",
        gift_aid_address_line_1: gift_aid ? (gift_aid_address_line_1 ?? "") : "",
        gift_aid_address_line_2: gift_aid ? (gift_aid_address_line_2 ?? "") : "",
        gift_aid_city: gift_aid ? (gift_aid_city ?? "") : "",
        gift_aid_postcode: gift_aid ? (gift_aid_postcode ?? "") : "",
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (e) {
    console.error("Stripe session error:", e);
    return NextResponse.json(
      { error: "Could not create payment session." },
      { status: 500 }
    );
  }
}
