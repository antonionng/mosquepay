import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import * as db from "@/lib/db";
import { getLodgeSlugFromRequest } from "@/lib/tenant";

export async function POST(request: NextRequest) {
  const stripeSecret = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecret) {
    return NextResponse.json(
      { error: "Payments are not configured." },
      { status: 503 }
    );
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Database not configured." },
      { status: 503 }
    );
  }

  try {
    const lodgeSlug = getLodgeSlugFromRequest(request);
    const lodgeId = await db.resolveLodgeId(lodgeSlug);
    if (!lodgeId) {
      return NextResponse.json({ error: "Lodge not found." }, { status: 404 });
    }

    const body = await request.json();
    const { dues_id, member_email, member_name, mode } = body;

    if (!dues_id || !member_email) {
      return NextResponse.json(
        { error: "dues_id and member_email are required." },
        { status: 400 }
      );
    }

    const allDues = await db.getMemberDues(lodgeId, { memberEmail: member_email });
    const duesRecord = allDues.find((d) => d.id === dues_id);
    if (!duesRecord) {
      return NextResponse.json({ error: "Dues record not found." }, { status: 404 });
    }

    if (duesRecord.status === "paid") {
      return NextResponse.json({ error: "Dues already paid." }, { status: 400 });
    }

    const Stripe = (await import("stripe")).default;
    const stripe = new Stripe(stripeSecret, { apiVersion: "2025-02-24.acacia" });
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

    if (mode === "subscription") {
      const lodgeDues = await db.getLodgeDues(lodgeId);
      const lodgeDuesConfig = lodgeDues[0];

      if (!lodgeDuesConfig?.allow_instalments) {
        return NextResponse.json(
          { error: "Instalment payments are not enabled for this lodge." },
          { status: 400 }
        );
      }

      const instalmentCount = lodgeDuesConfig.instalment_count ?? 12;
      const instalmentAmount = Math.round((duesRecord.amount / instalmentCount) * 100);
      const interval = lodgeDuesConfig.instalment_frequency === "quarterly" ? "month" : "month";
      const intervalCount = lodgeDuesConfig.instalment_frequency === "quarterly" ? 3 : 1;

      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency: duesRecord.currency,
              unit_amount: instalmentAmount,
              product_data: {
                name: `Lodge Dues Instalment — ${lodgeDuesConfig.name}`,
              },
              recurring: {
                interval: interval as "month",
                interval_count: intervalCount,
              },
            },
            quantity: 1,
          },
        ],
        subscription_data: {
          metadata: {
            lodge_slug: lodgeSlug,
            type: "dues_subscription",
            dues_id: duesRecord.id,
            member_email,
            member_name: member_name ?? "",
            total_amount: String(duesRecord.amount),
            instalment_count: String(instalmentCount),
          },
        },
        success_url: `${siteUrl}/member/dues?session_id={CHECKOUT_SESSION_ID}&type=dues_subscription`,
        cancel_url: `${siteUrl}/member/dues`,
        customer_email: member_email,
        metadata: {
          lodge_slug: lodgeSlug,
          type: "dues_subscription",
          dues_id: duesRecord.id,
          member_email,
        },
      });

      return NextResponse.json({ url: session.url });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: duesRecord.currency,
            unit_amount: Math.round(duesRecord.amount * 100),
            product_data: { name: `Lodge Dues — ${duesRecord.period_start} to ${duesRecord.period_end}` },
          },
          quantity: 1,
        },
      ],
      success_url: `${siteUrl}/events/rsvp/success?session_id={CHECKOUT_SESSION_ID}&type=dues`,
      cancel_url: `${siteUrl}`,
      customer_email: member_email,
      metadata: {
        lodge_slug: lodgeSlug,
        type: "dues",
        dues_id: duesRecord.id,
        member_email,
        member_name: member_name ?? "",
        amount: String(duesRecord.amount),
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (e) {
    console.error("Dues pay error:", e);
    return NextResponse.json(
      { error: "Could not create payment session." },
      { status: 500 }
    );
  }
}
