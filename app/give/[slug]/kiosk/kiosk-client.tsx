"use client";

// Self-service giving kiosk client.
//
// Step flow: welcome -> amount -> details -> gift aid -> QR -> thank you.
// Designed for a tablet stood in landscape or portrait at the church door:
// big tap targets, no scrolling on the happy path, automatic reset back to
// the welcome screen after inactivity, and a screen wake lock so the tablet
// stays awake until someone deliberately puts it to sleep.

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import QRCode from "qrcode";
import {
  Banknote,
  Check,
  ChevronLeft,
  HandHeart,
  Heart,
  Loader2,
  Moon,
  TriangleAlert,
} from "lucide-react";

type Step =
  | "welcome"
  | "amount"
  | "details"
  | "giftaid"
  | "qr"
  | "success"
  | "failed";

type Purpose = "tithe" | "offering" | "charity" | "general";

const PURPOSES: { id: Purpose; label: string; hint: string }[] = [
  { id: "tithe", label: "Tithe", hint: "Regular tithe to the church" },
  { id: "offering", label: "Offering", hint: "A freewill offering" },
  { id: "charity", label: "Charity gift", hint: "The church's charity collection" },
  { id: "general", label: "General", hint: "Wherever it's needed most" },
];

const PRESET_AMOUNTS = [5, 10, 20, 50, 100];

// Idle timers (ms). After this much inactivity the kiosk quietly returns to
// the welcome screen so the next giver never sees someone else's details.
const IDLE_RESET_MS = 120_000;
const IDLE_RESET_QR_MS = 300_000;
const SUCCESS_RESET_SECONDS = 12;

const POLL_INTERVAL_MS = 2_000;

type MintResponse = {
  url?: string;
  payment_id?: string;
  error?: string;
};

type StatusResponse = {
  phase?: "pending" | "awaiting_payment" | "succeeded" | "failed";
  error?: string;
};

