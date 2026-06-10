"use client";

import { useState } from "react";
import {
  Heart,
  Sparkles,
  Utensils,
  Banknote,
  Loader2,
  ShieldCheck,
} from "lucide-react";

type Context = "charity" | "raffle" | "dining" | "general";

type Props = {
  slug: string;
  context: Context;
  churchName: string;
  eventId: string | null;
  heading: string;
  subheading: string;
  presetAmounts: number[];
  customAllowed: boolean;
  charityHeader: string;
  /** When true, the form asks for email / name / optional gift aid and
   *  POSTs to /api/donations. When false, it just navigates the page to
   *  ?amount=<n>&event=<id> and lets the server-side resolver mint. */
  collectDonor: boolean;
};

export function GiveFormClient({
  slug,
  context,
  churchName,
  eventId,
  heading,
  subheading,
  presetAmounts,
  customAllowed,
  charityHeader,
  collectDonor,
}: Props) {
  const [selectedPreset, setSelectedPreset] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState("");
  const [donorEmail, setDonorEmail] = useState("");
  const [donorName, setDonorName] = useState("");
  const [giftAid, setGiftAid] = useState(false);
  const [giftAidConfirmed, setGiftAidConfirmed] = useState(false);
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [city, setCity] = useState("");
  const [postcode, setPostcode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const effectiveAmount =
    selectedPreset ?? (customAmount ? Number(customAmount) : 0);

  function handlePresetClick(preset: number) {
    setSelectedPreset(preset);
    setCustomAmount(String(preset));
    setError(null);
  }

  function handleCustomChange(value: string) {
    setCustomAmount(value);
    setSelectedPreset(null);
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!Number.isFinite(effectiveAmount) || effectiveAmount <= 0) {
      setError("Pick an amount above, or type one in £.");
      return;
    }
    if (effectiveAmount > 5000) {
      setError("Amounts above £5,000 can't be taken through this link.");
      return;
    }

    if (!collectDonor) {
      // Non-donor-collecting contexts (dining / raffle / general) navigate
      // straight to the GET branch of the same page, which mints and 302s
      // to Mooov server-side. No JS needed once the navigation fires.
      const url = new URL(window.location.href);
      url.searchParams.set("amount", String(effectiveAmount));
      if (eventId) url.searchParams.set("event", eventId);
      window.location.href = url.toString();
      return;
    }

    if (!donorEmail.trim()) {
      setError("Email is required so we can send your receipt.");
      return;
    }
    if (
      giftAid &&
      (!giftAidConfirmed || !addressLine1 || !city || !postcode)
    ) {
      setError(
        "For Gift Aid we need a confirmed eligibility tick and your full address.",
      );
      return;
    }

    setSubmitting(true);
    try {
      // Reuse the existing donations route — it already handles gift aid
      // declaration creation + dedupe via the Mooov webhook projection.
      // Pass church=<slug> so the route's tenant resolver picks the right
      // church when this page is opened on the bare host instead of a
      // church subdomain.
      const res = await fetch(
        `/api/donations?church=${encodeURIComponent(slug)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amount: effectiveAmount,
            donor_name: donorName.trim() || null,
            donor_email: donorEmail.trim(),
            gift_aid: giftAid,
            gift_aid_confirmed: giftAidConfirmed,
            gift_aid_address_line_1: addressLine1,
            gift_aid_address_line_2: addressLine2,
            gift_aid_city: city,
            gift_aid_postcode: postcode,
          }),
        },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Could not start donation.");
      }
      const body = (await res.json()) as { url?: string };
      if (body.url) {
        window.location.href = body.url;
      } else {
        throw new Error("Payment processor did not return a checkout URL.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 py-10 px-4 sm:py-16">
      <div className="mx-auto max-w-xl">
        <div className="rounded-2xl bg-white p-6 shadow-xl sm:p-8">
          <div className="flex items-center gap-3 text-slate-700">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-amber-100 text-amber-700">
              <ContextIcon context={context} />
            </span>
            <div className="text-sm font-medium uppercase tracking-wide text-slate-500">
              {charityHeader || churchName}
            </div>
          </div>
          <h1 className="mt-4 text-3xl font-semibold text-slate-900">
            {heading}
          </h1>
          <p className="mt-2 text-sm text-slate-600">{subheading}</p>

          <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
            <div className="space-y-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Choose an amount
              </p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {presetAmounts.length > 0 ? (
                  presetAmounts.map((preset) => {
                    const active = selectedPreset === preset;
                    return (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => handlePresetClick(preset)}
                        className={`block rounded-xl border px-4 py-4 text-center text-lg font-semibold transition-colors ${
                          active
                            ? "border-amber-500 bg-amber-50 text-amber-900 ring-2 ring-amber-200"
                            : "border-slate-200 bg-slate-50 text-slate-900 hover:border-amber-400 hover:bg-amber-50"
                        }`}
                      >
                        £{preset}
                      </button>
                    );
                  })
                ) : (
                  <p className="col-span-full text-sm text-slate-600">
                    No preset amounts configured for this link.
                  </p>
                )}
              </div>

              {customAllowed ? (
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-3 grid place-items-center text-slate-500">
                    £
                  </span>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="1"
                    max="5000"
                    placeholder="Or enter a custom amount"
                    className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-7 pr-4 text-base text-slate-900 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200"
                    value={customAmount}
                    onChange={(e) => handleCustomChange(e.target.value)}
                  />
                </div>
              ) : null}
            </div>

            {collectDonor ? (
              <>
                <div className="space-y-3">
                  <label className="block text-xs uppercase tracking-wide text-slate-500">
                    Your details
                  </label>
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="Email (for your receipt)"
                    value={donorEmail}
                    onChange={(e) => setDonorEmail(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white py-3 px-4 text-base text-slate-900 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200"
                  />
                  <input
                    type="text"
                    autoComplete="name"
                    placeholder="Name (optional)"
                    value={donorName}
                    onChange={(e) => setDonorName(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white py-3 px-4 text-base text-slate-900 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200"
                  />
                </div>

                <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={giftAid}
                      onChange={(e) => setGiftAid(e.target.checked)}
                      className="mt-0.5 h-5 w-5 accent-emerald-600"
                    />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-emerald-900">
                        Add Gift Aid (+25% at no cost to you)
                      </p>
                      <p className="mt-1 text-xs text-emerald-800">
                        If you&apos;re a UK taxpayer, the church can reclaim
                        25p for every £1 you give from HMRC. One-off
                        donation: £{effectiveAmount.toFixed(2)} becomes £
                        {(effectiveAmount * 1.25).toFixed(2)}.
                      </p>
                    </div>
                  </label>

                  {giftAid ? (
                    <div className="mt-4 space-y-3 border-t border-emerald-200 pt-4">
                      <label className="flex items-start gap-2 text-xs text-emerald-900">
                        <input
                          type="checkbox"
                          checked={giftAidConfirmed}
                          onChange={(e) =>
                            setGiftAidConfirmed(e.target.checked)
                          }
                          className="mt-0.5 h-4 w-4 accent-emerald-600"
                        />
                        <span>
                          I confirm I am a UK taxpayer and understand that
                          if I pay less Income Tax / Capital Gains Tax in
                          the current year than the Gift Aid claimed on
                          all my donations, it is my responsibility to pay
                          any difference.
                        </span>
                      </label>
                      <input
                        type="text"
                        required={giftAid}
                        autoComplete="address-line1"
                        placeholder="Address line 1"
                        value={addressLine1}
                        onChange={(e) => setAddressLine1(e.target.value)}
                        className="w-full rounded-lg border border-emerald-200 bg-white py-2 px-3 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                      />
                      <input
                        type="text"
                        autoComplete="address-line2"
                        placeholder="Address line 2 (optional)"
                        value={addressLine2}
                        onChange={(e) => setAddressLine2(e.target.value)}
                        className="w-full rounded-lg border border-emerald-200 bg-white py-2 px-3 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                      />
                      <div className="grid grid-cols-2 gap-3">
                        <input
                          type="text"
                          required={giftAid}
                          autoComplete="address-level2"
                          placeholder="City"
                          value={city}
                          onChange={(e) => setCity(e.target.value)}
                          className="w-full rounded-lg border border-emerald-200 bg-white py-2 px-3 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                        />
                        <input
                          type="text"
                          required={giftAid}
                          autoComplete="postal-code"
                          placeholder="Postcode"
                          value={postcode}
                          onChange={(e) =>
                            setPostcode(e.target.value.toUpperCase())
                          }
                          className="w-full rounded-lg border border-emerald-200 bg-white py-2 px-3 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                        />
                      </div>
                    </div>
                  ) : null}
                </div>
              </>
            ) : null}

            {error ? (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={submitting || effectiveAmount <= 0}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-base font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Sending you to Mooov…
                </>
              ) : effectiveAmount > 0 ? (
                <>
                  Pay £{effectiveAmount.toFixed(2)} on Mooov
                </>
              ) : (
                "Pay"
              )}
            </button>

            <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              <span>
                You&apos;ll pay via Mooov on a secure page. Cards are not
                stored on the church&apos;s server.
              </span>
            </div>
          </form>
        </div>
        <p className="mt-4 text-center text-xs text-slate-500">
          Powered by ChurchPay &amp; Mooov
        </p>
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
