// GET /give/<slug>/<context>?amount=N&event=<event_id>
//
// Dynamic resolver for standing-QR donation / dining links. Two modes:
//
//   1. No `amount` search-param: render an LP-branded amount-selection page
//      with preset buttons (each a link to `?amount=N`). Works without JS,
//      so it's printable-sticker safe and survives every mobile browser.
//
//   2. With `amount`: mint a Mooov payment_intent via flow:"embedded" with
//      the right metadata (event_id, campaign_id, intent, lodge_slug),
//      then 302 the donor straight to pay.mooov.money/c/<id> for them to
//      pay with Apple Pay / Google Pay / card.
//
// Supported contexts:
//   - charity: defaults to the lodge's current_charity_campaign_id; falls
//     back to a generic donation if no campaign is designated. If an event
//     id is provided and has enable_charity_donation=true, presets come
//     from the event's charity_suggested_amounts.
//   - raffle: requires event_id; presets come from raffle_suggested_amounts.
//   - dining: requires event_id; single preset = dining_price.
//   - general: generic lodge payment (no campaign/event linkage).

import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Heart, Sparkles, Utensils, Banknote, ShieldCheck } from "lucide-react";
import { createServiceClient } from "@/lib/supabase/server";
import { callMooovConnect, MooovApiError } from "@/lib/mooov";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Context = "charity" | "raffle" | "dining" | "general";

const VALID_CONTEXTS: Context[] = ["charity", "raffle", "dining", "general"];

const DEFAULT_PRESETS: Record<Context, number[]> = {
  charity: [10, 20, 50, 100],
  raffle: [5, 10, 20, 50],
  dining: [],
  general: [5, 10, 20, 50],
};

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

type ResolvedContext = {
  intent: string;
  presetAmounts: number[];
  campaignId: string | null;
  eventId: string | null;
  description: string;
  heading: string;
  subheading: string;
  customAllowed: boolean;
};

export default async function GivePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; context: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug, context } = await params;
  const search = await searchParams;

  if (!VALID_CONTEXTS.includes(context as Context)) {
    return <NotFoundPage reason="Unknown link type." />;
  }
  const ctx = context as Context;

  const lodge = await loadLodge(slug);
  if (!lodge) {
    return <NotFoundPage reason="We couldn't find a lodge at this address." />;
  }

  const merchantId = await loadMerchantId(lodge.id);
  if (!merchantId) {
    return (
      <NotFoundPage reason="This lodge has not connected its payment processor yet. Please ask the lodge secretary to complete setup." />
    );
  }

  const eventId =
    typeof search.event === "string" ? search.event : null;
  const resolved = await resolveContext({
    context: ctx,
    lodgeId: lodge.id,
    eventId,
    currentCharityCampaignId: lodge.current_charity_campaign_id ?? null,
  });

  const amountParam = firstParam(search.amount);
  const amountNumber = amountParam ? Number(amountParam) : NaN;
  const hasAmount =
    amountParam !== null &&
    Number.isFinite(amountNumber) &&
    amountNumber > 0;

  if (hasAmount) {
    if (amountNumber > 5000) {
      return (
        <NotFoundPage reason="Amounts above £5,000 cannot be taken on the standing-QR flow. Please contact the lodge directly." />
      );
    }

    const hostedUrl = await mintAndGetHostedUrl({
      lodgeId: lodge.id,
      lodgeSlug: slug,
      merchantId,
      amountPounds: amountNumber,
      resolved,
    });

    if (hostedUrl === null) {
      return (
        <NotFoundPage reason="The payment processor is temporarily unavailable. Please try again in a moment." />
      );
    }

    // For external Mooov URLs we use a direct redirect so the donor lands on
    // pay.mooov.money in one hop (no Next.js client-side router involved).
    redirect(hostedUrl);
  }

  return (
    <Suspense>
      <SelectionPage
        slug={slug}
        context={ctx}
        lodgeName={lodge.name}
        eventId={eventId}
        resolved={resolved}
      />
    </Suspense>
  );
}

function firstParam(v: string | string[] | undefined): string | null {
  if (!v) return null;
  if (Array.isArray(v)) return v[0] ?? null;
  return v;
}

