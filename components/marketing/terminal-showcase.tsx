"use client";

// "Turn any tablet into a giving terminal" homepage section.
//
// The right-hand side is an animated simulation of the real self-service
// kiosk (/give/<slug>/kiosk): amount -> Gift Aid boost -> QR -> thank you,
// auto-playing on a loop inside a CSS-drawn tablet frame. It deliberately
// reuses the kiosk's visual language (cream background, brand blue, rounded
// buttons) so the demo a visitor watches here is the product they get.
//
// All motion respects prefers-reduced-motion: the loop still advances, but
// screens cross-fade without movement and the floating chips hold still.

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AnimatePresence,
  animate,
  motion,
  useReducedMotion,
} from "framer-motion";
import {
  ArrowRight,
  Banknote,
  Check,
  HandHeart,
  MailCheck,
  QrCode,
  TabletSmartphone,
  Wifi,
} from "lucide-react";
import {
  MarketingSection,
  MarketingKicker,
} from "@/components/marketing/marketing-shell";

const STEPS = ["amount", "giftaid", "qr", "success"] as const;
type DemoStep = (typeof STEPS)[number];

const STEP_DURATIONS: Record<DemoStep, number> = {
  amount: 3400,
  giftaid: 3800,
  qr: 3400,
  success: 3600,
};

const FEATURES = [
  {
    Icon: TabletSmartphone,
    title: "Self-service kiosk mode",
    body: "Open one link full-screen and the tablet becomes a giving station. It stays awake all service and resets itself between givers.",
  },
  {
    Icon: QrCode,
    title: "They pay on their own phone",
    body: "The kiosk shows a QR code; the giver scans it and pays with Apple Pay, Google Pay, or card. The tablet never touches card details.",
  },
  {
    Icon: HandHeart,
    title: "Gift Aid at the point of giving",
    body: "A digital declaration is signed right on the screen, so a £20 gift is worth £25 before the giver has sat back down.",
  },
];

export function TerminalShowcase() {
  return (
    <MarketingSection className="overflow-hidden">
      <div className="grid items-center gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* Pitch */}
        <div>
          <MarketingKicker>In-person giving</MarketingKicker>
          <h2 className="mt-4 font-heading text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Turn any tablet into a giving terminal.
          </h2>
          <p className="mt-4 max-w-xl text-base leading-7 text-slate-600">
            Sunday morning, a member walks up to the tablet by the door, taps an
            amount, signs Gift Aid, and pays on their own phone. Receipt sent,
            declaration logged, treasurer&apos;s ledger updated before the final
            hymn.
          </p>
          <ul className="mt-9 space-y-6">
            {FEATURES.map(({ Icon, title, body }, index) => (
              <motion.li
                key={title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.5, delay: index * 0.12 }}
                className="flex gap-4"
              >
                <span className="mt-0.5 inline-flex h-11 w-11 flex-none items-center justify-center rounded-2xl bg-brand/8 text-brand">
                  <Icon className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="font-heading text-base font-semibold text-slate-900">
                    {title}
                  </h3>
                  <p className="mt-1 text-sm leading-6 text-slate-600">{body}</p>
                </div>
              </motion.li>
            ))}
          </ul>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link
              href="/book-demo"
              className="inline-flex items-center gap-2 rounded-xl bg-brand px-7 py-3.5 text-sm font-semibold text-white shadow-[0_12px_28px_-8px_rgba(11,67,184,0.5)] transition-colors hover:bg-brand-dark"
            >
              Book a church demo
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/features"
              className="inline-flex items-center rounded-xl border border-[#ddd5c4] bg-white px-7 py-3.5 text-sm font-semibold text-slate-800 shadow-sm transition-colors hover:border-brand/30 hover:text-brand"
            >
              Explore features
            </Link>
          </div>
        </div>

        {/* Animated tablet demo */}
        <TabletDemo />
      </div>
    </MarketingSection>
  );
}

