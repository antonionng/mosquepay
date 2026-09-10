import Link from "next/link";
import { ArrowRight } from "lucide-react";
import {
  MarketingShell,
  MarketingSection,
  MarketingKicker,
  MarketingCtaBand,
} from "@/components/marketing/marketing-shell";
import { marketingMetadata } from "@/lib/seo";
import { MARKETING_GUIDES } from "@/lib/marketing/guides";

export const metadata = marketingMetadata({
  title: "Guides for UK mosque treasurers | MosquePay",
  description:
    "Field guides for UK mosque treasurers on contactless and QR giving after Jumu'ah, collecting Zakat online, Gift Aid, GASDS, and the software stack that has to tag funds and build the committee pack. Organic reference pages, not product news.",
  path: "/guides",
  keywords: [
    "mosque treasurer guides",
    "contactless donations mosque UK",
    "QR code donations mosque UK",
    "collect Zakat online UK mosque",
    "Zakat collection UK mosque",
    "mosque treasurer software UK",
    "mosque accounts donations",
    "Gift Aid mosque UK",
    "GASDS mosque",
    "Gift Aid Islamic charity UK",
  ],
});

function formatGuideDate(isoDate: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${isoDate}T00:00:00.000Z`));
}

export default function GuidesIndexPage() {
  return (
    <MarketingShell>
      <section className="px-5 pb-4 pt-16 lg:px-8 lg:pt-24">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <MarketingKicker>Guides</MarketingKicker>
            <h1 className="mt-4 font-heading text-4xl font-bold leading-tight tracking-tight text-slate-900 sm:text-5xl">
              Field guides for the people who count Friday&apos;s collection.
            </h1>
            <p className="mt-6 text-lg leading-8 text-slate-600">
              Long reference pages for UK mosque treasurers and finance leads.
              These are not the product changelog on /news, and they are not
              the demo mosque pages on /charity or /donate.
            </p>
            <p className="mt-5 text-base leading-7 text-slate-700">
              mosque-pay.com is operations software for a mosque&apos;s own
              giving, Gift Aid, and treasurer records. It is not the UK donor
              directory at mosquepay.co.uk. These guides do not describe that
              directory, do not use its mosque count, and do not claim its fee
              model.
            </p>
          </div>
        </div>
      </section>

      <MarketingSection>
        <div className="grid gap-6 md:grid-cols-2">
          {MARKETING_GUIDES.map((guide) => (
            <article
              key={guide.slug}
              className="flex flex-col rounded-3xl border border-[#e9e2d4] bg-white p-8 shadow-sm"
            >
              <p className="text-sm font-medium text-brand">
                {formatGuideDate(guide.publishedAt)}
              </p>
              <h2 className="mt-3 font-heading text-xl font-semibold text-slate-900">
                <Link href={guide.path} className="hover:text-brand">
                  {guide.listingTitle}
                </Link>
              </h2>
              <p className="mt-3 flex-1 text-sm leading-6 text-slate-600">
                {guide.description}
              </p>
              <Link
                href={guide.path}
                className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-brand hover:text-brand-dark"
              >
                Read the guide
                <ArrowRight className="h-4 w-4" />
              </Link>
            </article>
          ))}
        </div>
      </MarketingSection>

      <MarketingCtaBand
        title="If the guide matches how your mosque actually collects, see the product next."
        body="A 30-minute walkthrough of declarations, GASDS evidence, fund tags, and the HMRC-ready export."
        secondaryLabel="See features"
        secondaryHref="/features"
      />
    </MarketingShell>
  );
}
