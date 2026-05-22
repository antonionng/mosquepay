"use client";

import type { ReactNode } from "react";
import { FadeIn } from "@/components/motion";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  CreditCard,
  Globe,
  HeartHandshake,
  LayoutDashboard,
  Mail,
  MousePointer2,
  Sparkles,
  Users,
} from "lucide-react";

type FeatureIllustrationProps = {
  children: ReactNode;
};

function FeatureIllustrationFrame({ children }: FeatureIllustrationProps) {
  return (
    <div className="relative h-[320px] w-full overflow-hidden rounded-[28px] border border-white/10 bg-[#151924] shadow-[0_28px_90px_rgba(0,0,0,0.28)] sm:h-[380px]">
      <div className="absolute -left-20 -top-24 h-64 w-64 rounded-full bg-mkt-blue/35 blur-3xl" />
      <div className="absolute -bottom-24 right-0 h-72 w-72 rounded-full bg-violet-500/20 blur-3xl" />
      <div
        className="absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.55) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.55) 1px, transparent 1px)",
          backgroundSize: "34px 34px",
        }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.12),transparent_45%)]" />
      <div className="relative h-full p-5 sm:p-7">{children}</div>
    </div>
  );
}

function WebsiteBuilderIllustration() {
  return (
    <FeatureIllustrationFrame>
      <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-slate-950/55 backdrop-blur">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-mkt-blue text-white">
              <Globe className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Covenant Lodge site</p>
              <p className="text-xs text-white/45">Live preview</p>
            </div>
          </div>
          <span className="rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-medium text-emerald-200">
            Ready
          </span>
        </div>
        <div className="grid flex-1 grid-cols-[112px_1fr] gap-3 p-3 sm:grid-cols-[148px_1fr] sm:gap-4 sm:p-4">
          <div className="space-y-2 rounded-xl border border-white/10 bg-white/[0.04] p-3">
            {([
              ["Hero", true],
              ["History", false],
              ["Officers", false],
              ["Charity", false],
              ["Join us", false],
            ] as const).map(([label, active]) => (
              <div
                key={label}
                className={`rounded-lg px-3 py-2 text-xs font-medium ${
                  active ? "bg-white text-slate-950" : "bg-white/[0.04] text-white/55"
                }`}
              >
                {label}
              </div>
            ))}
          </div>
          <div className="relative overflow-hidden rounded-xl bg-white text-slate-950">
            <div className="h-24 bg-gradient-to-br from-mkt-blue via-blue-500 to-violet-500 sm:h-32" />
            <div className="space-y-3 p-4">
              <div className="h-3 w-28 rounded-full bg-blue-100" />
              <div className="h-5 w-4/5 rounded-full bg-slate-900" />
              <div className="h-2 w-full rounded-full bg-slate-200" />
              <div className="h-2 w-2/3 rounded-full bg-slate-200" />
              <div className="grid grid-cols-3 gap-2 pt-2">
                {["Events", "Charity", "Members"].map((item) => (
                  <div key={item} className="rounded-lg border border-slate-200 p-2">
                    <div className="mb-2 h-5 w-5 rounded-md bg-blue-50" />
                    <p className="text-[10px] font-semibold text-slate-700">{item}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="absolute right-4 top-16 rounded-xl border border-blue-100 bg-white p-3 shadow-2xl">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-900">
                <Sparkles className="h-3.5 w-3.5 text-mkt-blue" />
                AI draft added
              </div>
            </div>
          </div>
        </div>
      </div>
    </FeatureIllustrationFrame>
  );
}

function EventsIllustration() {
  return (
    <FeatureIllustrationFrame>
      <div className="grid h-full gap-4 md:grid-cols-[1fr_190px]">
        <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-4 backdrop-blur">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-white">May meetings</p>
              <p className="text-xs text-white/45">RSVPs and dining in sync</p>
            </div>
            <CalendarDays className="h-5 w-5 text-mkt-blue-light" />
          </div>
          <div className="mt-5 grid grid-cols-7 gap-2 text-center text-[10px] text-white/45">
            {["M", "T", "W", "T", "F", "S", "S"].map((day, index) => (
              <span key={`${day}-${index}`}>{day}</span>
            ))}
            {Array.from({ length: 28 }, (_, i) => {
              const day = i + 1;
              const isEvent = [7, 14, 21].includes(day);
              return (
                <div
                  key={day}
                  className={`flex aspect-square items-center justify-center rounded-lg text-xs ${
                    isEvent
                      ? "bg-mkt-blue text-white shadow-[0_0_24px_rgba(56,127,245,0.38)]"
                      : "bg-white/[0.05] text-white/55"
                  }`}
                >
                  {day}
                </div>
              );
            })}
          </div>
        </div>
        <div className="flex flex-col gap-3">
          <div className="rounded-2xl bg-white p-4 text-slate-950 shadow-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-mkt-blue">
              Festive board
            </p>
            <p className="mt-1 text-lg font-bold">42 RSVPs</p>
            <div className="mt-3 space-y-2">
              {[
                ["Paid", "34"],
                ["Dietary notes", "8"],
                ["Guests", "12"],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">{label}</span>
                  <span className="font-semibold text-slate-900">{value}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.07] p-4">
            <p className="text-sm font-semibold text-white">Seating list</p>
            <div className="mt-3 space-y-2">
              {["Bro. Adams", "W. Bro. Patel", "Guest table"].map((item) => (
                <div key={item} className="flex items-center gap-2 rounded-lg bg-white/[0.06] p-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                  <span className="text-xs text-white/70">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </FeatureIllustrationFrame>
  );
}

function PaymentsIllustration() {
  const steps = [
    {
      title: "Checkout",
      copy: "Member pays dues or dining fee",
      Icon: CreditCard,
    },
    {
      title: "Gift Aid",
      copy: "Declaration captured with donation",
      Icon: HeartHandshake,
    },
    {
      title: "Webhook",
      copy: "Payment status verified",
      Icon: CheckCircle2,
    },
  ];

  return (
    <FeatureIllustrationFrame>
      <div className="grid h-full gap-4 md:grid-cols-[190px_1fr]">
        <div className="rounded-2xl bg-white p-5 text-slate-950 shadow-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-mkt-blue">
            Checkout
          </p>
          <p className="mt-2 text-2xl font-bold">£84.00</p>
          <p className="text-sm text-slate-500">Dining and raffle</p>
          <div className="mt-5 space-y-3">
            {["Card", "Apple Pay", "Bank"].map((item, index) => (
              <div
                key={item}
                className={`flex items-center gap-3 rounded-xl border p-3 ${
                  index === 0 ? "border-mkt-blue bg-blue-50" : "border-slate-200"
                }`}
              >
                <div className="h-3 w-3 rounded-full bg-mkt-blue" />
                <span className="text-xs font-semibold">{item}</span>
              </div>
            ))}
          </div>
          <button className="mt-5 w-full rounded-xl bg-mkt-blue py-3 text-sm font-bold text-white">
            Pay securely
          </button>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-white">Treasurer timeline</p>
              <p className="text-xs text-white/45">Automatic reconciliation</p>
            </div>
            <LayoutDashboard className="h-5 w-5 text-mkt-blue-light" />
          </div>
          <div className="mt-6 space-y-4">
            {steps.map(({ title, copy, Icon }, index) => (
              <div key={title} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-mkt-blue text-white">
                    <Icon className="h-4 w-4" />
                  </div>
                  {index < steps.length - 1 ? <div className="h-8 w-px bg-white/10" /> : null}
                </div>
                <div className="pt-1">
                  <p className="text-sm font-semibold text-white">{title}</p>
                  <p className="text-xs text-white/50">{copy}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-xl border border-emerald-300/20 bg-emerald-300/10 p-3 text-xs font-medium text-emerald-100">
            £84.00 reconciled to the event ledger
          </div>
        </div>
      </div>
    </FeatureIllustrationFrame>
  );
}

function CandidateIllustration() {
  const columns = [
    { title: "Enquiry", cards: ["New website form", "Book coffee"] },
    { title: "Proposer", cards: ["Assign mentor", "Intro call"] },
    { title: "Ballot", cards: ["Papers ready"] },
  ];

  return (
    <FeatureIllustrationFrame>
      <div className="flex h-full flex-col rounded-2xl border border-white/10 bg-white/[0.05] p-4 backdrop-blur">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-white">Candidate pipeline</p>
            <p className="text-xs text-white/45">Every follow-up visible</p>
          </div>
          <Users className="h-5 w-5 text-mkt-blue-light" />
        </div>
        <div className="mt-5 grid min-h-0 flex-1 grid-cols-3 gap-3">
          {columns.map((column, columnIndex) => (
            <div key={column.title} className="rounded-xl bg-slate-950/55 p-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-white">{column.title}</p>
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-white/45">
                  {column.cards.length}
                </span>
              </div>
              <div className="mt-3 space-y-2">
                {column.cards.map((card, cardIndex) => (
                  <div
                    key={card}
                    className="rounded-lg border border-white/10 bg-white p-3 text-slate-950 shadow-xl"
                  >
                    <div className="mb-2 flex items-center gap-2">
                      <div
                        className={`h-6 w-6 rounded-full ${
                          columnIndex === 0
                            ? "bg-blue-100"
                            : columnIndex === 1
                              ? "bg-violet-100"
                              : "bg-emerald-100"
                        }`}
                      />
                      <p className="text-xs font-semibold">{card}</p>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-slate-100" />
                    <div className="mt-1.5 h-1.5 w-2/3 rounded-full bg-slate-100" />
                    {columnIndex === 1 && cardIndex === 0 ? (
                      <div className="mt-3 flex items-center gap-1.5 text-[10px] font-semibold text-mkt-blue">
                        <Mail className="h-3 w-3" />
                        Reminder set
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-center justify-between rounded-xl border border-mkt-blue/30 bg-mkt-blue/15 px-3 py-2">
          <span className="text-xs font-medium text-blue-100">Next action due today</span>
          <ArrowRight className="h-4 w-4 text-blue-100" />
        </div>
      </div>
    </FeatureIllustrationFrame>
  );
}

const features = [
  {
    icon: Globe,
    eyebrow: "Site builder",
    title: "Launch a lodge website that feels current",
    description:
      "Create public pages for your story, officers, events, charity work, and enquiries. AI draft support helps admins shape the first version while every lodge keeps its own branding and content.",
    highlights: ["AI draft support", "Branded sections", "Tenant scoped"],
    Illustration: WebsiteBuilderIllustration,
  },
  {
    icon: CalendarDays,
    eyebrow: "Events and dining",
    title: "Run meetings, RSVPs, and dining from one place",
    description:
      "Publish meetings, festive boards, and charity events with RSVP, dietary requirements, guest counts, and attendance lists connected to the same operational record.",
    highlights: ["RSVP tracking", "Dietary notes", "Attendance lists"],
    Illustration: EventsIllustration,
  },
  {
    icon: CreditCard,
    eyebrow: "Payments and Gift Aid",
    title: "Keep payments clear from checkout to audit",
    description:
      "Accept event fees, dues, and donations through Mooov-powered checkout. Gift Aid declarations and webhook-verified payment statuses keep finance records easier to trust.",
    highlights: ["Mooov checkout", "Gift Aid capture", "Verified status"],
    Illustration: PaymentsIllustration,
  },
  {
    icon: Users,
    eyebrow: "Candidate CRM",
    title: "Track every candidate from enquiry to initiation",
    description:
      "Move prospects through enquiry, proposer assignment, ballot, and initiation with clear owners, activity logs, and reminders that keep the membership journey visible.",
    highlights: ["Pipeline stages", "Activity logs", "Follow-up reminders"],
    Illustration: CandidateIllustration,
  },
];

export function FeaturesSection() {
  return (
    <section className="relative overflow-hidden bg-mkt-bg px-6 py-24">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      <div className="mx-auto max-w-[1204px]">
        <FadeIn>
          <div className="mx-auto max-w-3xl text-center">
            <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-medium text-blue-100">
              <MousePointer2 className="h-4 w-4 text-mkt-blue-light" />
              Key workflows
            </div>
            <h2 className="mt-5 font-heading text-3xl font-bold leading-tight text-white sm:text-4xl lg:text-[42px]">
              Built around the work a lodge actually does
            </h2>
            <p className="mx-auto mt-4 max-w-[680px] text-base leading-relaxed text-mkt-text-secondary opacity-85">
              The landing page now shows the real product story: publish the lodge, manage the
              meeting, collect payment, and guide every candidate through the process.
            </p>
          </div>
        </FadeIn>

        <div className="mt-20 flex flex-col gap-24">
          {features.map((feature, i) => {
            const isReversed = i % 2 === 1;
            const Icon = feature.icon;
            const Illustration = feature.Illustration;

            return (
              <FadeIn key={feature.title} delay={0.1}>
                <div
                  className={`flex flex-col items-center gap-12 lg:flex-row lg:gap-16 ${
                    isReversed ? "lg:flex-row-reverse" : ""
                  }`}
                >
                  <div className="flex-1">
                    <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-sm font-medium text-blue-100">
                      <Icon className="h-4 w-4 text-mkt-blue-light" />
                      {feature.eyebrow}
                    </div>
                    <h3 className="mt-5 font-heading text-2xl font-bold leading-snug text-white sm:text-[31px]">
                      {feature.title}
                    </h3>
                    <p className="mt-4 text-base leading-relaxed text-mkt-text-secondary opacity-80">
                      {feature.description}
                    </p>
                    <div className="mt-6 flex flex-wrap gap-2">
                      {feature.highlights.map((highlight) => (
                        <span
                          key={highlight}
                          className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-sm text-white/70"
                        >
                          {highlight}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex-1">
                    <Illustration />
                  </div>
                </div>
              </FadeIn>
            );
          })}
        </div>
      </div>
    </section>
  );
}