function TabletDemo() {
  const reducedMotion = useReducedMotion();
  const [stepIndex, setStepIndex] = useState(0);
  const step = STEPS[stepIndex];

  useEffect(() => {
    const timer = setTimeout(
      () => setStepIndex((i) => (i + 1) % STEPS.length),
      STEP_DURATIONS[step],
    );
    return () => clearTimeout(timer);
  }, [step]);

  const screenVariants = reducedMotion
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
      }
    : {
        initial: { opacity: 0, y: 24 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -18 },
      };

  return (
    <motion.div
      initial={reducedMotion ? { opacity: 0 } : { opacity: 0, x: 48, rotate: 1.5 }}
      whileInView={{ opacity: 1, x: 0, rotate: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.7, ease: "easeOut" }}
      className="relative mx-auto w-full max-w-[26rem]"
    >
      {/* Soft glow behind the device */}
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-10 -z-10 rounded-[3rem] bg-[radial-gradient(60%_60%_at_50%_40%,rgba(11,67,184,0.16),transparent_70%)] blur-2xl"
      />

      {/* Floating chips */}
      <FloatingChip
        className="-left-3 top-10 sm:-left-10"
        delay={0}
        reducedMotion={!!reducedMotion}
      >
        <Wifi className="h-3.5 w-3.5 text-brand" />
        Apple Pay &amp; Google Pay
      </FloatingChip>
      <FloatingChip
        className="-right-2 top-1/3 sm:-right-8"
        delay={1.4}
        reducedMotion={!!reducedMotion}
      >
        <HandHeart className="h-3.5 w-3.5 text-emerald-600" />
        Gift Aid +25%
      </FloatingChip>
      <FloatingChip
        className="-left-2 bottom-16 sm:-left-8"
        delay={2.6}
        reducedMotion={!!reducedMotion}
      >
        <MailCheck className="h-3.5 w-3.5 text-brand" />
        Receipt sent
      </FloatingChip>

      {/* Tablet frame */}
      <div className="rounded-[2.4rem] border border-slate-800 bg-slate-900 p-3 shadow-[0_32px_70px_-24px_rgba(15,23,42,0.45)]">
        <div aria-hidden className="mx-auto mb-2 h-1.5 w-10 rounded-full bg-slate-700" />
        <div className="relative h-[28rem] overflow-hidden rounded-[1.8rem] bg-[#faf8f3]">
          {/* Kiosk header, mirrors the real kiosk */}
          <div className="flex items-center gap-2.5 border-b border-[#efe9dc] px-5 py-3.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand text-white">
              <HandHeart className="h-3.5 w-3.5" />
            </span>
            <div>
              <p className="text-xs font-semibold leading-tight text-slate-900">
                St Mary&apos;s Church
              </p>
              <p className="text-[10px] text-slate-500">Giving kiosk</p>
            </div>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              variants={screenVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.35, ease: "easeOut" }}
              className="absolute inset-x-0 bottom-0 top-[3.4rem] px-5 py-5"
            >
              {step === "amount" && <AmountScreen reducedMotion={!!reducedMotion} />}
              {step === "giftaid" && <GiftAidScreen reducedMotion={!!reducedMotion} />}
              {step === "qr" && <QrScreen reducedMotion={!!reducedMotion} />}
              {step === "success" && <SuccessScreen reducedMotion={!!reducedMotion} />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Step progress dots */}
      <div className="mt-5 flex items-center justify-center gap-2" aria-hidden>
        {STEPS.map((s, i) => (
          <motion.span
            key={s}
            animate={{
              width: i === stepIndex ? 22 : 8,
              backgroundColor: i === stepIndex ? "#0B43B8" : "#ddd5c4",
            }}
            transition={{ duration: 0.3 }}
            className="h-2 rounded-full"
          />
        ))}
      </div>
      <p className="mt-2 text-center text-xs text-slate-400">
        The real kiosk flow, exactly as your congregation sees it.
      </p>
    </motion.div>
  );
}

