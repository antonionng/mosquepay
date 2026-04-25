"use client";

import { FadeIn } from "@/components/motion";

const testimonials = [
  {
    quote:
      "LodgePay transformed how we manage our lodge. Event RSVPs, payments, and our website are all in one place now. It saves our Secretary hours every week.",
    name: "James T. Whitfield",
    role: "Lodge Secretary",
    initials: "JW",
  },
  {
    quote:
      "The candidate tracking has been a game-changer. We used to lose track of prospects between meetings. Now every enquiry is logged, every follow-up is prompted.",
    name: "Robert A. Clarke",
    role: "Worshipful Master",
    initials: "RC",
  },
  {
    quote:
      "Gift Aid declarations captured at checkout have increased our charity reclaim by 40%. The payment reporting gives our Treasurer complete confidence at audit time.",
    name: "David M. Patterson",
    role: "Charity Steward",
    initials: "DP",
  },
  {
    quote:
      "Rolling out LodgePay across our province was seamless. Each lodge gets their own branded site but we have oversight across all of them from one admin panel.",
    name: "Sir William H. Grant",
    role: "Provincial Grand Secretary",
    initials: "WG",
  },
  {
    quote:
      "Our festive board bookings went from spreadsheets to professional checkout in a weekend. Members love the simplicity and we love the automatic reconciliation.",
    name: "Thomas E. Murray",
    role: "Director of Ceremonies",
    initials: "TM",
  },
];

export function TestimonialsSection() {
  return (
    <section className="bg-mkt-bg px-6 py-24">
      <div className="mx-auto max-w-[1204px]">
        <FadeIn>
          <h2 className="text-center font-heading text-3xl font-bold leading-tight text-white sm:text-4xl lg:text-[39px]">
            The LodgePay Experience
          </h2>
          <p className="mx-auto mt-4 max-w-[700px] text-center text-base text-mkt-text-secondary opacity-80">
            Lodges across the country trust LodgePay to run their operations.
            Here&apos;s what they have to say.
          </p>
        </FadeIn>

        <FadeIn delay={0.2}>
          <div className="-mx-6 mt-14 px-6 sm:-mx-10 sm:px-10 lg:-mx-16 lg:px-16">
            <div className="flex snap-x snap-mandatory gap-6 overflow-x-auto pb-4 scrollbar-hide">
              {testimonials.map((t, i) => (
                <div
                  key={t.name}
                  className="flex w-[300px] flex-none snap-center flex-col justify-between rounded-2xl border border-mkt-border bg-mkt-surface p-8 sm:w-[320px]"
                >
                  <p className="text-center text-base leading-relaxed text-mkt-text-secondary">
                    &ldquo;{t.quote}&rdquo;
                  </p>
                  <div className="mt-8 flex flex-col items-center">
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white"
                      style={{
                        background: [
                          "linear-gradient(135deg, #387ff5, #6099f7)",
                          "linear-gradient(135deg, #e879a0, #f5a0b8)",
                          "linear-gradient(135deg, #34d399, #6ee7b7)",
                          "linear-gradient(135deg, #fbbf24, #fcd34d)",
                          "linear-gradient(135deg, #7c3aed, #a78bfa)",
                        ][i % 5],
                      }}
                    >
                      {t.initials}
                    </div>
                    <p className="mt-3 font-heading text-sm font-bold text-white">
                      {t.name}
                    </p>
                    <p className="text-sm text-mkt-text-secondary">{t.role}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