export function KioskClient({
  slug,
  churchName,
}: {
  slug: string;
  churchName: string;
}) {
  const [step, setStep] = useState<Step>("welcome");
  const [amount, setAmount] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState("");
  const [purpose, setPurpose] = useState<Purpose>("offering");

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [anonymous, setAnonymous] = useState(false);

  const [giftAidWanted, setGiftAidWanted] = useState(false);
  const [address1, setAddress1] = useState("");
  const [address2, setAddress2] = useState("");
  const [city, setCity] = useState("");
  const [postcode, setPostcode] = useState("");
  const [taxpayerConfirmed, setTaxpayerConfirmed] = useState(false);

  const [minting, setMinting] = useState(false);
  const [mintError, setMintError] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [paymentId, setPaymentId] = useState<string | null>(null);

  const [asleep, setAsleep] = useState(false);

  const effectiveAmount = useMemo(() => {
    if (amount !== null) return amount;
    const n = Number(customAmount);
    return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
  }, [amount, customAmount]);

  const resetAll = useCallback(() => {
    setStep("welcome");
    setAmount(null);
    setCustomAmount("");
    setPurpose("offering");
    setFullName("");
    setEmail("");
    setPhone("");
    setAnonymous(false);
    setGiftAidWanted(false);
    setAddress1("");
    setAddress2("");
    setCity("");
    setPostcode("");
    setTaxpayerConfirmed(false);
    setMinting(false);
    setMintError(null);
    setQrDataUrl(null);
    setPaymentId(null);
  }, []);

  useWakeLock(!asleep);
  useIdleReset({
    enabled: step !== "welcome" && !asleep,
    timeoutMs: step === "qr" ? IDLE_RESET_QR_MS : IDLE_RESET_MS,
    onIdle: resetAll,
  });

  // ---- Mint + poll ----

  // setState is async, so screens that flip `anonymous` / `giftAidWanted`
  // and immediately start the payment pass the new value as an override
  // instead of relying on the (stale) closure state.
  const startPayment = useCallback(async (overrides?: {
    anonymous?: boolean;
    giftAid?: boolean;
  }) => {
    const isAnonymous = overrides?.anonymous ?? anonymous;
    const wantsGiftAid = overrides?.giftAid ?? giftAidWanted;
    if (!effectiveAmount) return;
    setMinting(true);
    setMintError(null);
    setQrDataUrl(null);
    setStep("qr");
    try {
      const res = await fetch("/api/give/kiosk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          church: slug,
          amount: effectiveAmount,
          purpose,
          donor: isAnonymous
            ? null
            : fullName.trim()
              ? {
                  full_name: fullName.trim(),
                  email: email.trim() || null,
                  phone: phone.trim() || null,
                }
              : null,
          gift_aid:
            !isAnonymous && wantsGiftAid
              ? {
                  address_line_1: address1.trim(),
                  address_line_2: address2.trim() || null,
                  city: city.trim(),
                  postcode: postcode.trim(),
                  confirmed: taxpayerConfirmed,
                }
              : null,
        }),
      });
      const data = (await res.json()) as MintResponse;
      if (!res.ok || !data.url || !data.payment_id) {
        setMintError(data.error ?? "Could not start the payment. Please try again.");
        setMinting(false);
        return;
      }
      const dataUrl = await QRCode.toDataURL(data.url, {
        width: 720,
        margin: 1,
        color: { dark: "#0f172a", light: "#ffffff" },
      });
      setQrDataUrl(dataUrl);
      setPaymentId(data.payment_id);
      setMinting(false);
    } catch {
      setMintError("Could not start the payment. Please try again.");
      setMinting(false);
    }
  }, [
    effectiveAmount,
    slug,
    purpose,
    anonymous,
    fullName,
    email,
    phone,
    giftAidWanted,
    address1,
    address2,
    city,
    postcode,
    taxpayerConfirmed,
  ]);

  useEffect(() => {
    if (step !== "qr" || !paymentId) return;
    let stopped = false;
    const tick = async () => {
      try {
        const res = await fetch(
          `/api/give/kiosk/status/${encodeURIComponent(paymentId)}`,
          { cache: "no-store" },
        );
        if (!res.ok) return;
        const data = (await res.json()) as StatusResponse;
        if (stopped) return;
        if (data.phase === "succeeded") setStep("success");
        else if (data.phase === "failed") setStep("failed");
      } catch {
        // Transient network errors: keep polling.
      }
    };
    const interval = setInterval(tick, POLL_INTERVAL_MS);
    return () => {
      stopped = true;
      clearInterval(interval);
    };
  }, [step, paymentId]);

  // Auto-reset countdown on the thank-you screen.
  const [countdown, setCountdown] = useState(SUCCESS_RESET_SECONDS);
  useEffect(() => {
    if (step !== "success") return;
    setCountdown(SUCCESS_RESET_SECONDS);
    const interval = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(interval);
          resetAll();
          return SUCCESS_RESET_SECONDS;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [step, resetAll]);

  const giftAidValid =
    !giftAidWanted ||
    (address1.trim().length > 0 &&
      city.trim().length > 0 &&
      postcode.trim().length > 0 &&
      taxpayerConfirmed);

  const canOfferGiftAid =
    !anonymous && fullName.trim().length > 0 && email.trim().length > 0;

  return (
    <main className="relative flex min-h-screen flex-col bg-[#faf8f3] text-slate-900">
      {/* Top bar */}
      <header className="flex items-center justify-between px-6 py-4 sm:px-10">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand text-white">
            <HandHeart className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-semibold leading-tight">{churchName}</p>
            <p className="text-xs text-slate-500">Giving kiosk</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setAsleep(true)}
          className="flex items-center gap-2 rounded-full border border-[#e9e2d4] bg-white px-4 py-2 text-xs font-medium text-slate-500 transition hover:text-slate-800"
          aria-label="Put the kiosk to sleep"
        >
          <Moon className="h-4 w-4" />
          Sleep
        </button>
      </header>

      <div className="flex flex-1 items-center justify-center px-6 pb-10 sm:px-10">
        {step === "welcome" && (
          <WelcomeScreen churchName={churchName} onStart={() => setStep("amount")} />
        )}

        {step === "amount" && (
          <StepCard
            title="How much would you like to give?"
            onBack={resetAll}
          >
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
              {PRESET_AMOUNTS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => {
                    setAmount(preset);
                    setCustomAmount("");
                  }}
                  className={`rounded-2xl border px-4 py-5 text-xl font-semibold transition ${
                    amount === preset
                      ? "border-brand bg-brand text-white shadow"
                      : "border-[#e9e2d4] bg-white hover:border-brand/40"
                  }`}
                >
                  £{preset}
                </button>
              ))}
            </div>
            <div className="mt-4">
              <label className="text-sm font-medium text-slate-600">
                Or enter another amount
              </label>
              <div className="mt-2 flex items-center rounded-2xl border border-[#e9e2d4] bg-white px-4">
                <span className="text-2xl font-semibold text-slate-400">£</span>
                <input
                  inputMode="decimal"
                  value={customAmount}
                  onChange={(e) => {
                    const v = e.target.value.replace(/[^0-9.]/g, "");
                    setCustomAmount(v);
                    setAmount(null);
                  }}
                  placeholder="0.00"
                  className="w-full bg-transparent px-3 py-4 text-2xl font-semibold outline-none placeholder:text-slate-300"
                />
              </div>
            </div>

            <p className="mt-6 text-sm font-medium text-slate-600">
              What is this gift for?
            </p>
            <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {PURPOSES.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPurpose(p.id)}
                  className={`rounded-2xl border px-3 py-4 text-left transition ${
                    purpose === p.id
                      ? "border-brand bg-brand/5 ring-1 ring-brand"
                      : "border-[#e9e2d4] bg-white hover:border-brand/40"
                  }`}
                >
                  <span className="block text-sm font-semibold">{p.label}</span>
                  <span className="mt-1 block text-xs text-slate-500">
                    {p.hint}
                  </span>
                </button>
              ))}
            </div>

            <PrimaryButton
              className="mt-8"
              disabled={!effectiveAmount}
              onClick={() => setStep("details")}
            >
              Continue
              {effectiveAmount ? ` · £${effectiveAmount.toFixed(2)}` : ""}
            </PrimaryButton>
          </StepCard>
        )}

        {step === "details" && (
          <StepCard
            title="Your details"
            subtitle="Add your details for a receipt and Gift Aid, or give anonymously."
            onBack={() => setStep("amount")}
          >
            <div className="space-y-3">
              <KioskInput
                label="Full name"
                value={fullName}
                onChange={setFullName}
                placeholder="e.g. Sarah Adeyemi"
                autoComplete="name"
              />
              <KioskInput
                label="Email (for your receipt)"
                value={email}
                onChange={setEmail}
                placeholder="you@example.com"
                type="email"
                autoComplete="email"
              />
              <KioskInput
                label="Phone (optional)"
                value={phone}
                onChange={setPhone}
                placeholder="07xxx xxxxxx"
                type="tel"
                autoComplete="tel"
              />
            </div>

            <PrimaryButton
              className="mt-8"
              disabled={fullName.trim().length === 0}
              onClick={() => {
                setAnonymous(false);
                if (canOfferGiftAid) setStep("giftaid");
                else void startPayment({ anonymous: false, giftAid: false });
              }}
            >
              Continue
            </PrimaryButton>
            <button
              type="button"
              onClick={() => {
                setAnonymous(true);
                setGiftAidWanted(false);
                void startPayment({ anonymous: true, giftAid: false });
              }}
              className="mt-3 w-full rounded-2xl border border-[#e9e2d4] bg-white px-6 py-4 text-base font-medium text-slate-600 transition hover:border-brand/40"
            >
              Give anonymously instead
            </button>
          </StepCard>
        )}

        {step === "giftaid" && (
          <StepCard
            title="Boost your gift by 25% with Gift Aid"
            subtitle={`If you're a UK taxpayer, ${churchName} can reclaim 25p for every £1 you give, at no extra cost to you.`}
            onBack={() => setStep("details")}
          >
            {effectiveAmount ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-900">
                Your £{effectiveAmount.toFixed(2)} gift would be worth{" "}
                <span className="font-semibold">
                  £{(effectiveAmount * 1.25).toFixed(2)}
                </span>{" "}
                with Gift Aid.
              </div>
            ) : null}

            <div className="mt-4 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setGiftAidWanted(true)}
                className={`rounded-2xl border px-4 py-4 text-base font-semibold transition ${
                  giftAidWanted
                    ? "border-brand bg-brand text-white shadow"
                    : "border-[#e9e2d4] bg-white hover:border-brand/40"
                }`}
              >
                Yes, add Gift Aid
              </button>
              <button
                type="button"
                onClick={() => {
                  setGiftAidWanted(false);
                  setTaxpayerConfirmed(false);
                  void startPayment({ giftAid: false });
                }}
                className="rounded-2xl border border-[#e9e2d4] bg-white px-4 py-4 text-base font-medium text-slate-600 transition hover:border-brand/40"
              >
                No thanks
              </button>
            </div>

            {giftAidWanted && (
              <div className="mt-5 space-y-3">
                <KioskInput
                  label="Home address line 1"
                  value={address1}
                  onChange={setAddress1}
                  placeholder="1 Church Lane"
                  autoComplete="address-line1"
                />
                <KioskInput
                  label="Address line 2 (optional)"
                  value={address2}
                  onChange={setAddress2}
                  placeholder=""
                  autoComplete="address-line2"
                />
                <div className="grid grid-cols-2 gap-3">
                  <KioskInput
                    label="Town / city"
                    value={city}
                    onChange={setCity}
                    placeholder="London"
                    autoComplete="address-level2"
                  />
                  <KioskInput
                    label="Postcode"
                    value={postcode}
                    onChange={setPostcode}
                    placeholder="SW1A 1AA"
                    autoComplete="postal-code"
                  />
                </div>
                <label className="flex items-start gap-3 rounded-2xl border border-[#e9e2d4] bg-white px-4 py-4">
                  <input
                    type="checkbox"
                    checked={taxpayerConfirmed}
                    onChange={(e) => setTaxpayerConfirmed(e.target.checked)}
                    className="mt-1 h-5 w-5 rounded border-slate-300 text-brand focus:ring-brand"
                  />
                  <span className="text-sm text-slate-600">
                    I am a UK taxpayer and understand that if I pay less Income
                    Tax and/or Capital Gains Tax than the amount of Gift Aid
                    claimed on all my donations in that tax year it is my
                    responsibility to pay any difference.
                  </span>
                </label>
                <PrimaryButton
                  disabled={!giftAidValid}
                  onClick={() => void startPayment()}
                >
                  Continue to payment
                </PrimaryButton>
              </div>
            )}
          </StepCard>
        )}

        {step === "qr" && (
          <StepCard
            title={
              minting
                ? "Preparing your payment…"
                : mintError
                  ? "Something went wrong"
                  : "Scan with your phone to pay"
            }
            subtitle={
              minting || mintError
                ? undefined
                : "Open your phone camera, point it at the code, and pay with Apple Pay, Google Pay, or card."
            }
            onBack={() => {
              setQrDataUrl(null);
              setPaymentId(null);
              setMintError(null);
              setStep(anonymous ? "details" : canOfferGiftAid ? "giftaid" : "details");
            }}
          >
            {minting && (
              <div className="flex flex-col items-center py-16">
                <Loader2 className="h-10 w-10 animate-spin text-brand" />
              </div>
            )}

            {!minting && mintError && (
              <div className="flex flex-col items-center py-8 text-center">
                <TriangleAlert className="h-10 w-10 text-amber-500" />
                <p className="mt-4 max-w-sm text-sm text-slate-600">{mintError}</p>
                <PrimaryButton className="mt-6" onClick={() => void startPayment()}>
                  Try again
                </PrimaryButton>
              </div>
            )}

            {!minting && !mintError && qrDataUrl && (
              <div className="flex flex-col items-center">
                <div className="rounded-3xl border border-[#e9e2d4] bg-white p-4 shadow-sm">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={qrDataUrl}
                    alt="Payment QR code"
                    className="h-64 w-64 sm:h-80 sm:w-80"
                  />
                </div>
                <div className="mt-5 flex items-center gap-2 text-slate-700">
                  <Banknote className="h-5 w-5 text-brand" />
                  <span className="text-lg font-semibold">
                    £{effectiveAmount?.toFixed(2)}
                  </span>
                  <span className="text-sm text-slate-500">
                    · {PURPOSES.find((p) => p.id === purpose)?.label}
                  </span>
                </div>
                <div className="mt-3 flex items-center gap-2 text-sm text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Waiting for your payment…
                </div>
              </div>
            )}
          </StepCard>
        )}

        {step === "success" && (
          <div className="mx-auto w-full max-w-xl text-center">
            <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100">
              <Check className="h-10 w-10 text-emerald-600" />
            </span>
            <h1 className="mt-6 text-3xl font-semibold sm:text-4xl">
              Thank you for your generosity
            </h1>
            <p className="mt-3 text-lg text-slate-600">
              Your gift of £{effectiveAmount?.toFixed(2)} to {churchName} has
              been received.
              {giftAidWanted
                ? " We've recorded your Gift Aid declaration alongside it."
                : ""}
              {!anonymous && email.trim()
                ? " A receipt is on its way to your email."
                : ""}
            </p>
            <PrimaryButton className="mx-auto mt-10 max-w-xs" onClick={resetAll}>
              Done
            </PrimaryButton>
            <p className="mt-4 text-sm text-slate-400">
              Returning to the start in {countdown}s
            </p>
          </div>
        )}

        {step === "failed" && (
          <div className="mx-auto w-full max-w-xl text-center">
            <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-amber-100">
              <TriangleAlert className="h-10 w-10 text-amber-600" />
            </span>
            <h1 className="mt-6 text-3xl font-semibold">
              The payment didn&apos;t go through
            </h1>
            <p className="mt-3 text-lg text-slate-600">
              No money has been taken. You can try again, or speak to a member
              of the church team.
            </p>
            <PrimaryButton
              className="mx-auto mt-10 max-w-xs"
              onClick={() => void startPayment()}
            >
              Try again
            </PrimaryButton>
            <button
              type="button"
              onClick={resetAll}
              className="mt-3 text-sm font-medium text-slate-500 underline-offset-4 hover:underline"
            >
              Start over
            </button>
          </div>
        )}
      </div>

      {asleep && (
        <button
          type="button"
          onClick={() => {
            setAsleep(false);
            resetAll();
          }}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950 text-slate-500"
          aria-label="Wake the kiosk"
        >
          <Heart className="h-8 w-8 opacity-40" />
          <p className="mt-4 text-sm">Tap anywhere to wake the giving kiosk</p>
        </button>
      )}
    </main>
  );
}

