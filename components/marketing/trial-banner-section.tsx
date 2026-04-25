import Link from "next/link";
import { FadeIn } from "@/components/motion";
import { Sparkles, CreditCard, CheckCircle, HeadphonesIcon } from "lucide-react";

const benefits = [
  {
    icon: CreditCard,
    title: "Instant Access",
    description: "Begin exploring LodgePay's full suite of features immediately",
  },
  {
    icon: CheckCircle,
    title: "No Commitments",
    description: "No credit card required, and you can cancel anytime",
  },
  {
    icon: HeadphonesIcon,
    title: "Dedicated Support",
    description: "Our team is here to assist you every step of the way during your trial",
  },
];

export function TrialBannerSection() {
  return (
    <section className="bg-mkt-bg px-6 py-20">
      <FadeIn>
        <div className="mx-auto max-w-[1204px] overflow-hidden rounded-2xl bg-mkt-blue p-8 sm:rounded-[32px] sm:p-14 lg:p-16">
          {/* Grid background + data-viz overlay */}
          <div className="relative">
            <div
              className="pointer-events-none absolute -left-20 -top-20 h-[500px] w-[900px] opacity-10"
              style={{
                backgroundImage:
                  "linear-gradient(rgba(255,255,255,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.3) 1px, transparent 1px)",
                backgroundSize: "60px 60px",
              }}
            />
            {/* Decorative data-viz lines at bottom-left */}
            <svg
              className="pointer-events-none absolute -bottom-8 -left-4 h-[160px] w-[400px] opacity-15 sm:opacity-20"
              viewBox="0 0 400 160"
              fill="none"
            >
              <path d="M0,120 Q80,100 160,110 Q240,120 320,80 Q360,60 400,70" stroke="white" strokeWidth="2" />
              <path d="M0,130 Q100,110 180,125 Q260,140 340,100 Q380,80 400,90" stroke="white" strokeWidth="1.5" opacity="0.6" />
              <path d="M0,140 Q100,130 200,135 Q280,140 360,115 Q390,100 400,110" stroke="white" strokeWidth="1" opacity="0.4" />
            </svg>
            {/* Concentric circle node */}
            <div className="pointer-events-none absolute bottom-4 left-[30%] h-20 w-20 rounded-full bg-white/[0.06]" />
            <div className="pointer-events-none absolute bottom-7 left-[calc(30%+10px)] h-12 w-12 rounded-full border border-white/10" />

            <div className="relative flex flex-col gap-10 lg:flex-row lg:items-start lg:gap-16">
              {/* Left: heading + CTA */}
              <div className="flex-1">
                <h2 className="font-heading text-3xl font-bold leading-[1.16] text-white sm:text-4xl lg:text-[48px]">
                  Experience the Future of Lodge Management with LodgePay
                </h2>
                <Link
                  href="/book-demo"
                  className="mt-10 inline-flex items-center gap-2 rounded-xl px-8 py-4 font-heading text-base font-bold text-white transition-colors"
                  style={{
                    backgroundImage:
                      "linear-gradient(102deg, rgba(255,255,255,0.13) 6%, rgba(255,255,255,0.245) 91%)",
                  }}
                >
                  Start your free trial
                  <Sparkles className="h-4 w-4" />
                </Link>
              </div>

              {/* Right: benefit items */}
              <div className="flex flex-col gap-5 lg:w-[380px]">
                {benefits.map((b) => {
                  const Icon = b.icon;
                  return (
                    <div
                      key={b.title}
                      className="flex items-center gap-3 rounded-2xl border border-white/20 py-2 pl-2 pr-5 backdrop-blur-sm"
                      style={{
                        backgroundImage:
                          "linear-gradient(101deg, rgba(255,255,255,0.075) 6%, rgba(255,255,255,0.175) 91%)",
                      }}
                    >
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/10 backdrop-blur-sm">
                        <Icon className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <p className="text-base font-semibold text-white">
                          {b.title}
                        </p>
                        <p className="text-sm text-white/70">{b.description}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </FadeIn>
    </section>
  );
}
