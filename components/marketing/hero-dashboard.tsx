"use client";

// Animated admin dashboard demo for the homepage hero.
//
// Built like the TerminalShowcase tablet: a framed product mock that
// auto-cycles through the core modules (Dashboard, Giving & Gift Aid,
// Members, Services) inside the real admin shell — ChurchPay sidebar logo,
// church switcher, grouped nav whose active item tracks the scene. Screens
// swap with AnimatePresence; numbers count up once per visit; reduced
// motion falls back to simple cross-fades.
//
// NOTE: deliberately does NOT use the `.admin-dashboard-light` class —
// it applies min-h-screen, which is what previously stretched this box.

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import {
  AnimatePresence,
  animate,
  motion,
  useReducedMotion,
} from "framer-motion";
import {
  BarChart3,
  CalendarDays,
  Check,
  HandHeart,
  LayoutDashboard,
  Shield,
  TrendingUp,
  UserCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";

const SCENES = ["dashboard", "giving", "members", "services"] as const;
type Scene = (typeof SCENES)[number];

const SCENE_DURATION_MS = 4000;

const SCENE_META: Record<Scene, { title: string; caption: string }> = {
  dashboard: { title: "Dashboard", caption: "One clear picture of your church" },
  giving: { title: "Giving & Gift Aid", caption: "Every gift counted, every claim ready" },
  members: { title: "Members", caption: "Your whole congregation, one record" },
  services: { title: "Services", caption: "Sundays planned, notices sent" },
};

const NAV: { scene: Scene; label: string; icon: typeof LayoutDashboard }[] = [
  { scene: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { scene: "giving", label: "Giving & Gift Aid", icon: HandHeart },
  { scene: "members", label: "Members", icon: UserCheck },
  { scene: "services", label: "Services", icon: CalendarDays },
];

export function HeroDashboard() {
  const reducedMotion = useReducedMotion();
  const [mounted, setMounted] = useState(false);
  const [sceneIndex, setSceneIndex] = useState(0);
  const scene = SCENES[sceneIndex];

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const timer = setTimeout(
      () => setSceneIndex((i) => (i + 1) % SCENES.length),
      SCENE_DURATION_MS,
    );
    return () => clearTimeout(timer);
  }, [mounted, sceneIndex]);

  const screenVariants = reducedMotion
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
      }
    : {
        initial: { opacity: 0, y: 14 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -10 },
      };

  return (
    <div className="relative mx-auto w-full max-w-[34.5rem]">
      {/* Floating chips */}
      <FloatingChip className="-left-3 top-20 sm:-left-8" delay={0} reducedMotion={!!reducedMotion}>
        <Shield className="h-3.5 w-3.5 text-emerald-600" />
        Gift Aid ready
      </FloatingChip>
      {/* App frame */}
      <div className="overflow-hidden rounded-[1.5rem] border border-[#e3dccb] bg-white text-[hsl(var(--dash-text))] shadow-[0_24px_60px_-20px_rgba(30,41,59,0.25)]">
        <div className="flex">
          {/* Sidebar — mirrors the real AdminSidebar */}
          <aside className="hidden w-[10rem] shrink-0 flex-col border-r border-dash-border bg-dash-surface sm:flex">
            <div className="flex h-12 shrink-0 items-center border-b border-dash-border px-3">
              <Image
                src="/brand/churchpay-sidebar-logo.png"
                alt="ChurchPay"
                width={1032}
                height={245}
                priority
                className="h-7 w-auto max-w-full object-contain"
              />
            </div>
            <div className="shrink-0 border-b border-dash-border px-2 py-2">
              <div className="flex items-center gap-1.5 rounded-lg border border-dash-border bg-dash-surface-subtle px-2 py-1.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-brand/10 text-brand">
                  <HandHeart className="h-3 w-3" />
                </span>
                <span className="min-w-0 truncate text-[10px] font-semibold">
                  St Mary&apos;s Church
                </span>
              </div>
            </div>
            <nav aria-hidden className="space-y-0.5 p-2">
              <p className="px-2 pb-1 text-[8px] font-semibold uppercase tracking-wider text-dash-faint">
                Main
              </p>
              {NAV.map((item) => {
                const Icon = item.icon;
                const active = item.scene === scene;
                return (
                  <div
                    key={item.scene}
                    className={cn(
                      "flex items-center gap-2 rounded-lg px-2 py-1.5 text-[10px] font-medium transition-colors duration-300",
                      active
                        ? "bg-[hsl(var(--dash-ring)/0.08)] text-[hsl(var(--dash-ring))]"
                        : "text-dash-muted",
                    )}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
                    <span className="truncate">{item.label}</span>
                  </div>
                );
              })}
            </nav>
          </aside>

          {/* Main panel */}
          <div className="min-w-0 flex-1 bg-dash-bg">
            <header className="flex h-12 items-center gap-2.5 border-b border-dash-border bg-dash-surface/95 px-3">
              <Image
                src="/brand/churchpay-sidebar-logo.png"
                alt=""
                width={1032}
                height={245}
                aria-hidden
                className="h-5 w-auto object-contain sm:hidden"
              />
              <div className="min-w-0">
                <p className="text-[8px] font-medium uppercase tracking-[0.14em] text-dash-faint">
                  Church admin
                </p>
                <AnimatePresence mode="wait">
                  <motion.h2
                    key={scene}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="truncate text-xs font-semibold tracking-tight sm:text-sm"
                  >
                    {SCENE_META[scene].title}
                  </motion.h2>
                </AnimatePresence>
              </div>
            </header>

            {/* Fixed-height stage so every scene swaps in the same box */}
            <div className="relative h-[16.5rem] sm:h-[18.5rem]">
              <AnimatePresence mode="wait">
                <motion.div
                  key={scene}
                  variants={screenVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  transition={{ duration: 0.3, ease: "easeOut" }}
                  className="absolute inset-0 p-2.5 sm:p-3"
                >
                  {scene === "dashboard" && <DashboardScene reducedMotion={!!reducedMotion} />}
                  {scene === "giving" && <GivingScene reducedMotion={!!reducedMotion} />}
                  {scene === "members" && <MembersScene reducedMotion={!!reducedMotion} />}
                  {scene === "services" && <ServicesScene reducedMotion={!!reducedMotion} />}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>

      {/* Scene progress dots + caption */}
      <div className="mt-4 flex items-center justify-center gap-2" aria-hidden>
        {SCENES.map((s, i) => (
          <motion.span
            key={s}
            animate={{
              width: i === sceneIndex ? 22 : 8,
              backgroundColor: i === sceneIndex ? "#0B43B8" : "#ddd5c4",
            }}
            transition={{ duration: 0.3 }}
            className="h-2 rounded-full"
          />
        ))}
      </div>
      <AnimatePresence mode="wait">
        <motion.p
          key={scene}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="mt-2 text-center text-xs text-slate-400"
        >
          {SCENE_META[scene].caption}
        </motion.p>
      </AnimatePresence>
    </div>
  );
}

