"use client";

import { FadeIn } from "@/components/motion";
import { Globe, CalendarDays, CreditCard, Users } from "lucide-react";

function FeatureIllustration1() {
  return (
    <div className="relative h-[280px] w-full overflow-hidden rounded-2xl bg-mkt-blue-light sm:h-[340px]">
      {/* Grid */}
      <div
        className="absolute inset-0 opacity-15"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.2) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.2) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />
      {/* Decorative circles */}
      <div className="absolute bottom-8 left-[40%] h-20 w-20 rounded-full bg-white/[0.06] mix-blend-screen" />
      <div className="absolute bottom-12 left-[43%] h-10 w-10 rounded-full border border-white/15" />
      {/* Icon badge - top right */}
      <div className="absolute right-8 top-6 flex h-[120px] w-[120px] items-center justify-center rounded-full border-2 border-white/20 bg-white/[0.06]">
        <div className="flex h-[80px] w-[80px] items-center justify-center rounded-full border border-white/15">
          <Globe className="h-8 w-8 text-white/60" />
        </div>
      </div>
      {/* Activity card */}
      <div className="absolute bottom-6 left-4 w-[220px] rounded-2xl bg-white p-5 shadow-[0_22px_32px_rgba(44,58,114,0.05),0_18px_20px_rgba(44,58,114,0.05)]">
        <p className="text-sm font-bold text-[#1c1f25]">Your weekly activity</p>
        <div className="mt-3 flex gap-6 text-[10px] font-semibold uppercase tracking-widest text-[#4b5162]/60">
          <span>Pages</span>
          <span>Visits</span>
          <span>Events</span>
        </div>
        <div className="mt-1 flex gap-6 text-xl font-bold text-[#1c1f25]">
          <span>17</span>
          <span>25</span>
          <span>25</span>
        </div>
        <div className="mt-1 flex gap-6 text-xs font-medium text-mkt-blue">
          <span>▲ 4</span>
          <span>▲ 7</span>
          <span>▲ 2</span>
        </div>
        <div className="mt-3 flex gap-2">
          <div className="h-1 flex-1 rounded-full bg-mkt-blue/20" />
          <div className="h-1 flex-1 rounded-full bg-mkt-blue/10" />
        </div>
      </div>
    </div>
  );
}

function FeatureIllustration2() {
  return (
    <div className="relative h-[280px] w-full overflow-hidden rounded-2xl bg-mkt-blue-light sm:h-[340px]">
      <div
        className="absolute inset-0 opacity-15"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.2) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.2) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />
      <div className="absolute bottom-16 left-[45%] h-14 w-14 rounded-full bg-white/[0.06] mix-blend-screen" />
      <div className="absolute bottom-20 left-[48%] h-6 w-6 rounded-full border border-white/15" />
      {/* Dashboard card - left */}
      <div className="absolute left-2 top-8 w-[180px] rounded-2xl bg-white p-4 shadow-[0_22px_32px_rgba(44,58,114,0.05)]">
        <div className="h-2 w-16 rounded bg-gray-200" />
        <div className="mt-2 h-1.5 w-10 rounded bg-gray-100" />
        <div className="mt-4 h-[80px]">
          {/* Mini line chart */}
          <svg viewBox="0 0 160 80" className="h-full w-full">
            <polyline points="0,60 30,45 50,55 70,30 100,40 130,25 160,35" fill="none" stroke="#387ff5" strokeWidth="2" />
            <polyline points="0,50 30,55 50,40 70,50 100,55 130,45 160,50" fill="none" stroke="#e879a0" strokeWidth="2" strokeDasharray="4,4" />
            <polygon points="0,60 30,45 50,55 70,30 100,40 130,25 160,35 160,80 0,80" fill="#387ff5" opacity="0.1" />
          </svg>
        </div>
      </div>
      {/* Service breakdown card - right */}
      <div className="absolute bottom-6 right-4 w-[190px] rounded-2xl bg-white p-4 shadow-[0_22px_32px_rgba(44,58,114,0.05)]">
        <p className="text-sm font-bold text-[#1c1f25]">Service Breakdown</p>
        <div className="mt-3 flex items-center gap-4">
          <div className="flex flex-col gap-1.5">
            {["#387ff5", "#e879a0", "#fbbf24", "#34d399"].map((color) => (
              <div key={color} className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
                <div className="h-1.5 w-12 rounded bg-gray-200" />
              </div>
            ))}
          </div>
          {/* Pie chart */}
          <svg viewBox="0 0 60 60" className="h-14 w-14">
            <circle cx="30" cy="30" r="25" fill="none" stroke="#387ff5" strokeWidth="10" strokeDasharray="50 107" strokeDashoffset="-10" />
            <circle cx="30" cy="30" r="25" fill="none" stroke="#e879a0" strokeWidth="10" strokeDasharray="30 127" strokeDashoffset="-60" />
            <circle cx="30" cy="30" r="25" fill="none" stroke="#fbbf24" strokeWidth="10" strokeDasharray="35 122" strokeDashoffset="-90" />
            <circle cx="30" cy="30" r="25" fill="none" stroke="#34d399" strokeWidth="10" strokeDasharray="42 115" strokeDashoffset="-125" />
          </svg>
        </div>
      </div>
    </div>
  );
}