// ---- Screens + shared bits ----

function WelcomeScreen({
  churchName,
  onStart,
}: {
  churchName: string;
  onStart: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onStart}
      className="mx-auto flex w-full max-w-2xl flex-col items-center rounded-[2.5rem] border border-[#e9e2d4] bg-white px-8 py-16 text-center shadow-sm transition hover:shadow-md sm:py-20"
    >
      <span className="flex h-20 w-20 items-center justify-center rounded-3xl bg-brand/10">
        <HandHeart className="h-10 w-10 text-brand" />
      </span>
      <h1 className="mt-8 text-3xl font-semibold sm:text-5xl">
        Give to {churchName}
      </h1>
      <p className="mt-4 max-w-md text-lg text-slate-600">
        Tithes, offerings, and gifts. Pay securely on your own phone with
        Apple Pay, Google Pay, or card.
      </p>
      <span className="mt-10 inline-flex items-center rounded-full bg-brand px-8 py-4 text-lg font-semibold text-white shadow">
        Tap to begin
      </span>
    </button>
  );
}

function StepCard({
  title,
  subtitle,
  onBack,
  children,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-2xl rounded-[2rem] border border-[#e9e2d4] bg-white p-6 shadow-sm sm:p-10">
      <div className="flex items-start gap-3">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#e9e2d4] text-slate-500 transition hover:text-slate-900"
            aria-label="Go back"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        ) : null}
        <div>
          <h1 className="text-2xl font-semibold sm:text-3xl">{title}</h1>
          {subtitle ? (
            <p className="mt-2 text-base text-slate-600">{subtitle}</p>
          ) : null}
        </div>
      </div>
      <div className="mt-6">{children}</div>
    </div>
  );
}

