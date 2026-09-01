import { Suspense } from "react";
import Link from "next/link";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ArrowRight } from "lucide-react";
import { PublicFooter } from "@/components/layout/public-footer";
import { PublicHeader } from "@/components/layout/public-header";
import {
  MarketingShell,
  MarketingSection,
  MarketingKicker,
  MarketingCtaBand,
} from "@/components/marketing/marketing-shell";
import { Button } from "@/components/ui/button";
import { getDefaultMosqueSlug, resolveMosqueSlug } from "@/lib/tenant";
import { marketingMetadata } from "@/lib/seo";

export const metadata = marketingMetadata({
  title: "MosquePay FAQ | Mosque Software Questions Answered",
  description:
    "Answers about MosquePay for mosques: giving and Gift Aid, GASDS, mosque websites, member records, data migration, security, multi-mosque support, and getting started.",
  path: "/faq",
  keywords: [
    "MosquePay FAQ",
    "mosque software questions",
    "Gift Aid software FAQ",
    "mosque giving platform questions",
  ],
});

const SAAS_FAQS = [
  {
    q: "What is MosquePay?",
    a: "MosquePay is an all-in-one platform for UK mosques covering online giving, Gift Aid and GASDS, congregation records, services and notices, newcomer follow-up, welfare, mosque websites, and treasurer reporting.",
  },
  {
    q: "How does Gift Aid work in MosquePay?",
    a: "Gift Aid declarations are captured when someone gives, whether online or recorded by your team, and attach to every eligible gift automatically. GASDS cash collections are logged per service. When it's time to claim, MosquePay produces HMRC-ready exports with the evidence behind every line.",
  },
  {
    q: "Can we migrate from spreadsheets or another system?",
    a: "Yes. Bulk import covers members, giving history, and Gift Aid declarations. Our team helps with mapping and checks during onboarding, which is included in every plan.",
  },
  {
    q: "Who can see sensitive information like pastoral notes?",
    a: "Access is role-based. Welfare cases are visible only to your pastoral team, financial data to your treasurer roles, and safeguarding contacts can be restricted further. Every sensitive action is recorded in the audit trail.",
  },
  {
    q: "Do members need to download an app?",
    a: "No. The member portal works in any browser and can be installed as an app on a phone's home screen. Members can give, RSVP to services, update details, and see their giving history.",
  },
  {
    q: "Can we run multiple mosques or a network?",
    a: "Yes. The Group plan covers 2 to 6 connected mosques with shared oversight and central billing, and the Network plan supports full network rollouts with cross-mosque dashboards and migration planning.",
  },
  {
    q: "How do payments work and what are the fees?",
    a: "Payments run through our payment partner with standard card processing fees per transaction. MosquePay does not add a markup. Settlement goes directly to your mosque's bank account.",
  },
  {
    q: "Can we edit our mosque website ourselves?",
    a: "Yes. The section-based editor is designed for non-technical volunteers, with optional AI drafting to get pages started. Your branding, your domain, no separate website subscription.",
  },
  {
    q: "Is our data safe?",
    a: "Data is stored in the UK/EU with encryption in transit and at rest, role-based access, audit logging, and GDPR tooling including consent records and subject access request support.",
  },
  {
    q: "How long does setup take?",
    a: "Most mosques are live within days. Import your records, connect payments, brand your site, and invite your team. We guide each step.",
  },
];

const TENANT_FAQS = [
  {
    q: "What time are your services?",
    a: "Our regular service times are listed on the services page, along with any special services coming up. Everyone is welcome, and there's no need to book for a regular Sunday.",
  },
  {
    q: "I'm new. What should I expect?",
    a: "A warm welcome, honest teaching, and no pressure. Let our welcome team know you're new and they'll happily show you around, answer questions, and help with children's groups.",
  },
  {
    q: "Is there something for children and young people?",
    a: "Yes. Groups run during the main service for most ages. Speak to the welcome team when you arrive and they'll get your family settled.",
  },
  {
    q: "How can I give to the mosque?",
    a: "You can give online through our giving page, by standing order, or in the offering during a service. If you're a UK taxpayer, adding a Gift Aid declaration increases your gift by 25% at no cost to you.",
  },
  {
    q: "How do I become a member?",
    a: "Start with a conversation. Express interest through the join page or speak to someone on a Sunday. We'll invite you to our next newcomers' gathering and explain how membership works here.",
  },
  {
    q: "Can the mosque help me in a difficult season?",
    a: "Yes. Our pastoral team offers confidential support, practical help, and prayer. Reach out through the contact page or speak to any of the leadership team.",
  },
];

