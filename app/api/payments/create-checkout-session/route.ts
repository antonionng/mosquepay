// POST /api/payments/create-checkout-session
//
// Member-side event RSVP checkout, fronting three forms:
//   * components/forms/event-rsvp-form.tsx   (full RSVP)
//   * components/forms/standalone-pay-form.tsx (pay-only, no RSVP)
//   * app/summons/[token]/rsvp-form.tsx        (summons-link RSVP)
//
// Payment surface: 100% Mooov (Mooov Connect -> hosted Stripe Checkout on
// the lodge's connected PSP). No direct Stripe SDK calls and no fallback,
// matching /api/donations (Phase 1) and /api/g/[token]/checkout (Phase 2).
//
// Mock-payment branch (mock_payment === true || ALLOW_MOCK_PAYMENTS) is
// retained for local development and E2E tests: it skips Mooov entirely,
// writes a synthetic public.payments row, and confirms the RSVP. Production
// has ALLOW_MOCK_PAYMENTS unset so the only way to opt in is to pass the
// flag explicitly from the client (also gated by the dev-only check below
// that requires NODE_ENV !== "production").
import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import { rejectIfMockDisabled } from "@/lib/db/reject-mock";
import * as db from "@/lib/db";
import * as mockDb from "@/lib/mock-db";
import { getDefaultLodgeSlug, getLodgeSlugFromRequest } from "@/lib/tenant";
import { resolveCheckoutFeesForMember } from "@/lib/fees/server-resolve";
import { createServiceClient } from "@/lib/supabase/server";
import { callMooovConnect, MooovApiError } from "@/lib/mooov";
import { sendWinePledgeConfirmationEmail } from "@/lib/email/wine-pledge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
  const _rejectMock = rejectIfMockDisabled();
  if (_rejectMock) return _rejectMock;

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
    raffle_wine_pledged,
    raffle_wine_bottles,
    raffle_wine_note,
    standalone,
    mock_payment,
  } = body;

  // Wine pledge is a non-cash side-effect of attending: only honoured when
  // the brother is actually saying "yes" and is not part of the cash total.
  // We clamp bottles for the same defence-in-depth reason as the
  // summons-access route.
  const winePledged =
    raffle_wine_pledged === true && attending_ceremony !== false;
  const wineBottles = winePledged
    ? Math.max(1, Math.min(20, Math.floor(Number(raffle_wine_bottles) || 1)))
    : 0;
  const wineNote =
    winePledged && typeof raffle_wine_note === "string"
      ? raffle_wine_note.trim().slice(0, 500) || null
      : null;

  const shouldMockPayment =
    process.env.NODE_ENV !== "production" &&
    (mock_payment === true || process.env.ALLOW_MOCK_PAYMENTS === "true");

  try {
    const lodgeSlug = getLodgeSlugFromRequest(request);
    const lodgeQuery =
      lodgeSlug === getDefaultLodgeSlug() ? "" : `?lodge=${encodeURIComponent(lodgeSlug)}`;

    const guestList = Array.isArray(guests)
      ? guests.filter(
          (g: { guest_name?: string }) =>
            g && typeof g.guest_name === "string" && g.guest_name.trim()
        )
      : [];

    let meetingFeeVal = meeting_fee ?? 0;
    let guestTotalVal = guest_total ?? 0;
    let diningTotalVal = dining_total ?? 0;

    if (isSupabaseConfigured()) {
      const lodgeId = await db.resolveLodgeId(lodgeSlug);
      if (lodgeId) {
        const event = await db.getEventById(event_id, lodgeId);
        if (event) {
          const resolved = await resolveCheckoutFeesForMember({
            lodgeId,
            event,
            memberEmail: String(user_email).trim().toLowerCase(),
            attendingCeremony: attending_ceremony !== false,
            attendingDining: attending_dining === true,
            guests: guestList.map((g: { guest_name: string }) => ({
              guest_name: g.guest_name.trim(),
            })),
          });
          meetingFeeVal = resolved.meetingFee;
          diningTotalVal = resolved.diningTotal;
          guestTotalVal = resolved.guestTotal;
        }
      }
    }

    const charityAmountVal = charity_amount ?? 0;
    const raffleAmountVal = raffle_amount ?? 0;
    const total =
      diningTotalVal + meetingFeeVal + guestTotalVal + charityAmountVal + raffleAmountVal;
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
        raffle_wine_pledged: winePledged,
        raffle_wine_bottles: wineBottles,
        raffle_wine_note: wineNote,
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
              email: null,
              phone: null,
              guest_id: null,
              guest_invitation_id: null,
              source: "member_party",
              welcome_email_sent_at: null,
            }))
          );
        }

        // Fire-and-forget wine pledge confirmation. Don't block checkout.
        if (winePledged && wineBottles > 0) {
          try {
            const [eventRow, lodge] = await Promise.all([
              db.getEventById(event_id, lodgeId),
              db.getLodgeById(lodgeId),
            ]);
            if (eventRow) {
              await sendWinePledgeConfirmationEmail({
                toEmail: user_email,
                toName: user_name ?? user_email,
                lodgeName: lodge?.name ?? "your lodge",
                eventTitle: eventRow.title,
                eventDate: eventRow.event_date,
                eventTime: eventRow.event_time,
                location: eventRow.location,
                bottles: wineBottles,
                note: wineNote,
              });
            }
          } catch (error) {
            console.error("Wine pledge email failed:", error);
          }
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

    if (shouldMockPayment) {
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
      const paymentData = {
        rsvp_id: rsvpId,
        event_id,
        user_email,
        user_name: user_name ?? null,
        stripe_payment_intent_id: `mock_pi_${Date.now()}`,
        stripe_charge_id: null,
        stripe_customer_id: null,
        dining_amount: diningTotalVal,
        charity_amount: charityAmountVal,
        raffle_amount: raffleAmountVal,
        meeting_fee_amount: meetingFeeVal,
        guest_ticket_amount: guestTotalVal,
        total_amount: total,
        currency: "GBP",
        charity_name: null,
        status: "succeeded",
        refund_amount: 0,
        refund_reason: null,
        completed_at: new Date().toISOString(),
      };

      if (isSupabaseConfigured()) {
        const lodgeId = await db.resolveLodgeId(lodgeSlug);
        if (!lodgeId) {
          return NextResponse.json({ error: "Lodge not found." }, { status: 404 });
        }
        const payment = await db.addPayment(lodgeId, paymentData);
        if (rsvpId) {
          await db.updateRsvp(rsvpId, lodgeId, {
            payment_id: payment.id,
            payment_completed: true,
            status: "confirmed",
          });
        }
        return NextResponse.json({
          url: `${siteUrl}/events/rsvp/success?mock=1${lodgeQuery ? `&lodge=${encodeURIComponent(lodgeSlug)}` : ""}`,
          mock: true,
          rsvp_id: rsvpId,
          payment_id: payment.id,
        });
      }

      const payment = mockDb.addPayment({ ...paymentData, lodge_slug: lodgeSlug });
      if (rsvpId) {
        mockDb.updateRsvp(
          rsvpId,
          { payment_id: payment.id, payment_completed: true, status: "confirmed" },
          { lodge_slug: lodgeSlug }
        );
      }
      return NextResponse.json({
        url: `${siteUrl}/events/rsvp/success?mock=1${lodgeQuery ? `&lodge=${encodeURIComponent(lodgeSlug)}` : ""}`,
        mock: true,
        rsvp_id: rsvpId,
        payment_id: payment.id,
      });
    }

    // Mooov path (production + non-mock dev). All five amount fields are
    // aggregated into a single Mooov charge; the split is preserved on
    // payment_attempts.guest_descriptor so the webhook handler can write
    // the LP payments row with the same per-bucket breakdown the legacy
    // Stripe handler used to populate.
    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        { error: "Payments are not configured." },
        { status: 503 }
      );
    }
    const lodgeId = await db.resolveLodgeId(lodgeSlug);
    if (!lodgeId) {
      return NextResponse.json({ error: "Lodge not found." }, { status: 404 });
    }

    let supa: ReturnType<typeof createServiceClient>;
    try {
      supa = createServiceClient();
    } catch (err) {
      console.error("checkout-session: supabase service client unavailable", {
        message: err instanceof Error ? err.message : String(err),
      });
      return NextResponse.json(
        { error: "Payments are not configured." },
        { status: 503 }
      );
    }

    let merchantId: string | null;
    try {
      merchantId = await loadMooovMerchant(supa, lodgeId);
    } catch (err) {
      console.error("checkout-session: mooov merchant lookup failed", {
        lodge_id: lodgeId,
        message: err instanceof Error ? err.message : String(err),
      });
      return NextResponse.json(
        { error: "Could not look up payment processor for this lodge." },
        { status: 500 }
      );
    }
    if (!merchantId) {
      return NextResponse.json(
        {
          error:
            "This lodge has not finished setting up online payments yet. Please contact the lodge directly.",
          code: "lodge_not_connected",
        },
        { status: 503 }
      );
    }

    const totalMinor = Math.round(total * 100);
    const currency = "GBP";
    const paymentId = `evt_${lodgeId}_${rsvpId ?? "standalone"}_${Date.now().toString(36)}`;
    const idempotencyKey = `evt_csk_${rsvpId ?? "standalone"}_${Date.now().toString(36)}`;
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
    const successUrl = `${siteUrl}/events/rsvp/success?payment_id=${encodeURIComponent(
      paymentId
    )}${lodgeQuery ? `&lodge=${encodeURIComponent(lodgeSlug)}` : ""}`;
    const cancelUrl = `${siteUrl}/events${lodgeQuery}`;
    const description = standalone
      ? `Standalone payment${user_name ? ` -- ${user_name}` : ""}`
      : `Event RSVP${user_name ? ` -- ${user_name}` : ""}`;

    const guestDescriptor: Record<string, unknown> = {
      source: standalone ? "event_standalone" : "event_rsvp",
      rsvp_id: rsvpId,
      event_id,
      lodge_slug: lodgeSlug,
      donor_email: user_email,
      donor_name: user_name ?? null,
      dining_total: diningTotalVal,
      meeting_fee: meetingFeeVal,
      charity_amount: charityAmountVal,
      raffle_amount: raffleAmountVal,
      guest_total: guestTotalVal,
      standalone: Boolean(standalone),
      gift_aid: Boolean(gift_aid),
      ...(gift_aid
        ? {
            gift_aid_donor_name: user_name ?? "",
            gift_aid_donor_email: user_email,
            gift_aid_address_line_1: gift_aid_address_line_1 ?? "",
            gift_aid_address_line_2: gift_aid_address_line_2 ?? "",
            gift_aid_city: gift_aid_city ?? "",
            gift_aid_postcode: gift_aid_postcode ?? "",
          }
        : {}),
    };
    const initialMetadata: Record<string, unknown> = {
      source: "lodgepay_event_checkout_session",
      lodge_slug: lodgeSlug,
      lodge_id: lodgeId,
      intent: "event",
      rsvp_id: rsvpId,
      event_id,
    };

    const { error: insertError } = await supa
      .schema("mooov")
      .from("payment_attempts")
      .insert({
        payment_id: paymentId,
        lodge_id: lodgeId,
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
      console.error("checkout-session: preflight insert failed", {
        lodge_id: lodgeId,
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
      // All four LP payment surfaces (this route, dues/pay, donations,
      // g/[token]/checkout) are on flow:"embedded" since the rollout on
      // 2026-05-26. hosted_url is https://pay.mooov.money/c/<payment_id>
      // (Mooov-branded page wrapping the Stripe Payment Element) instead of
      // https://checkout.stripe.com/... -- same response shape, same
      // webhook envelope, so the rest of this handler is unchanged.
      // checkout_session_id (cs_*) is persisted for audit / future PSP-side
      // dashboard lookups.
      const result = await callMooovConnect<{
        payment_id: string;
        state: "authorized" | "captured" | "processing" | "failed";
        provider?: { provider: string; provider_ref?: string; hosted_url?: string };
        checkout_session_id?: string;
      }>("POST", "/v1/payment_intents", {
        merchant: merchantId,
        idempotencyKey,
        body: {
          payment_id: paymentId,
          amount: totalMinor,
          currency,
          flow: "embedded",
          success_url: successUrl,
          cancel_url: cancelUrl,
          description,
          customer_email: user_email,
          metadata: {
            intent: "event",
            lodge_id: lodgeId,
            lodge_slug: lodgeSlug,
            rsvp_id: rsvpId ?? "",
            event_id,
            standalone: standalone ? "true" : "false",
          },
        },
      });

      const hostedUrl = result.provider?.hosted_url ?? null;
      if (!hostedUrl) {
        console.error("checkout-session: Mooov returned no hosted_url", {
          payment_id: paymentId,
          merchant_id: merchantId,
          state: result.state,
          provider: result.provider ?? null,
          full_response: result,
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
          metadata: {
            ...initialMetadata,
            hosted_url: hostedUrl,
            flow: "embedded",
            checkout_session_id: result.checkout_session_id ?? null,
          },
        })
        .eq("payment_id", paymentId);

      return NextResponse.json({ url: hostedUrl, payment_id: paymentId });
    } catch (err) {
      if (err instanceof MooovApiError) {
        console.error("checkout-session: Mooov call failed", {
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
          { error: "Could not create payment session.", code: err.category },
          { status: 502 }
        );
      }
      console.error("checkout-session: unexpected error", err);
      await supa
        .schema("mooov")
        .from("payment_attempts")
        .update({ status: "failed", failure_reason: "unexpected_error" })
        .eq("payment_id", paymentId);
      return NextResponse.json(
        { error: "Could not create payment session.", code: "unexpected_error" },
        { status: 500 }
      );
    }
  } catch (e) {
    console.error("checkout-session: outer error", e);
    return NextResponse.json(
      { error: "Could not create payment session." },
      { status: 500 }
    );
  }
}