async function loadLodge(slug: string) {
  const normalized = slug.trim().toLowerCase();
  try {
    const { data, error } = await createServiceClient()
      .from("lodges")
      .select("id, slug, name, current_charity_campaign_id")
      .eq("slug", normalized)
      .eq("is_active", true)
      .maybeSingle<{
        id: string;
        slug: string;
        name: string;
        current_charity_campaign_id: string | null;
      }>();
    if (error) {
      // Log loudly: a schema-drift or RLS misconfiguration here turns a
      // perfectly valid sticker URL into a generic "lodge not found" page,
      // which is the least debuggable failure mode for the donor (the
      // sticker LOOKS broken even though the column is just missing).
      console.error("give resolver: lodge lookup failed", {
        slug: normalized,
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });
      return null;
    }
    return data ?? null;
  } catch (err) {
    console.error("give resolver: lodge lookup threw", {
      slug: normalized,
      message: err instanceof Error ? err.message : String(err),
    });
    // Defensive: the resolver page is public-facing so a missing service
    // role should fail-closed (NotFoundPage), not leak a stack trace.
    return null;
  }
}

async function loadMerchantId(lodgeId: string): Promise<string | null> {
  try {
    const { data, error } = await createServiceClient()
      .schema("mooov")
      .from("lodges")
      .select("merchant_id, status")
      .eq("id", lodgeId)
      .maybeSingle<{ merchant_id: string; status: string }>();
    if (error) {
      console.error("give resolver: mooov merchant lookup failed", {
        lodge_id: lodgeId,
        code: error.code,
        message: error.message,
      });
      return null;
    }
    if (!data) return null;
    if (data.status && data.status !== "active") return null;
    return data.merchant_id ?? null;
  } catch (err) {
    console.error("give resolver: mooov merchant lookup threw", {
      lodge_id: lodgeId,
      message: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

async function resolveContext({
  context,
  lodgeId,
  eventId,
  currentCharityCampaignId,
}: {
  context: Context;
  lodgeId: string;
  eventId: string | null;
  currentCharityCampaignId: string | null;
}): Promise<ResolvedContext> {
  const supa = createServiceClient();

  let event: {
    id: string;
    title: string;
    dining_price: number | null;
    charity_suggested_amounts: number[] | null;
    charity_allow_custom: boolean | null;
    raffle_suggested_amounts: number[] | null;
    raffle_allow_custom: boolean | null;
    charity_name: string | null;
  } | null = null;
  if (eventId) {
    try {
      const { data } = await supa
        .from("events")
        .select(
          "id, title, dining_price, charity_suggested_amounts, charity_allow_custom, raffle_suggested_amounts, raffle_allow_custom, charity_name, lodge_id",
        )
        .eq("id", eventId)
        .eq("lodge_id", lodgeId)
        .maybeSingle<{
          id: string;
          title: string;
          dining_price: number | null;
          charity_suggested_amounts: number[] | null;
          charity_allow_custom: boolean | null;
          raffle_suggested_amounts: number[] | null;
          raffle_allow_custom: boolean | null;
          charity_name: string | null;
          lodge_id: string;
        }>();
      if (data) event = data;
    } catch {
      // Falls through to context defaults.
    }
  }

  let campaign: { id: string; name: string } | null = null;
  if (context === "charity" && currentCharityCampaignId) {
    try {
      const { data } = await supa
        .from("charity_campaigns")
        .select("id, name, status, lodge_id")
        .eq("id", currentCharityCampaignId)
        .eq("lodge_id", lodgeId)
        .maybeSingle<{
          id: string;
          name: string;
          status: string;
          lodge_id: string;
        }>();
      if (data && data.status === "active") {
        campaign = { id: data.id, name: data.name };
      }
    } catch {
      // Falls through to generic charity copy.
    }
  }

  switch (context) {
    case "dining": {
      const price = event?.dining_price ?? null;
      return {
        intent: "event_dining_standing_qr",
        presetAmounts: price ? [Number(price)] : DEFAULT_PRESETS.dining,
        campaignId: null,
        eventId: event?.id ?? null,
        description: event
          ? `Dining contribution — ${event.title}`
          : "Dining contribution",
        heading: event ? `Pay for dining at ${event.title}` : "Dining contribution",
        subheading: price
          ? `Tap to pay the dining charge.`
          : "Standing QR for dining contributions.",
        customAllowed: !price,
      };
    }
    case "raffle": {
      const presets = event?.raffle_suggested_amounts ?? DEFAULT_PRESETS.raffle;
      return {
        intent: "event_raffle_standing_qr",
        presetAmounts: presets,
        campaignId: null,
        eventId: event?.id ?? null,
        description: event
          ? `Raffle support — ${event.title}`
          : "Raffle support",
        heading: event ? `Raffle at ${event.title}` : "Raffle",
        subheading: "Pick a contribution to buy tickets.",
        customAllowed: event?.raffle_allow_custom !== false,
      };
    }
    case "charity": {
      const presets = event?.charity_suggested_amounts ?? DEFAULT_PRESETS.charity;
      const charityName = event?.charity_name ?? campaign?.name ?? null;
      return {
        intent: "charity_donation_standing_qr",
        presetAmounts: presets,
        campaignId: campaign?.id ?? null,
        eventId: event?.id ?? null,
        description: charityName
          ? `Donation — ${charityName}`
          : "Charity donation",
        heading: charityName
          ? `Donate to ${charityName}`
          : "Donate",
        subheading: campaign?.name
          ? "Tap any amount to give. Pay with Apple Pay, Google Pay, or card."
          : "Tap an amount to give to the lodge's charity collection.",
        customAllowed: event?.charity_allow_custom !== false,
      };
    }
    case "general":
    default:
      return {
        intent: "lodge_generic_standing_qr",
        presetAmounts: DEFAULT_PRESETS.general,
        campaignId: null,
        eventId: null,
        description: "Lodge payment",
        heading: "Pay the lodge",
        subheading: "Pick a preset amount or enter a custom one.",
        customAllowed: true,
      };
  }
}

async function mintAndGetHostedUrl({
  lodgeId,
  lodgeSlug,
  merchantId,
  amountPounds,
  resolved,
}: {
  lodgeId: string;
  lodgeSlug: string;
  merchantId: string;
  amountPounds: number;
  resolved: ResolvedContext;
}): Promise<string | null> {
  const supa = createServiceClient();
  const amountMinor = Math.round(amountPounds * 100);
  const currency = "GBP";
  const paymentId = `giv_${lodgeId}_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 10)}`;
  const idempotencyKey = `giv_${paymentId}`;

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const successUrl = `${siteUrl}/give/${encodeURIComponent(lodgeSlug)}/done?payment_id=${encodeURIComponent(paymentId)}`;
  const cancelUrl = `${siteUrl}/give/${encodeURIComponent(lodgeSlug)}/cancelled`;

  const initialMetadata: Record<string, unknown> = {
    source: "lodgepay_standing_qr",
    lodge_slug: lodgeSlug,
    lodge_id: lodgeId,
    intent: resolved.intent,
    event_id: resolved.eventId,
    campaign_id: resolved.campaignId,
  };

  try {
    await supa
      .schema("mooov")
      .from("payment_attempts")
      .insert({
        payment_id: paymentId,
        lodge_id: lodgeId,
        member_id: null,
        amount: amountMinor,
        currency,
        intent: resolved.intent,
        status: "pending",
        idempotency_key: idempotencyKey,
        metadata: initialMetadata,
        guest_descriptor: {
          source: "standing_qr",
          lodge_slug: lodgeSlug,
          intent: resolved.intent,
          event_id: resolved.eventId,
          campaign_id: resolved.campaignId,
        },
      });
  } catch (err) {
    console.error("give resolver: preflight insert failed", {
      lodge_id: lodgeId,
      payment_id: paymentId,
      message: err instanceof Error ? err.message : String(err),
    });
    return null;
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
          description: resolved.description,
          metadata: {
            intent: resolved.intent,
            lodge_id: lodgeId,
            lodge_slug: lodgeSlug,
            event_id: resolved.eventId ?? undefined,
            campaign_id: resolved.campaignId ?? undefined,
          },
        },
      },
    );

    const hostedUrl = result.provider?.hosted_url ?? null;
    if (!hostedUrl) {
      console.error("give resolver: Mooov returned no hosted_url", {
        payment_id: paymentId,
        merchant_id: merchantId,
        state: result.state,
        provider: result.provider ?? null,
        full_response: result,
      });
      return null;
    }

    const persistedMetadata: Record<string, unknown> = {
      ...initialMetadata,
      hosted_url: hostedUrl,
      flow: "embedded",
      checkout_session_id: result.checkout_session_id ?? null,
    };
    await supa
      .schema("mooov")
      .from("payment_attempts")
      .update({
        status: result.state,
        provider_ref: result.provider?.provider_ref ?? null,
        metadata: persistedMetadata,
      })
      .eq("payment_id", paymentId);

    return hostedUrl;
  } catch (err) {
    if (err instanceof MooovApiError) {
      console.error("give resolver: Mooov call failed", {
        payment_id: paymentId,
        category: err.category,
        status: err.status,
      });
    } else {
      console.error("give resolver: mint unexpected error", err);
    }
    await supa
      .schema("mooov")
      .from("payment_attempts")
      .update({
        status: "failed",
        failure_reason:
          err instanceof MooovApiError ? err.category : "unexpected_error",
      })
      .eq("payment_id", paymentId);
    return null;
  }
}

function SelectionPage({
  slug,
  context,
  lodgeName,
  eventId,
  resolved,
}: {
  slug: string;
  context: Context;
  lodgeName: string;
  eventId: string | null;
  resolved: ResolvedContext;
}) {
  const base = `/give/${encodeURIComponent(slug)}/${context}`;
  const eventQuery = eventId ? `&event=${encodeURIComponent(eventId)}` : "";
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 py-10 px-4 sm:py-16">
      <div className="mx-auto max-w-xl">
        <div className="rounded-2xl bg-white p-6 shadow-xl sm:p-8">
          <div className="flex items-center gap-3 text-slate-700">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-amber-100 text-amber-700">
              <ContextIcon context={context} />
            </span>
            <div className="text-sm font-medium uppercase tracking-wide text-slate-500">
              {lodgeName}
            </div>
          </div>
          <h1 className="mt-4 text-3xl font-semibold text-slate-900">
            {resolved.heading}
          </h1>
          <p className="mt-2 text-sm text-slate-600">{resolved.subheading}</p>

          <div className="mt-6 space-y-3">
            <p className="text-xs uppercase tracking-wide text-slate-500">
              Choose an amount
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {resolved.presetAmounts.length > 0 ? (
                resolved.presetAmounts.map((preset) => (
                  <Link
                    key={preset}
                    href={`${base}?amount=${preset}${eventQuery}`}
                    prefetch={false}
                    className="block rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-center text-lg font-semibold text-slate-900 transition-colors hover:border-amber-400 hover:bg-amber-50"
                  >
                    £{preset}
                  </Link>
                ))
              ) : (
                <p className="col-span-full text-sm text-slate-600">
                  No preset amounts configured for this link.
                </p>
              )}
            </div>
          </div>

          {resolved.customAllowed ? (
            <form
              action={base}
              method="get"
              className="mt-6 flex items-stretch gap-2"
            >
              {eventId ? (
                <input type="hidden" name="event" value={eventId} />
              ) : null}
              <label className="sr-only" htmlFor="amount">
                Custom amount
              </label>
              <div className="relative flex-1">
                <span className="pointer-events-none absolute inset-y-0 left-3 grid place-items-center text-slate-500">
                  £
                </span>
                <input
                  id="amount"
                  name="amount"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="1"
                  max="5000"
                  placeholder="Custom"
                  className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-7 pr-4 text-base text-slate-900 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200"
                  required
                />
              </div>
              <button
                type="submit"
                className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800"
              >
                Pay
              </button>
            </form>
          ) : null}

          <div className="mt-6 flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            <span>
              You&apos;ll pay via Mooov on a secure page. Cards are not stored
              on the lodge&apos;s server.
            </span>
          </div>
        </div>
        <p className="mt-4 text-center text-xs text-slate-500">
          Powered by LodgePay &amp; Mooov
        </p>
      </div>
    </main>
  );
}

function NotFoundPage({ reason }: { reason: string }) {
  return (
    <main className="min-h-screen bg-slate-50 py-16 px-4">
      <div className="mx-auto max-w-md rounded-2xl bg-white p-6 shadow-md text-center">
        <h1 className="text-xl font-semibold text-slate-900">
          Sorry, we couldn&apos;t open this link.
        </h1>
        <p className="mt-2 text-sm text-slate-600">{reason}</p>
      </div>
    </main>
  );
}

function ContextIcon({ context }: { context: Context }) {
  switch (context) {
    case "charity":
      return <Heart className="h-5 w-5" />;
    case "raffle":
      return <Sparkles className="h-5 w-5" />;
    case "dining":
      return <Utensils className="h-5 w-5" />;
    case "general":
    default:
      return <Banknote className="h-5 w-5" />;
  }
}
