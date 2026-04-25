"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Heart, CheckCircle2 } from "lucide-react";

const PRESET_AMOUNTS = [10, 25, 50, 100];

function DonatePageContent() {
  const searchParams = useSearchParams();
  const lodge = searchParams.get("lodge") ?? "";
  const lodgeQuery = lodge ? `?lodge=${encodeURIComponent(lodge)}` : "";

  const [amount, setAmount] = useState<number>(0);
  const [customAmount, setCustomAmount] = useState("");
  const [donorName, setDonorName] = useState("");
  const [donorEmail, setDonorEmail] = useState("");
  const [giftAid, setGiftAid] = useState(false);
  const [giftAidConfirmed, setGiftAidConfirmed] = useState(false);
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [city, setCity] = useState("");
  const [postcode, setPostcode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const effectiveAmount = amount || Number(customAmount) || 0;

  function selectPreset(value: number) {
    setAmount(value);
    setCustomAmount("");
  }

  function handleCustomChange(value: string) {
    setCustomAmount(value);
    setAmount(0);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (effectiveAmount <= 0) {
      setError("Please select or enter a donation amount.");
      return;
    }
    if (!donorEmail.trim()) {
      setError("Email is required.");
      return;
    }
    if (giftAid && (!giftAidConfirmed || !addressLine1 || !city || !postcode)) {
      setError(
        "Please confirm Gift Aid eligibility and provide your address."
      );
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/donations${lodgeQuery}`, {
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
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Donation failed");
      }

      const { url } = await res.json();
      if (url) window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="public-page">
      <section className="public-hero">
        <div className="public-hero-shell">
          <div className="public-hero-copy">
            <p className="public-kicker">Make a donation</p>
            <h1 className="public-hero-title">
              Every contribution makes a difference.
            </h1>
            <p className="public-hero-body">
              Support our charitable work with a one-off donation. Your
              generosity helps fund community causes, education, and welfare
              programmes.
            </p>
          </div>
          <div className="public-hero-panel">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-200">
              Your impact
            </p>
            <div className="mt-6 space-y-4">
              {[
                "Gift Aid adds 25% at no cost to you",
                "100% of donations go directly to charitable causes",
                "Transparent reporting on how funds are used",
              ].map((item) => (
                <div
                  key={item}
                  className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-200"
                >
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 lg:py-28">
        <div className="container-full">
          <div className="mx-auto max-w-xl">
            <div className="public-grid-card">
              <div className="mb-6 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
                  <Heart className="h-6 w-6" />
                </div>
                <h2 className="text-xl font-semibold text-slate-950">
                  Donation details
                </h2>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                {error && (
                  <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                    {error}
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Select an amount</Label>
                  <div className="flex flex-wrap gap-2">
                    {PRESET_AMOUNTS.map((a) => (
                      <Button
                        key={a}
                        type="button"
                        variant={amount === a ? "default" : "secondary"}
                        size="sm"
                        onClick={() => selectPreset(a)}
                      >
                        £{a}
                      </Button>
                    ))}
                    <Input
                      type="number"
                      min={1}
                      step={1}
                      placeholder="Custom"
                      className="w-24"
                      value={customAmount}
                      onChange={(e) => handleCustomChange(e.target.value)}
                    />
                  </div>
                  {effectiveAmount > 0 && (
                    <p className="text-sm font-medium text-slate-700">
                      Donation: £{effectiveAmount.toFixed(2)}
                      {giftAid && (
                        <span className="ml-1 text-emerald-600">
                          (+£{(effectiveAmount * 0.25).toFixed(2)} Gift Aid)
                        </span>
                      )}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="donor_name">Your name</Label>
                  <Input
                    id="donor_name"
                    value={donorName}
                    onChange={(e) => setDonorName(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="donor_email">Email *</Label>
                  <Input
                    id="donor_email"
                    type="email"
                    required
                    value={donorEmail}
                    onChange={(e) => setDonorEmail(e.target.value)}
                  />
                </div>

                {effectiveAmount > 0 && (
                  <div className="space-y-3 rounded-xl border border-blue-100 bg-blue-50/50 p-4">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="gift_aid_donate"
                        checked={giftAid}
                        onChange={(e) => {
                          setGiftAid(e.target.checked);
                          if (!e.target.checked) setGiftAidConfirmed(false);
                        }}
                        className="h-4 w-4 rounded border-input text-blue-600 focus:ring-blue-500"
                      />
                      <Label htmlFor="gift_aid_donate" className="font-semibold">
                        I would like to Gift Aid my donation
                      </Label>
                    </div>
                    {giftAid && (
                      <div className="space-y-4 pt-1">
                        <p className="text-sm leading-relaxed text-slate-600">
                          Gift Aid allows us to claim an extra 25p for every £1
                          you donate at no cost to you.
                        </p>
                        <p className="text-xs leading-relaxed text-slate-500">
                          I am a UK taxpayer and understand that if I pay less
                          Income Tax and/or Capital Gains Tax than the amount of
                          Gift Aid claimed on all my donations in that tax year
                          it is my responsibility to pay any difference.
                        </p>
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id="gift_aid_confirmed_donate"
                            checked={giftAidConfirmed}
                            onChange={(e) =>
                              setGiftAidConfirmed(e.target.checked)
                            }
                            className="h-4 w-4 rounded border-input text-blue-600 focus:ring-blue-500"
                          />
                          <Label
                            htmlFor="gift_aid_confirmed_donate"
                            className="text-sm"
                          >
                            I confirm I am eligible for Gift Aid
                          </Label>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="space-y-1">
                            <Label className="text-sm">Address line 1 *</Label>
                            <Input
                              value={addressLine1}
                              onChange={(e) => setAddressLine1(e.target.value)}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-sm">Address line 2</Label>
                            <Input
                              value={addressLine2}
                              onChange={(e) => setAddressLine2(e.target.value)}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-sm">City *</Label>
                            <Input
                              value={city}
                              onChange={(e) => setCity(e.target.value)}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-sm">Postcode *</Label>
                            <Input
                              value={postcode}
                              onChange={(e) => setPostcode(e.target.value)}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={submitting || effectiveAmount <= 0}
                  variant="primary"
                  className="w-full"
                >
                  {submitting
                    ? "Processing..."
                    : effectiveAmount > 0
                      ? `Donate £${effectiveAmount.toFixed(2)}`
                      : "Select an amount"}
                </Button>
              </form>
            </div>

            <div className="mt-8 rounded-[1.25rem] border border-slate-200 bg-slate-50 p-6">
              <h3 className="text-lg font-semibold text-slate-950">
                About Gift Aid
              </h3>
              <div className="mt-4 space-y-3">
                {[
                  "Gift Aid lets charities reclaim 25p for every £1 you donate",
                  "You must be a UK taxpayer to qualify",
                  "It costs you nothing extra — the charity claims it from HMRC",
                ].map((fact) => (
                  <div key={fact} className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                    <p className="text-sm leading-relaxed text-slate-600">
                      {fact}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export default function DonatePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center bg-white">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-slate-950" />
        </div>
      }
    >
      <DonatePageContent />
    </Suspense>
  );
}