// ---- Scenes ----

function DashboardScene({ reducedMotion }: { reducedMotion: boolean }) {
  const bars = [49, 72, 58, 84, 76, 100];

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex min-h-0 flex-1 flex-col rounded-lg border border-dash-border bg-dash-surface shadow-[var(--dash-shadow)]">
        <div className="flex items-center justify-between border-b border-dash-border bg-dash-surface-subtle px-2.5 py-1.5">
          <span className="text-[10px] font-semibold">Payment volume</span>
          <span className="text-[8px] font-medium text-dash-muted">By month</span>
        </div>
        <div className="flex min-h-0 flex-1 items-end gap-1.5 px-2.5 pb-2 pt-2" aria-hidden>
          {bars.map((pct, index) => (
            <div key={index} className="flex h-full min-w-0 flex-1 items-end">
              <motion.div
                initial={reducedMotion ? false : { height: "0%" }}
                animate={{ height: `${pct}%` }}
                transition={{ delay: 0.25 + index * 0.05, duration: 0.4, ease: "easeOut" }}
                className={cn(
                  "w-full rounded-t-md",
                  index === bars.length - 1
                    ? "bg-gradient-to-t from-blue-600 to-blue-400/70"
                    : "bg-gradient-to-t from-blue-600/80 to-blue-400/40",
                )}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function GivingScene({ reducedMotion }: { reducedMotion: boolean }) {
  const gifts = [
    { name: "Sarah Adeyemi", detail: "Tithe · kiosk", amount: "£25.00", giftAid: true },
    { name: "The Okafor family", detail: "Online giving", amount: "£60.00", giftAid: true },
    { name: "Anonymous", detail: "Sunday collection", amount: "£12.50", giftAid: false },
  ];

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="grid grid-cols-2 gap-1.5">
        <Stagger index={0} reducedMotion={reducedMotion}>
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2.5">
            <p className="text-[8px] font-medium uppercase tracking-wide text-emerald-800">
              Gift Aid to claim
            </p>
            <p className="text-lg font-bold tabular-nums text-emerald-700">
              <CountUp to={2310} prefix="£" reducedMotion={reducedMotion} />
            </p>
            <span className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-emerald-600 px-1.5 py-0.5 text-[7px] font-semibold text-white">
              <Check className="h-2 w-2" />
              HMRC-ready
            </span>
          </div>
        </Stagger>
        <Stagger index={1} reducedMotion={reducedMotion}>
          <div className="rounded-lg border border-dash-border bg-dash-surface p-2.5 shadow-[var(--dash-shadow)]">
            <p className="text-[8px] font-medium uppercase tracking-wide text-dash-muted">
              Giving this month
            </p>
            <p className="text-lg font-bold tabular-nums">
              <CountUp to={12480} prefix="£" reducedMotion={reducedMotion} />
            </p>
            <span className="mt-0.5 inline-flex items-center gap-0.5 text-[8px] font-semibold text-emerald-600">
              <TrendingUp className="h-2.5 w-2.5" />
              +8.2% on last month
            </span>
          </div>
        </Stagger>
      </div>

      <div className="min-h-0 flex-1 rounded-lg border border-dash-border bg-dash-surface shadow-[var(--dash-shadow)]">
        <p className="border-b border-dash-border bg-dash-surface-subtle px-2.5 py-1.5 text-[10px] font-semibold">
          Recent gifts
        </p>
        <ul className="space-y-1 p-2">
          {gifts.map((gift, index) => (
            <Stagger key={gift.name} index={index + 2} reducedMotion={reducedMotion}>
              <li className="flex items-center justify-between rounded-md bg-dash-surface-subtle px-2 py-1.5">
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand/10 text-[8px] font-bold text-brand">
                    {gift.name.charAt(0)}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[9px] font-semibold">{gift.name}</span>
                    <span className="block text-[7px] text-dash-muted">{gift.detail}</span>
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-1">
                  {gift.giftAid && (
                    <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[7px] font-semibold text-emerald-700">
                      +25%
                    </span>
                  )}
                  <span className="text-[9px] font-bold tabular-nums">{gift.amount}</span>
                </span>
              </li>
            </Stagger>
          ))}
        </ul>
      </div>
    </div>
  );
}

function MembersScene({ reducedMotion }: { reducedMotion: boolean }) {
  const members = [
    { name: "Grace Mensah", role: "Member · Worship team", status: "Active", tone: "emerald" },
    { name: "Daniel Osei", role: "Member · Gift Aid declared", status: "Active", tone: "emerald" },
    { name: "Ruth Bakare", role: "Newcomer · 2nd visit", status: "Follow up", tone: "amber" },
    { name: "Tom Whitfield", role: "Member · Welcome team", status: "Active", tone: "emerald" },
  ];

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="grid grid-cols-3 gap-1.5">
        {[
          { label: "Members", value: "312" },
          { label: "Families", value: "94" },
          { label: "Consented", value: "98%" },
        ].map((stat, index) => (
          <Stagger key={stat.label} index={index} reducedMotion={reducedMotion}>
            <div className="rounded-lg border border-dash-border bg-dash-surface p-2 text-center shadow-[var(--dash-shadow)]">
              <p className="text-base font-semibold leading-tight">{stat.value}</p>
              <p className="text-[7px] font-medium uppercase tracking-wide text-dash-muted">
                {stat.label}
              </p>
            </div>
          </Stagger>
        ))}
      </div>

      <div className="min-h-0 flex-1 rounded-lg border border-dash-border bg-dash-surface shadow-[var(--dash-shadow)]">
        <p className="border-b border-dash-border bg-dash-surface-subtle px-2.5 py-1.5 text-[10px] font-semibold">
          Congregation
        </p>
        <ul className="space-y-1 p-2">
          {members.map((member, index) => (
            <Stagger key={member.name} index={index + 3} reducedMotion={reducedMotion}>
              <li className="flex items-center justify-between rounded-md bg-dash-surface-subtle px-2 py-1.5">
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand/10 text-[8px] font-bold text-brand">
                    {member.name.charAt(0)}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[9px] font-semibold">{member.name}</span>
                    <span className="block truncate text-[7px] text-dash-muted">{member.role}</span>
                  </span>
                </span>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-1.5 py-0.5 text-[7px] font-semibold",
                    member.tone === "emerald"
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-amber-50 text-amber-700",
                  )}
                >
                  {member.status}
                </span>
              </li>
            </Stagger>
          ))}
        </ul>
      </div>
    </div>
  );
}

