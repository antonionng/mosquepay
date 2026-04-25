import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import * as db from "@/lib/db";
import { getLodgeSlugFromRequest, getDefaultLodgeSlug } from "@/lib/tenant";

export async function GET(request: NextRequest) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ donations: [] });
    }

    const lodgeSlug = getLodgeSlugFromRequest(request);
    const lodgeId = await db.resolveLodgeId(lodgeSlug);
    if (!lodgeId) {
      return NextResponse.json({ error: "Lodge not found." }, { status: 404 });
    }

    const donations = await db.getDonations(lodgeId);
    return NextResponse.json({ donations });
  } catch (e) {
    console.error("Donations GET error:", e);
    return NextResponse.json(
      { error: "Failed to fetch donations." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const stripeSecret = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecret) {
    return NextResponse.json(
      { error: "Payments are not configured." },
      { status: 503 }
    );
  }

  try {
    const lodgeSlug = getLodgeSlugFromRequest(request);
    const body = await request.json();
    const {
      amount,
      donor_name,
      donor_email,
      gift_aid,
      gift_aid_confirmed,
      gift_aid_address_line_1,
      gift_aid_address_line_2,
      gift_aid_city,
      gift_aid_postcode,
    } = body;

    if (!donor_email || !amount || amount <= 0) {
      return NextResponse.json(
        { error: "Valid email and donation amount are required." },
        { status: 400 }
      );
    }

    if (gift_aid && (!gift_aid_confirmed || !gift_aid_address_line_1 || !gift_aid_city || !gift_aid_postcode)) {
      return NextResponse.json(
        { error: "Gift Aid requires confirmed eligibility and a full address." },
        { status: 400 }
      );
    }

    const Stripe = (await import("stripe")).default;
    const stripe = new Stripe(stripeSecret, { apiVersion: "2025-02-24.acacia" });
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
    const lodgeQuery =
      lodgeSlug === getDefaultLodgeSlug()
        ? ""
        : `&lodge=${encodeURIComponent(lodgeSlug)}`;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "gbp",
            unit_amount: Math.round(Number(amount) * 100),
            product_data: { name: "Donation" },
          },
          quantity: 1,
        },
      ],
      success_url: `${siteUrl}/events/rsvp/success?session_id={CHECKOUT_SESSION_ID}&type=donation${lodgeQuery}`,
      cancel_url: `${siteUrl}/donate${lodgeQuery ? `?lodge=${encodeURIComponent(lodgeSlug)}` : ""}`,
      customer_email: donor_email,
      metadata: {
        lodge_slug: lodgeSlug,
        type: "donation",
        donor_name: donor_name ?? "",
        donor_email,
        amount: String(amount),
        gift_aid: gift_aid ? "true" : "false",
        gift_aid_donor_name: gift_aid ? (donor_name ?? "") : "",
        gift_aid_donor_email: gift_aid ? donor_email : "",
        gift_aid_address_line_1: gift_aid ? (gift_aid_address_line_1 ?? "") : "",
        gift_aid_address_line_2: gift_aid ? (gift_aid_address_line_2 ?? "") : "",
        gift_aid_city: gift_aid ? (gift_aid_city ?? "") : "",
        gift_aid_postcode: gift_aid ? (gift_aid_postcode ?? "") : "",
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (e) {
    console.error("Donation POST error:", e);
    return NextResponse.json(
      { error: "Could not create donation session." },
      { status: 500 }
    );
  }
}
