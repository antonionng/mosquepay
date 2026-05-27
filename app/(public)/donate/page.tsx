"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Heart, CheckCircle2, ShieldCheck } from "lucide-react";

const PRESET_AMOUNTS = [10, 25, 50, 100];

function DonatePageContent() {
  const searchParams = useSearchParams();
  const lodge = searchParams.get("lodge") ?? "";
  const lodgeQuery = lodge ? `?lodge=${encodeURIComponent(lodge)}` : "";

  // Optional URL pre-fill: the member portal links here from
  // /member/donations with the signed-in member's email/name and a
  // gift_aid hint when they clicked "Set up Gift Aid". Defaulting from
  // the URL on first render (vs syncing in an effect) avoids the
  // "field briefly empty, then jumps" flash some users see.
  const initialEmail = searchParams.get("email") ?? "";
  const initialName = searchParams.get("name") ?? "";
  const initialGiftAid = searchParams.get("gift_aid") === "1";

  // Lodge name for the hero. Fetched client-side using the same public
  // endpoint the PublicHeader uses so donors see "Donate to Covenant Lodge
  // No. 4344" (or whichever lodge the link routes to) instead of the
  // platform-generic copy. We only render the lodge label once it's loaded
  // so we don't flash the wrong name.
  const [lodgeName, setLodgeName] = useState<string | null>(null);

  const [amount, setAmount] = useState<number>(0);
  const [customAmount, setCustomAmount] = useState("");
  const [donorName, setDonorName] = useState(initialName);
  const [donorEmail, setDonorEmail] = useState(initialEmail);
  const [giftAid, setGiftAid] = useState(initialGiftAid);
  const [giftAidConfirmed, setGiftAidConfirmed] = useState(false);
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [city, setCity] = useState("");
  const [postcode, setPostcode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Whether this email already has an active Gift Aid declaration on file
  // for this lodge. When true the donor doesn't need to re-enter the
  // address / re-tick the eligibility confirmation: the existing
  // enduring declaration covers this and all future donations from this
  // email until the donor revokes it.
  const [existingGiftAid, setExistingGiftAid] = useState(false);
  const [checkingGiftAid, setCheckingGiftAid] = useState(false);
  // Used to ignore stale lookups when the donor edits the email field
  // faster than the network can respond.
  const giftAidLookupId = useRef(0);

  const effectiveAmount = amount || Number(customAmount) || 0;

  // Resolve the lodge label for the hero. We only attempt the lookup when
  // a slug is on the URL -- on the bare /donate path we keep the generic
  // copy. The same endpoint powers the lodge-aware PublicHeader, so this
  // adds no new public surface area.
  useEffect(() => {
    if (!lodge) {
      setLodgeName(null);
      return;
    }
    let active = true;
    async function loadLodge() {
      try {
        const res = await fetch(
          `/api/lodges/${encodeURIComponent(lodge)}/site`,
          { cache: "no-store" }
        );
        if (!res.ok) return;
        const data = (await res.json()) as { lodge?: { name?: string } };
        if (!active) return;
        if (data.lodge?.name) setLodgeName(data.lodge.name);
      } catch {
        // Keep generic copy on failure.
      }
    }
    loadLodge();
    return () => {
      active = false;
    };
  }, [lodge]);

  // Debounced lookup: whenever the donor's email looks valid, ask the API
  // whether we already have a Gift Aid declaration on file for it. If we do,
  // auto-tick the Gift Aid box and skip the address form -- HMRC treats the
  // earlier declaration as covering all future donations.
  useEffect(() => {
    const email = donorEmail.trim();
    if (!email || !email.includes("@") || email.length < 5) {
      setExistingGiftAid(false);
      setCheckingGiftAid(false);
      return;
    }

    const myId = ++giftAidLookupId.current;
    setCheckingGiftAid(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/donations/gift-aid-status?email=${encodeURIComponent(email)}${
            lodge ? `&lodge=${encodeURIComponent(lodge)}` : ""
          }`,
          { cache: "no-store" }
        );
        if (myId !== giftAidLookupId.current) return;
        if (!res.ok) {
          setExistingGiftAid(false);
          return;
        }
        const data = (await res.json()) as { has_active_declaration?: boolean };
        const found = Boolean(data.has_active_declaration);
        setExistingGiftAid(found);
        if (found) {
          setGiftAid(true);
          setGiftAidConfirmed(true);
        }
      } catch {
        if (myId === giftAidLookupId.current) setExistingGiftAid(false);
      } finally {
        if (myId === giftAidLookupId.current) setCheckingGiftAid(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [donorEmail, lodge]);

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
    // When the donor's email already has a Gift Aid declaration on file we
    // don't need the address again -- the saved declaration covers this
    // donation. Otherwise we need a confirmed declaration + full address so
    // HMRC will accept the claim.
    if (giftAid && !existingGiftAid && (!giftAidConfirmed || !addressLine1 || !city || !postcode)) {
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
    // Mobile-first ordering: the donation form jumps above the hero on
    // small screens so the donor lands directly on the call-to-action.
    // On lg+ we fall back to natural document order (hero first, then
    // form section).
    <div className="public-page flex flex-col">
      <section className="public-hero order-2 lg:order-none">
        <div className="public-hero-shell">
          <div className="public-hero-copy">
            <p className="public-kicker">
              {lodgeName ? `Donate to ${lodgeName}` : "Make a donation"}
            </p>
            <h1 className="public-hero-title">
              Every contribution makes a difference.
            </h1>
            <p className="public-hero-body">
              {lodgeName
                ? `Support ${lodgeName}'s charitable work with a one-off donation. Your generosity helps fund community causes, education, and welfare programmes.`
                : "Support our charitable work with a one-off donation. Your generosity helps fund community causes, education, and welfare programmes."}
            </p>
          </div>
          <div className="public-hero-panel">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-200">
              Your impact
            </p>
            <div className="mt-6 space-y-4">
              {[
                "Gift Aid adds 25% at no cost to you",
                "Set up Gift Aid once: future donations from the same email are Gift Aided automatically",
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

      <section className="order-1 py-12 lg:order-none lg:py-28">
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
                      inputMode="decimal"
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
                    autoComplete="name"
                    enterKeyHint="next"
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
                    autoComplete="email"
                    autoCapitalize="off"
                    autoCorrect="off"
                    spellCheck={false}
                    inputMode="email"
                    enterKeyHint="next"
                    value={donorEmail}
                    onChange={(e) => setDonorEmail(e.target.value)}
                  />
                </div>

                {effectiveAmount > 0 && existingGiftAid && (
                  <div className="space-y-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                    <div className="flex items-start gap-2">
                      <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-emerald-900">
                          Gift Aid is already set up for this email
                        </p>
                        <p className="text-sm leading-relaxed text-emerald-800">
                          We have your Gift Aid declaration on file, so this
                          donation will automatically be boosted by 25%. You
                          don&apos;t need to fill anything in again.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {effectiveAmount > 0 && !existingGiftAid && (
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
                      {checkingGiftAid && (
                        <span className="text-xs text-slate-500">
                          Checking your email...
                        </span>
                      )}
                    </div>
                    {giftAid && (
                      <div className="space-y-4 pt-1">
                        <p className="text-sm leading-relaxed text-slate-600">
                          Gift Aid allows us to claim an extra 25p for every £1
                          you donate at no cost to you.
                        </p>
                        <p className="rounded-lg bg-blue-100/60 px-3 py-2 text-xs leading-relaxed text-blue-900">
                          We&apos;ll save this Gift Aid declaration against{" "}
                          <span className="font-semibold">
                            {donorEmail.trim() || "your email"}
                          </span>
                          . Any future donations you make from the same email
                          will be Gift Aided automatically. You won&apos;t need
                          to re-enter your address.
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
                              autoComplete="address-line1"
                              enterKeyHint="next"
                              value={addressLine1}
                              onChange={(e) => setAddressLine1(e.target.value)}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-sm">Address line 2</Label>
                            <Input
                              autoComplete="address-line2"
                              enterKeyHint="next"
                              value={addressLine2}
                              onChange={(e) => setAddressLine2(e.target.value)}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-sm">City *</Label>
                            <Input
                              autoComplete="address-level2"
                              enterKeyHint="next"
                              value={city}
                              onChange={(e) => setCity(e.target.value)}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-sm">Postcode *</Label>
                            <Input
                              autoComplete="postal-code"
                              autoCapitalize="characters"
                              enterKeyHint="done"
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
                  "It costs you nothing extra. The charity claims it from HMRC",
                  "We save your declaration against your email, so future donations from the same email are Gift Aided automatically",
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
