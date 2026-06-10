import Link from "next/link";
import { Check } from "lucide-react";
import { PLAN_CODES, PLAN_DEFINITIONS } from "@/lib/billing/plans";
import {
  MarketingShell,
  MarketingSection,
  MarketingKicker,
  MarketingCtaBand,
} from "@/components/marketing/marketing-shell";
import { marketingMetadata } from "@/lib/seo";

export const metadata = marketingMetadata({
  title: "Pricing | ChurchPay Plans for Churches and Networks",
  description:
    "Simple ChurchPay pricing for UK churches: Essentials from £149/mo, Complete from £229/mo, Group from £349/mo, and Network rollouts. Giving, Gift Aid, websites, member records, and reporting included.",
  path: "/pricing",
  keywords: [
    "church software pricing",
    "church giving platform cost",
    "church management software price",
    "Gift Aid software pricing",
  ],
});

const PRICING_FAQS = [
  {
    q: "Are there setup or onboarding fees?",
    a: "No. Onboarding, data import help, and website setup are included in every plan.",
  },
  {
    q: "What about payment processing fees?",
    a: "Card processing fees are charged by the payment provider per transaction, as with any platform. ChurchPay does not add a markup on top.",
  },
  {
    q: "Can we change plans later?",
    a: "Yes. Upgrade or downgrade at any time; we pro-rate the difference on your next invoice.",
  },
  {
    q: "Do you offer discounts for small churches or charities?",
    a: "If your congregation is small or your budget is tight, talk to us. We would rather find a number that works than see a church stay on spreadsheets.",
  },
];

export default function PricingPage() {
  return (
    <MarketingShell>
      <section className="px-5 pb-4 pt-16 lg:px-8 lg:pt-24">
        <div className="mx-auto max-w-7xl text-center">
          <MarketingKicker>Pricing</MarketingKicker>
          <h1 className="mx-auto mt-4 max-w-3xl font-heading text-4xl font-bold leading-tight tracking-tight text-slate-900 sm:text-5xl">
            Simple plans for churches and networks.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-slate-600">
            Every plan includes giving, Gift Aid, your church website, member records, and
            support from a team that knows UK church administration.
          </p>
        </div>
      </section>

      <MarketingSection>
        <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-4">
          {PLAN_CODES.map((code) => {
            const plan = PLAN_DEFINITIONS[code];
            return (
              <div
                key={plan.code}
                className={`flex flex-col rounded-3xl border bg-white p-8 ${
                  plan.recommended
                    ? "border-brand shadow-[0_20px_50px_-18px_rgba(11,67,184,0.35)]"
                    : "border-[#e9e2d4] shadow-sm"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <h2 className="font-heading text-xl font-semibold text-slate-900">{plan.name}</h2>
                  {plan.recommended && (
                    <span className="rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold text-brand">
                      Most popular
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-slate-500">{plan.tag}</p>
                <p className="mt-6 font-heading text-3xl font-bold text-slate-900">{plan.price}</p>
                <p className="mt-1 text-xs text-slate-500">{plan.subPrice}</p>
                <p className="mt-5 text-sm leading-6 text-slate-600">{plan.description}</p>
                <Link
                  href={plan.cta === "Talk to us" ? "/contact" : "/book-demo"}
                  className={`mt-7 inline-flex items-center justify-center rounded-xl px-5 py-3 text-sm font-semibold transition-colors ${
                    plan.recommended
                      ? "bg-brand text-white hover:bg-brand-dark"
                      : "border border-[#ddd5c4] text-slate-800 hover:border-brand/30 hover:text-brand"
                  }`}
                >
                  {plan.cta}
                </Link>
                <div className="mt-8 space-y-6 border-t border-[#efe9dc] pt-6">
                  {plan.featureGroups.map((group) => (
                    <div key={group.title}>
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                        {group.title}
                      </p>
                      <ul className="mt-3 space-y-2">
                        {group.items.map((item) => (
                          <li key={item} className="flex items-start gap-2 text-sm text-slate-700">
                            <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </MarketingSection>

      <MarketingSection tinted>
        <div className="mx-auto max-w-2xl text-center">
          <MarketingKicker>Pricing questions</MarketingKicker>
          <h2 className="mt-4 font-heading text-3xl font-bold tracking-tight text-slate-900">
            The fine print, in plain English.
          </h2>
        </div>
        <div className="mx-auto mt-12 grid max-w-4xl gap-5 sm:grid-cols-2">
          {PRICING_FAQS.map((faq) => (
            <article key={faq.q} className="rounded-3xl border border-[#e9e2d4] bg-white p-7">
              <h3 className="font-heading text-base font-semibold text-slate-900">{faq.q}</h3>
              <p className="mt-2.5 text-sm leading-6 text-slate-600">{faq.a}</p>
            </article>
          ))}
        </div>
      </MarketingSection>

      <MarketingCtaBand
        title="Not sure which plan fits?"
        body="Tell us about your church, your congregation size, giving setup, and how many sites, and we'll recommend the right starting point. No pressure, no lock-in."
        ctaLabel="Talk to us"
        ctaHref="/contact"
        secondaryLabel="Book a demo"
        secondaryHref="/book-demo"
      />
    </MarketingShell>
  );
}