// ---- Screens ----

function AmountScreen({ reducedMotion }: { reducedMotion: boolean }) {
  return (
    <div>
      <p className="font-heading text-lg font-semibold text-slate-900">
        How much would you like to give?
      </p>
      <div className="mt-4 grid grid-cols-3 gap-2.5">
        {[10, 20, 50].map((value, index) => {
          const selected = value === 20;
          return (
            <motion.div
              key={value}
              initial={reducedMotion ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 + index * 0.1, duration: 0.3 }}
              className="relative"
            >
              <motion.div
                animate={
                  selected
                    ? {
                        backgroundColor: ["#ffffff", "#ffffff", "#0B43B8"],
                        color: ["#0f172a", "#0f172a", "#ffffff"],
                        scale: reducedMotion ? 1 : [1, 1, 0.94, 1],
                        borderColor: ["#e9e2d4", "#e9e2d4", "#0B43B8"],
                      }
                    : {}
                }
                transition={{ delay: 1.1, duration: 0.5, times: [0, 0.5, 0.7, 1] }}
                className="rounded-2xl border border-[#e9e2d4] bg-white px-2 py-4 text-center text-lg font-semibold text-slate-900 shadow-sm"
              >
                £{value}
              </motion.div>
              {/* Tap ripple on the selected preset */}
              {selected && !reducedMotion && (
                <motion.span
                  aria-hidden
                  initial={{ opacity: 0, scale: 0.4 }}
                  animate={{ opacity: [0, 0.5, 0], scale: [0.4, 1.6, 1.9] }}
                  transition={{ delay: 1.15, duration: 0.7 }}
                  className="pointer-events-none absolute inset-0 rounded-2xl border-2 border-brand"
                />
              )}
            </motion.div>
          );
        })}
      </div>
      <motion.div
        initial={reducedMotion ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45, duration: 0.3 }}
        className="mt-3 flex items-center rounded-2xl border border-[#e9e2d4] bg-white px-4 py-3 text-slate-300"
      >
        <span className="text-lg font-semibold text-slate-400">£</span>
        <span className="ml-2 text-base">Other amount</span>
      </motion.div>
      <div className="mt-4 grid grid-cols-2 gap-2.5">
        {["Tithe", "Offering"].map((label, index) => (
          <motion.div
            key={label}
            initial={reducedMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55 + index * 0.1, duration: 0.3 }}
            className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${
              label === "Tithe"
                ? "border-brand bg-brand/5 text-slate-900 ring-1 ring-brand"
                : "border-[#e9e2d4] bg-white text-slate-600"
            }`}
          >
            {label}
          </motion.div>
        ))}
      </div>
      <motion.div
        initial={reducedMotion ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.8, duration: 0.4 }}
        className="mt-5 rounded-2xl bg-brand px-5 py-3.5 text-center text-base font-semibold text-white shadow"
      >
        Continue · £20.00
      </motion.div>
    </div>
  );
}

function GiftAidScreen({ reducedMotion }: { reducedMotion: boolean }) {
  const [display, setDisplay] = useState(reducedMotion ? 25 : 20);
  const [boosted, setBoosted] = useState(reducedMotion);

  useEffect(() => {
    if (reducedMotion) return;
    const controls = animate(20, 25, {
      delay: 1.2,
      duration: 1.1,
      ease: "easeOut",
      onUpdate: (v) => setDisplay(v),
      onComplete: () => setBoosted(true),
    });
    const flag = setTimeout(() => setBoosted(true), 2300);
    return () => {
      controls.stop();
      clearTimeout(flag);
    };
  }, [reducedMotion]);

  return (
    <div>
      <p className="font-heading text-lg font-semibold text-slate-900">
        Boost your gift by 25% with Gift Aid
      </p>
      <p className="mt-1.5 text-xs leading-5 text-slate-500">
        UK taxpayer? The church reclaims 25p for every £1, at no cost to you.
      </p>

      {/* The headline number ticking from £20 to £25 */}
      <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-5 text-center">
        <p className="text-xs font-medium text-emerald-800">Your gift is worth</p>
        <p className="mt-1 font-heading text-4xl font-bold tabular-nums text-emerald-700">
          £{display.toFixed(2)}
        </p>
        <motion.span
          initial={{ opacity: 0, scale: 0.7 }}
          animate={boosted ? { opacity: 1, scale: 1 } : {}}
          transition={{ type: "spring", stiffness: 300, damping: 18 }}
          className="mt-2 inline-flex items-center gap-1 rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold text-white"
        >
          <HandHeart className="h-3 w-3" />
          +£5.00 Gift Aid
        </motion.span>
      </div>

      {/* Toggle flipping on */}
      <div className="mt-4 flex items-center justify-between rounded-2xl border border-[#e9e2d4] bg-white px-4 py-3.5">
        <span className="text-sm font-medium text-slate-700">
          Add Gift Aid to this gift
        </span>
        <motion.span
          animate={{
            backgroundColor: ["#e2e8f0", "#e2e8f0", "#0B43B8"],
          }}
          transition={{ delay: 0.8, duration: 0.4, times: [0, 0.6, 1] }}
          className="relative h-7 w-12 rounded-full"
        >
          <motion.span
            animate={reducedMotion ? { x: 20 } : { x: [0, 0, 20] }}
            transition={{ delay: 0.8, duration: 0.4, times: [0, 0.6, 1] }}
            className="absolute left-1 top-1 h-5 w-5 rounded-full bg-white shadow"
          />
        </motion.span>
      </div>

      <motion.div
        initial={reducedMotion ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2.4, duration: 0.4 }}
        className="mt-4 rounded-2xl bg-brand px-5 py-3.5 text-center text-base font-semibold text-white shadow"
      >
        Continue to payment
      </motion.div>
    </div>
  );
}

// Deterministic faux-QR bitmap: finder squares in three corners plus a
// stable pseudo-random fill. Purely decorative.
const QR_SIZE = 15;
function qrCellFilled(row: number, col: number): boolean {
  const inFinder = (r: number, c: number) =>
    (r < 5 && c < 5) || (r < 5 && c >= QR_SIZE - 5) || (r >= QR_SIZE - 5 && c < 5);
  if (inFinder(row, col)) {
    const lr = row < 5 ? row : row - (QR_SIZE - 5);
    const lc = col < 5 ? col : col - (QR_SIZE - 5);
    return lr === 0 || lr === 4 || lc === 0 || lc === 4 || (lr === 2 && lc === 2);
  }
  return ((row * 7 + col * 13 + (row * col) % 5) % 17) % 3 === 0;
}

function QrScreen({ reducedMotion }: { reducedMotion: boolean }) {
  return (
    <div className="flex h-full flex-col items-center">
      <p className="font-heading text-lg font-semibold text-slate-900">
        Scan with your phone to pay
      </p>
      <motion.div
        initial={reducedMotion ? false : { opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.2, duration: 0.4 }}
        className="relative mt-4 overflow-hidden rounded-2xl border border-[#e9e2d4] bg-white p-3 shadow-sm"
      >
        <div
          className="grid gap-[2px]"
          style={{ gridTemplateColumns: `repeat(${QR_SIZE}, 9px)` }}
          aria-hidden
        >
          {Array.from({ length: QR_SIZE * QR_SIZE }, (_, i) => {
            const row = Math.floor(i / QR_SIZE);
            const col = i % QR_SIZE;
            return (
              <span
                key={i}
                className={`h-[9px] w-[9px] rounded-[1.5px] ${
                  qrCellFilled(row, col) ? "bg-slate-900" : "bg-transparent"
                }`}
              />
            );
          })}
        </div>
        {/* Phone-scan shimmer sweeping over the code */}
        {!reducedMotion && (
          <motion.div
            aria-hidden
            initial={{ y: "-120%" }}
            animate={{ y: "320%" }}
            transition={{ delay: 0.7, duration: 1.6, repeat: Infinity, repeatDelay: 0.6, ease: "easeInOut" }}
            className="pointer-events-none absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-transparent via-brand/15 to-transparent"
          />
        )}
      </motion.div>
      <div className="mt-4 flex items-center gap-2 text-slate-700">
        <Banknote className="h-4 w-4 text-brand" />
        <span className="text-base font-semibold">£20.00</span>
        <span className="text-xs text-slate-500">· Tithe · Gift Aid added</span>
      </div>
      <div className="mt-3 flex gap-2">
        {["Apple Pay", "Google Pay", "Card"].map((label, index) => (
          <motion.span
            key={label}
            initial={reducedMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 + index * 0.12, duration: 0.3 }}
            className="rounded-full border border-[#e9e2d4] bg-white px-3 py-1 text-[11px] font-medium text-slate-600"
          >
            {label}
          </motion.span>
        ))}
      </div>
    </div>
  );
}

function SuccessScreen({ reducedMotion }: { reducedMotion: boolean }) {
  return (
    <div className="flex h-full flex-col items-center justify-center pb-8 text-center">
      <motion.span
        initial={reducedMotion ? { opacity: 0 } : { scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 16 }}
        className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100"
      >
        <svg viewBox="0 0 24 24" className="h-10 w-10" aria-hidden>
          <motion.path
            d="M4.5 12.5l5 5 10-11"
            fill="none"
            stroke="#059669"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={reducedMotion ? { pathLength: 1 } : { pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ delay: 0.25, duration: 0.5, ease: "easeOut" }}
          />
        </svg>
      </motion.span>
      {/* Celebration dots */}
      {!reducedMotion && (
        <div aria-hidden className="pointer-events-none relative h-0 w-0">
          {[...Array(6)].map((_, i) => {
            const angle = (i / 6) * Math.PI * 2;
            return (
              <motion.span
                key={i}
                initial={{ opacity: 0, x: 0, y: -40 }}
                animate={{
                  opacity: [0, 1, 0],
                  x: Math.cos(angle) * 56,
                  y: -40 + Math.sin(angle) * 56,
                }}
                transition={{ delay: 0.35, duration: 0.9, ease: "easeOut" }}
                className={`absolute h-2 w-2 rounded-full ${
                  i % 2 === 0 ? "bg-brand/60" : "bg-emerald-400"
                }`}
              />
            );
          })}
        </div>
      )}
      <motion.p
        initial={reducedMotion ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45, duration: 0.4 }}
        className="mt-5 font-heading text-xl font-semibold text-slate-900"
      >
        Thank you for your generosity
      </motion.p>
      <motion.div
        initial={reducedMotion ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7, duration: 0.4 }}
        className="mt-3 space-y-1.5 text-xs text-slate-500"
      >
        <p className="flex items-center justify-center gap-1.5">
          <Check className="h-3.5 w-3.5 text-emerald-600" />
          £25.00 with Gift Aid · recorded for the treasurer
        </p>
        <p className="flex items-center justify-center gap-1.5">
          <MailCheck className="h-3.5 w-3.5 text-brand" />
          Receipt on its way to your inbox
        </p>
      </motion.div>
    </div>
  );
}

// ---- Bits ----

function FloatingChip({
  children,
  className,
  delay,
  reducedMotion,
}: {
  children: React.ReactNode;
  className: string;
  delay: number;
  reducedMotion: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay: 0.3 + delay * 0.2 }}
      className={`absolute z-10 ${className}`}
    >
      <motion.span
        animate={reducedMotion ? {} : { y: [0, -7, 0] }}
        transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut", delay }}
        className="flex items-center gap-1.5 rounded-full border border-[#e9e2d4] bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-[0_10px_24px_-10px_rgba(30,41,59,0.25)]"
      >
        {children}
      </motion.span>
    </motion.div>
  );
}
