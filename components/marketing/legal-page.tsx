import type { ReactNode } from "react";
import {
  MarketingShell,
  MarketingKicker,
} from "@/components/marketing/marketing-shell";
import { COMPANY_DETAILS } from "@/lib/legal";

export type LegalSection = {
  title: string;
  body: string[];
};

export function LegalPage({
  kicker,
  title,
  intro,
  sections,
  footer,
}: {
  kicker: string;
  title: string;
  intro: string;
  sections: LegalSection[];
  footer: ReactNode;
}) {
  return (
    <MarketingShell>
      <section className="px-5 pb-4 pt-16 lg:px-8 lg:pt-24">
        <div className="mx-auto max-w-4xl">
          <MarketingKicker>{kicker}</MarketingKicker>
          <h1 className="mt-4 font-heading text-4xl font-bold leading-tight tracking-tight text-slate-900 sm:text-5xl">
            {title}
          </h1>
          <p className="mt-6 text-lg leading-8 text-slate-600">{intro}</p>
        </div>
      </section>

      <section className="px-5 py-14 lg:px-8 lg:py-20">
        <div className="mx-auto grid max-w-4xl gap-5">
          <article className="rounded-3xl border border-[#e9e2d4] bg-[#f4f0e7] p-8">
            <h2 className="font-heading text-xl font-semibold text-slate-900">Who we are</h2>
            <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
              {COMPANY_DETAILS.map((item) => (
                <div key={item.label}>
                  <dt className="font-semibold text-slate-900">{item.label}</dt>
                  <dd className="mt-1 text-slate-600">{item.value}</dd>
                </div>
              ))}
            </dl>
          </article>

          {sections.map((section) => (
            <article key={section.title} className="rounded-3xl border border-[#e9e2d4] bg-white p-8">
              <h2 className="font-heading text-xl font-semibold text-slate-900">{section.title}</h2>
              <div className="mt-4 space-y-4 text-base leading-7 text-slate-600">
                {section.body.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </article>
          ))}

          <div className="rounded-3xl border border-[#e9e2d4] bg-[#f4f0e7] p-8 text-base leading-7 text-slate-600">
            {footer}
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
