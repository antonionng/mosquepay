import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { getDefaultLodgeSlug, resolveLodgeSlug } from "@/lib/tenant";
import { marketingMetadata } from "@/lib/seo";

export const metadata = marketingMetadata({
  title: "LodgePay FAQ | Masonic Lodge Software Questions",
  description:
    "Answers about LodgePay for Masonic lodges, including lodge websites, multi-lodge support, event and dues payments, Gift Aid, candidate CRM, member portals, website editing, and platform setup.",
  path: "/faq",
  keywords: [
    "LodgePay FAQ",
    "Masonic lodge software FAQ",
    "lodge website questions",
    "lodge payment questions",
  ],
});

const faqs = [
  {
    q: "Who can join Freemasonry?",
    a: "Freemasonry is open to men of good character from all backgrounds, ages, and walks of life. We welcome men who are interested in personal development, friendship, and charitable service.",
  },
  {
    q: "Do I need to be invited?",
    a: "No. You can express your interest through our website or by contacting us directly. We'll arrange informal meetings so you can get to know us.",
  },
  {
    q: "What does it cost?",
    a: "There are annual membership fees and one-off fees for ceremonies. We're happy to discuss these in person. No financial commitment is required until you've decided to join.",
  },
  {
    q: "How much time does it involve?",
    a: "Covenant Lodge meets regularly for meetings and social events. The exact commitment depends on your level of involvement.",
  },
  {
    q: "Is Freemasonry a religion?",
    a: "No. Freemasonry is not a religion or a substitute for religion. Members are expected to have a belief in a supreme being, but Freemasonry does not promote any particular faith.",
  },
  {
    q: "What about women?",
    a: "Covenant Lodge is under the United Grand Lodge of England, which admits men. Women's Freemasonry is organised separately via the Order of Women Freemasons (OWF) or the HFAF.",
  },
  {
    q: "Where do you meet?",
    a: "We meet at Mark Masons' Hall, 86 St James's Street, Mayfair, London. It is a Grade II listed building and one of London's most prestigious Masonic venues.",
  },
  {
    q: "How long does the process take?",
    a: "It varies. We take time to get to know you through informal meetings. Once you and the lodge are ready, there's a formal application and approval process.",
  },
];

export default async function FAQPage({
  searchParams,
}: {
  searchParams: Promise<{ lodge?: string }>;
}) {
  const { lodge } = await searchParams;
  const isTenantMode = Boolean(lodge);
  const lodgeSlug = resolveLodgeSlug(lodge);
  const defaultSlug = getDefaultLodgeSlug();
  const withLodgeQuery = (href: string) =>
    lodgeSlug === defaultSlug ? href : `${href}?lodge=${encodeURIComponent(lodgeSlug)}`;

  if (!isTenantMode) {
    const saasFaqs = [
      {
        q: "What is LodgePay?",
        a: "LodgePay is a multi-tenant SaaS platform for lodge websites, payments, events, and candidate nurturing.",
      },
      {
        q: "Can we run multiple lodges?",
        a: "Yes. LodgePay supports multi-lodge portfolios with tenant-scoped data and branding.",
      },
      {
        q: "Do you support event and dues payments?",
        a: "Yes. Mooov-backed checkout supports event payments, donations, and recurring dues scenarios.",
      },
      {
        q: "Can we edit our website ourselves?",
        a: "Yes. Lodge teams can use the visual section editor and AI-assisted draft generation.",
      },
    ];

    return (
      <div className="public-page">
        <section className="public-hero">
          <div className="public-hero-shell">
            <div className="public-hero-copy">
              <p className="public-kicker">LodgePay FAQ</p>
              <h1 className="public-hero-title">Answers for lodge operators and teams.</h1>
            </div>
          </div>
        </section>
        <section className="public-section">
          <div className="container-full max-w-4xl">
            <Accordion type="single" collapsible className="w-full space-y-3">
              {saasFaqs.map((faq, i) => (
                <AccordionItem
                  key={i}
                  value={`saas-item-${i}`}
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
              <h3 className="text-xl font-semibold text-white">Want a walkthrough?</h3>
              <Button asChild variant="primary" className="mt-5">
                <Link href="/book-demo">
                  Book Demo
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="public-page">
      <section className="public-hero">
        <div className="public-hero-shell">
          <div className="public-hero-copy">
            <p className="public-kicker">Frequently asked questions</p>
            <h1 className="public-hero-title">Clear answers to the questions people ask most.</h1>
            <p className="public-hero-body">
              If you are curious about joining Freemasonry or about Covenant Lodge specifically,
              this is a good place to start.
            </p>
          </div>
          <div className="public-hero-panel">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-200">Typical topics</p>
            <div className="mt-6 space-y-3 text-sm text-slate-300">
              <p>Who can join</p>
              <p>What the process looks like</p>
              <p>Time, cost, and expectations</p>
              <p>Where we meet in London</p>
            </div>
          </div>
        </div>
      </section>

      <section className="public-section">
        <div className="container-full max-w-4xl">
          <Accordion type="single" collapsible className="w-full space-y-3">
            {faqs.map((faq, i) => (
              <AccordionItem 
                key={i} 
                value={`item-${i}`} 
                className="rounded-[1.25rem] border border-slate-200 bg-white px-6 shadow-card data-[state=open]:bg-slate-50"
              >
                <AccordionTrigger className="py-5 text-left font-semibold text-slate-950 hover:text-blue-600 hover:no-underline">
                  {faq.q}
                </AccordionTrigger>
                <AccordionContent className="text-slate-600 pb-5 leading-relaxed">
                  {faq.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
          
          <div className="public-cta-panel mt-16 text-center">
            <h3 className="text-xl font-semibold text-white">Still have questions?</h3>
            <p className="mb-6 mt-3 text-slate-300">
              We&apos;re happy to answer anything that would help you make an informed decision.
            </p>
            <Button asChild variant="primary">
              <Link href={withLodgeQuery("/contact")}>
                Contact Us
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