function KioskInput({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  autoComplete?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-600">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="mt-1.5 w-full rounded-2xl border border-[#e9e2d4] bg-white px-4 py-3.5 text-base outline-none transition placeholder:text-slate-300 focus:border-brand focus:ring-1 focus:ring-brand"
      />
    </label>
  );
}

function PrimaryButton({
  children,
  onClick,
  disabled,
  className = "",
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`block w-full rounded-2xl bg-brand px-6 py-4 text-lg font-semibold text-white shadow transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-40 ${className}`}
    >
      {children}
    </button>
  );
}

// ---- Hooks ----

// Keep the tablet screen awake while the kiosk is in service. Uses the
// Screen Wake Lock API (iPadOS 16.4+ Safari, Chrome, Edge) and re-acquires
// the lock whenever the tab becomes visible again (the lock is released by
// the OS on tab switch / screen off). When `enabled` flips false (the Sleep
// button) the lock is released so the device can sleep on its own schedule.
function useWakeLock(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    let lock: { release: () => Promise<void> } | null = null;
    let cancelled = false;

    const acquire = async () => {
      try {
        const nav = navigator as Navigator & {
          wakeLock?: { request: (type: "screen") => Promise<{ release: () => Promise<void> }> };
        };
        if (!nav.wakeLock) return;
        const acquired = await nav.wakeLock.request("screen");
        if (cancelled) {
          void acquired.release();
          return;
        }
        lock = acquired;
      } catch {
        // Not supported / denied (e.g. low battery). Non-fatal: the church
        // can still disable auto-lock in the tablet settings.
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") void acquire();
    };

    void acquire();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      if (lock) void lock.release();
      lock = null;
    };
  }, [enabled]);
}

// Reset the flow after a stretch of inactivity so the next giver never sees
// the previous person's details. Any touch / key press restarts the clock.
function useIdleReset({
  enabled,
  timeoutMs,
  onIdle,
}: {
  enabled: boolean;
  timeoutMs: number;
  onIdle: () => void;
}) {
  const onIdleRef = useRef(onIdle);
  useEffect(() => {
    onIdleRef.current = onIdle;
  }, [onIdle]);

  useEffect(() => {
    if (!enabled) return;
    let timer = setTimeout(() => onIdleRef.current(), timeoutMs);
    const bump = () => {
      clearTimeout(timer);
      timer = setTimeout(() => onIdleRef.current(), timeoutMs);
    };
    window.addEventListener("pointerdown", bump);
    window.addEventListener("keydown", bump);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("pointerdown", bump);
      window.removeEventListener("keydown", bump);
    };
  }, [enabled, timeoutMs]);
}