function FeatureIllustration3() {
  return (
    <div className="relative h-[280px] w-full overflow-hidden rounded-2xl bg-mkt-blue-light sm:h-[340px]">
      <div
        className="absolute inset-0 opacity-15"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.2) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.2) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />
      <div className="absolute right-8 top-12 h-8 w-8 rounded-full bg-white/10 mix-blend-screen" />
      {/* Line chart background */}
      <div className="absolute right-0 top-0 h-full w-[55%]">
        <svg viewBox="0 0 200 200" className="h-full w-full opacity-30">
          <polyline points="0,140 40,130 80,120 120,90 160,100 200,60" fill="none" stroke="white" strokeWidth="2" />
          <polyline points="0,160 40,150 80,140 120,130 160,120 200,100" fill="none" stroke="white" strokeWidth="1.5" opacity="0.5" />
        </svg>
      </div>
      {/* Dashboard card */}
      <div className="absolute bottom-6 left-4 w-[240px] rounded-2xl bg-white p-4 shadow-[0_22px_32px_rgba(44,58,114,0.05)]">
        <div className="h-2 w-20 rounded bg-gray-200" />
        <div className="mt-2 h-1.5 w-12 rounded bg-gray-100" />
        <div className="mt-4 flex gap-1.5">
          {[65, 45, 70, 55, 80, 60, 50].map((h, i) => (
            <div key={i} className="flex flex-1 flex-col justify-end gap-0.5">
              <div className="rounded-sm bg-mkt-blue/30" style={{ height: `${h * 0.6}px` }} />
              <div className="rounded-sm bg-[#e879a0]/30" style={{ height: `${(100 - h) * 0.4}px` }} />
              <div className="rounded-sm bg-[#1c1f25]" style={{ height: `${h * 0.3}px` }} />
            </div>
          ))}
        </div>
        <div className="mt-2 flex gap-3 text-[8px]">
          {["●", "●", "●"].map((dot, i) => (
            <span key={i} className="flex items-center gap-1" style={{ color: ["#387ff5", "#e879a0", "#1c1f25"][i] }}>
              {dot} <span className="text-gray-400">{["Events", "RSVPs", "Paid"][i]}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function FeatureIllustration4() {
  return (
    <div className="relative h-[280px] w-full overflow-hidden rounded-2xl bg-mkt-blue-light sm:h-[340px]">
      <div
        className="absolute inset-0 opacity-15"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.2) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.2) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />
      {/* Wave lines */}
      <svg className="absolute inset-0 h-full w-full opacity-25" viewBox="0 0 500 340">
        <path d="M0,200 Q125,160 250,190 Q375,220 500,170" fill="none" stroke="white" strokeWidth="2" />
        <path d="M0,220 Q125,180 250,210 Q375,240 500,190" fill="none" stroke="white" strokeWidth="1.5" opacity="0.6" />
        <path d="M0,240 Q125,200 250,230 Q375,260 500,210" fill="none" stroke="white" strokeWidth="1" opacity="0.4" />
      </svg>
      <div className="absolute left-[40%] top-[30%] h-16 w-16 rounded-full bg-white/[0.06] mix-blend-screen" />
      {/* Candlestick chart card - left */}
      <div className="absolute left-3 top-6 w-[170px] rounded-2xl bg-white p-4 shadow-[0_22px_32px_rgba(44,58,114,0.05)]">
        <div className="h-2 w-16 rounded bg-gray-200" />
        <div className="mt-3 flex items-end gap-2">
          {[
            { open: 30, close: 50, color: "#e879a0" },
            { open: 45, close: 35, color: "#7c3aed" },
            { open: 40, close: 55, color: "#e879a0" },
            { open: 50, close: 40, color: "#7c3aed" },
            { open: 35, close: 60, color: "#e879a0" },
            { open: 55, close: 45, color: "#7c3aed" },
          ].map((bar, i) => (
            <div key={i} className="flex flex-1 flex-col items-center gap-0.5">
              <div className="w-0.5 rounded bg-gray-300" style={{ height: "8px" }} />
              <div
                className="w-2.5 rounded-sm"
                style={{
                  height: `${Math.abs(bar.close - bar.open)}px`,
                  backgroundColor: bar.color,
                  opacity: 0.7,
                }}
              />
              <div className="w-0.5 rounded bg-gray-300" style={{ height: "6px" }} />
            </div>
          ))}
        </div>
        <div className="mt-2 flex gap-1.5">
          {["#e879a0", "#387ff5"].map((c) => (
            <div key={c} className="h-1 w-1 rounded-full" style={{ backgroundColor: c }} />
          ))}
        </div>
      </div>
      {/* Radar chart card - right */}
      <div className="absolute bottom-6 right-4 w-[170px] rounded-2xl bg-white p-4 shadow-[0_22px_32px_rgba(44,58,114,0.05)]">
        <div className="flex gap-2">
          <div className="h-2 w-16 rounded bg-gray-200" />
        </div>
        <div className="mt-2 flex items-center gap-3">
          <svg viewBox="0 0 100 100" className="h-16 w-16">
            {/* Radar grid */}
            <polygon points="50,15 85,35 85,65 50,85 15,65 15,35" fill="none" stroke="#e5e7eb" strokeWidth="1" />
            <polygon points="50,25 75,40 75,60 50,75 25,60 25,40" fill="none" stroke="#e5e7eb" strokeWidth="0.5" />
            {/* Data */}
            <polygon points="50,20 80,38 70,65 50,80 25,55 30,35" fill="#387ff5" opacity="0.15" stroke="#387ff5" strokeWidth="1.5" />
            <polygon points="50,28 72,42 68,60 50,72 30,58 35,40" fill="#e879a0" opacity="0.1" stroke="#e879a0" strokeWidth="1" />
          </svg>
          <div className="flex flex-col gap-1.5">
            {Array(4)
              .fill(0)
              .map((_, i) => (
                <div key={i} className="h-1.5 w-10 rounded bg-gray-200" />
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const illustrations = [FeatureIllustration1, FeatureIllustration2, FeatureIllustration3, FeatureIllustration4];

const features = [
  {
    icon: Globe,
    title: "Build Stunning Lodge Websites with Confidence",
    description:
      "Launch a beautiful, mobile-ready website for your lodge in minutes. Our AI-assisted page builder lets you craft professional sections — history, officers, charity work — with drag-and-drop simplicity. Every site is fully branded and tenant-isolated.",
  },
  {
    icon: CalendarDays,
    title: "Run Events and RSVPs with Real-Time Control",
    description:
      "Publish lodge meetings, festive boards, and charity events with integrated RSVP. Track attendance, manage dietary requirements, and generate seating plans — all connected to your payment processing so fees are collected automatically.",
  },
  {
    icon: CreditCard,
    title: "Payments, Donations, and Gift Aid — Handled",
    description:
      "Accept event fees, annual dues, and charitable donations through Stripe-powered checkout. Gift Aid declarations are captured at the point of donation, and every transaction flows through webhook-verified status tracking for complete audit trails.",
  },
  {
    icon: Users,
    title: "Track Every Candidate from Enquiry to Initiation",
    description:
      "Our built-in candidate CRM tracks prospects through structured stages — from first enquiry through proposer assignment, ballot, and initiation. Activity logs, follow-up reminders, and pipeline views keep nothing falling through the cracks.",
  },
];

export function FeaturesSection() {
  return (
    <section className="bg-mkt-bg px-6 py-24">
      <div className="mx-auto max-w-[1204px]">
        <FadeIn>
          <h2 className="text-center font-heading text-3xl font-bold leading-tight text-white sm:text-4xl lg:text-[39px]">
            Key Features and Capabilities
          </h2>
          <p className="mx-auto mt-4 max-w-[600px] text-center text-base text-mkt-text-secondary opacity-80">
            Everything your lodge needs to operate professionally, all in one platform.
          </p>
        </FadeIn>

        <div className="mt-20 flex flex-col gap-24">
          {features.map((feature, i) => {
            const isReversed = i % 2 === 1;
            const Illustration = illustrations[i]!;

            return (
              <FadeIn key={feature.title} delay={0.1}>
                <div
                  className={`flex flex-col items-center gap-12 lg:flex-row lg:gap-16 ${
                    isReversed ? "lg:flex-row-reverse" : ""
                  }`}
                >
                  {/* Text side */}
                  <div className="flex-1">
                    <h3 className="font-heading text-2xl font-bold leading-snug text-white sm:text-[31px]">
                      {feature.title}
                    </h3>
                    <p className="mt-4 text-base leading-relaxed text-mkt-text-secondary opacity-80">
                      {feature.description}
                    </p>
                  </div>

                  {/* Illustration side */}
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