export default async function FAQPage({
  searchParams,
}: {
  searchParams: Promise<{ mosque?: string }>;
}) {
  const { mosque } = await searchParams;
  const isTenantMode = Boolean(mosque);
  const mosqueSlug = resolveMosqueSlug(mosque);
  const defaultSlug = getDefaultMosqueSlug();
  const withMosqueQuery = (href: string) =>
    mosqueSlug === defaultSlug ? href : `${href}?mosque=${encodeURIComponent(mosqueSlug)}`;

  if (!isTenantMode) {
    return (
      <MarketingShell>
        <section className="px-5 pb-4 pt-16 lg:px-8 lg:pt-24">
          <div className="mx-auto max-w-7xl">
            <div className="max-w-3xl">
              <MarketingKicker>FAQ</MarketingKicker>
              <h1 className="mt-4 font-heading text-4xl font-bold leading-tight tracking-tight text-slate-900 sm:text-5xl">
                Questions mosques ask before switching.
              </h1>
              <p className="mt-6 text-lg leading-8 text-slate-600">
                Straight answers about giving, Gift Aid, data, security, and getting started. If
                you are the treasurer working through Gift Aid or GASDS, read the{" "}
                <Link
                  href="/guides/gift-aid-for-uk-mosque-treasurers"
                  className="font-semibold text-brand underline decoration-brand/25 underline-offset-2 hover:decoration-brand"
                >
                  Gift Aid guide for UK mosque treasurers
                </Link>
                . If yours isn&apos;t here, just ask.
              </p>
            </div>
          </div>
        </section>

        <MarketingSection>
          <div className="mx-auto max-w-4xl">
            <Accordion type="single" collapsible className="w-full space-y-3">
              {SAAS_FAQS.map((faq, i) => (
                <AccordionItem
                  key={i}
                  value={`saas-item-${i}`}
                  className="rounded-[1.25rem] border border-[#e9e2d4] bg-white px-6 shadow-sm data-[state=open]:border-brand/25"
                >
                  <AccordionTrigger className="py-5 text-left font-heading font-semibold text-slate-900 hover:text-brand hover:no-underline">
                    {faq.q}
                  </AccordionTrigger>
                  {faq.q === "How does Gift Aid work in MosquePay?" ? (
                    <p className="pb-3 text-sm leading-6 text-slate-600">
                      Full treasurer guide:{" "}
                      <Link
                        href="/guides/gift-aid-for-uk-mosque-treasurers"
                        className="font-semibold text-brand underline decoration-brand/25 underline-offset-2 hover:decoration-brand"
                      >
                        Gift Aid for UK mosque treasurers
                      </Link>
                      .
                    </p>
                  ) : null}
                  <AccordionContent className="pb-5 leading-relaxed text-slate-600">
                    {faq.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </MarketingSection>

        <MarketingCtaBand
          title="Still have a question?"
          body="Tell us about your mosque and what you're trying to solve. We'll give you an honest answer, even if that answer is 'we're not the right fit yet'."
          ctaLabel="Contact us"
          ctaHref="/contact"
          secondaryLabel="Book a demo"
          secondaryHref="/book-demo"
        />
      </MarketingShell>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Suspense>
        <PublicHeader />
      </Suspense>
      <main className="flex-1">
        <div className="public-page">
          <section className="public-hero">
            <div className="public-hero-shell">
              <div className="public-hero-copy">
                <p className="public-kicker">Frequently asked questions</p>
                <h1 className="public-hero-title">
                  Answers to the questions people ask most.
                </h1>
                <p className="public-hero-body">
                  Whether you&apos;re visiting for the first time or thinking about making this
                  mosque your home, this is a good place to start.
                </p>
              </div>
              <div className="public-hero-panel">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-200">
                  Typical topics
                </p>
                <div className="mt-6 space-y-3 text-sm text-slate-300">
                  <p>Service times and what to expect</p>
                  <p>Children and youth groups</p>
                  <p>Giving and Gift Aid</p>
                  <p>Becoming a member</p>
                </div>
              </div>
            </div>
          </section>

          <section className="public-section">
            <div className="container-full max-w-4xl">
              <Accordion type="single" collapsible className="w-full space-y-3">
                {TENANT_FAQS.map((faq, i) => (
                  <AccordionItem
                    key={i}
                    value={`item-${i}`}
                    className="rounded-[1.25rem] border border-slate-200 bg-white px-6 shadow-card data-[state=open]:bg-slate-50"
                  >
                    <AccordionTrigger className="py-5 text-left font-semibold text-slate-950 hover:text-blue-600 hover:no-underline">
                      {faq.q}
                    </AccordionTrigger>
                    <AccordionContent className="pb-5 leading-relaxed text-slate-600">
                      {faq.a}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>

              <div className="public-cta-panel mt-16 text-center">
                <h3 className="text-xl font-semibold text-white">Still have questions?</h3>
                <p className="mb-6 mt-3 text-slate-300">
                  We&apos;d love to hear from you. No question is too small.
                </p>
                <Button asChild variant="primary">
                  <Link href={withMosqueQuery("/contact")}>
                    Contact Us
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>
          </section>
        </div>
      </main>
      <Suspense>
        <PublicFooter />
      </Suspense>
    </div>
  );
}