function ServicesScene({ reducedMotion }: { reducedMotion: boolean }) {
  const services = [
    { name: "Sunday service", date: "Sun 14 Jun · 10:30", rsvps: "118 attending", notice: true },
    { name: "Midweek prayer", date: "Wed 17 Jun · 19:00", rsvps: "42 attending", notice: true },
    { name: "Youth night", date: "Fri 19 Jun · 18:30", rsvps: "36 attending", notice: false },
  ];

  return (
    <div className="flex h-full flex-col gap-2">
      <Stagger index={0} reducedMotion={reducedMotion}>
        <div className="flex items-center justify-between rounded-lg border border-dash-border bg-dash-surface p-2.5 shadow-[var(--dash-shadow)]">
          <div>
            <p className="text-[8px] font-medium uppercase tracking-wide text-dash-muted">
              Next service
            </p>
            <p className="text-xs font-semibold">Sunday 14 June · 10:30am</p>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[8px] font-semibold text-emerald-700">
            <Check className="h-2.5 w-2.5" />
            Notices sent
          </span>
        </div>
      </Stagger>

      <div className="min-h-0 flex-1 rounded-lg border border-dash-border bg-dash-surface shadow-[var(--dash-shadow)]">
        <p className="border-b border-dash-border bg-dash-surface-subtle px-2.5 py-1.5 text-[10px] font-semibold">
          Upcoming
        </p>
        <ul className="space-y-1 p-2">
          {services.map((service, index) => (
            <Stagger key={service.name} index={index + 1} reducedMotion={reducedMotion}>
              <li className="flex items-center justify-between rounded-md bg-dash-surface-subtle px-2 py-1.5">
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-brand/10 text-brand">
                    <CalendarDays className="h-3 w-3" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[9px] font-semibold">{service.name}</span>
                    <span className="block text-[7px] text-dash-muted">{service.date}</span>
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-1">
                  <span className="text-[8px] font-medium text-dash-muted">{service.rsvps}</span>
                  {service.notice && (
                    <span className="rounded-full bg-brand/10 px-1.5 py-0.5 text-[7px] font-semibold text-brand">
                      Notice
                    </span>
                  )}
                </span>
              </li>
            </Stagger>
          ))}
        </ul>
      </div>

      <Stagger index={4} reducedMotion={reducedMotion}>
        <div className="flex items-center gap-1.5 rounded-lg border border-dash-border bg-dash-surface px-2.5 py-1.5 text-[8px] text-dash-muted shadow-[var(--dash-shadow)]">
          <BarChart3 className="h-3 w-3 text-brand" aria-hidden />
          Attendance and giving roll up to treasurer reports automatically.
        </div>
      </Stagger>
    </div>
  );
}

// ---- Shared bits ----

function Stagger({
  children,
  index,
  reducedMotion,
}: {
  children: React.ReactNode;
  index: number;
  reducedMotion: boolean;
}) {
  return (
    <motion.div
      initial={reducedMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 + index * 0.07, duration: 0.3 }}
    >
      {children}
    </motion.div>
  );
}

function CountUp({
  to,
  prefix,
  reducedMotion,
}: {
  to: number;
  prefix: string;
  reducedMotion: boolean;
}) {
  const [value, setValue] = useState(reducedMotion ? to : 0);
  const started = useRef(false);

  useEffect(() => {
    if (reducedMotion) {
      setValue(to);
      return;
    }
    if (started.current) return;
    started.current = true;
    const controls = animate(0, to, {
      delay: 0.3,
      duration: 0.9,
      ease: "easeOut",
      onUpdate: (v) => setValue(Math.round(v)),
    });
    return () => controls.stop();
  }, [to, reducedMotion]);

  return (
    <>
      {prefix}
      {value.toLocaleString("en-GB")}
    </>
  );
}

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
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.4 + delay * 0.2 }}
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
