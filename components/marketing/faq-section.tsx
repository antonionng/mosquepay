"use client";

import { FadeIn } from "@/components/motion";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Sparkles } from "lucide-react";

const faqs = [
  {
    question: "What is LodgePay and how does it differ from other lodge tools?",
    answer:
      "LodgePay is an all-in-one SaaS platform purpose-built for lodge operations. Unlike generic website builders or payment tools, it combines a branded website builder, event management with RSVP, Stripe-powered payment processing with Gift Aid, and a full candidate CRM — all tenant-isolated so each lodge has its own space while provinces can oversee the whole portfolio.",
  },
  {
    question: "How does the payment processing and Gift Aid capture work?",
    answer:
      "LodgePay integrates with Stripe for secure payment processing. Event fees, annual dues, and charitable donations are all handled through a unified checkout. Gift Aid declarations are captured at the point of donation, and every transaction is tracked with webhook-verified status updates so your Treasurer has a complete, auditable financial record.",
  },
  {
    question: "Is our lodge data secure?",
    answer:
      "Absolutely. LodgePay uses tenant-isolated databases so each lodge's data is completely separate. Authentication is handled through industry-standard protocols, and all payment processing goes through PCI-compliant Stripe infrastructure. Your data is encrypted at rest and in transit.",
  },
  {
    question: "Can we use LodgePay for multiple lodges in our province?",
    answer:
      "Yes — multi-lodge support is a core feature. Each lodge gets its own branded website, member directory, and payment settings, while provincial administrators get a unified oversight panel with cross-lodge reporting, candidate pipeline visibility, and financial summaries.",
  },
  {
    question: "How is pricing structured? Are there any hidden fees?",
    answer:
      "LodgePay offers transparent per-lodge pricing with no hidden costs. Stripe payment processing fees are standard (passed through at cost). There are no setup fees, and you can start with a free trial to explore the full platform before committing. Volume discounts are available for provincial rollouts.",
  },
  {
    question: "We're new to digital lodge management. Do you offer onboarding support?",
    answer:
      "Yes. Every lodge gets a dedicated onboarding session where we help configure your site, import existing member data, set up payment accounts, and train your Secretary and Webmaster. We also provide ongoing support, documentation, and a community forum for best practices.",
  },
];

export function FaqSection() {
  return (
    <section className="bg-mkt-bg px-6 py-24">
      <div className="mx-auto flex max-w-[1204px] flex-col gap-12 lg:flex-row lg:gap-16">
        {/* Left heading */}
        <FadeIn>
          <div className="lg:max-w-[420px] lg:pr-10">
            <div className="inline-flex items-center gap-2 rounded-full border border-mkt-border bg-white px-4 py-2 shadow-[0_0_1px_rgba(44,58,114,0.05),0_2px_6px_rgba(44,58,114,0.05),0_10px_18px_rgba(58,76,146,0.1)]">
              <Sparkles className="h-4 w-4 text-mkt-blue" />
              <span className="text-sm font-medium text-[#4b5162]">FAQ</span>
            </div>
            <h2 className="mt-5 font-heading text-3xl font-bold leading-tight text-white sm:text-4xl lg:text-[39px]">
              Frequently asked questions
            </h2>
            <p className="mt-4 text-base text-mkt-text-secondary opacity-80">
              Explore our frequently asked questions to learn more about
              LodgePay&apos;s features, security, integration capabilities, and more
            </p>
          </div>
        </FadeIn>

        {/* Right accordion */}
        <FadeIn delay={0.15}>
          <div className="flex-1">
            <Accordion type="single" collapsible defaultValue="faq-0">
              {faqs.map((faq, i) => (
                <AccordionItem
                  key={i}
                  value={`faq-${i}`}
                  className="border-b border-mkt-border"
                >
                  <AccordionTrigger className="gap-4 py-6 text-left font-heading text-lg font-bold text-white hover:no-underline [&>svg]:text-mkt-text-secondary">
                    <div className="flex items-start gap-4">
                      <div className="mt-1 h-full w-1 shrink-0 rounded-sm bg-mkt-blue" />
                      <span>{faq.question}</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pb-6 pl-5 text-base leading-relaxed text-mkt-text-secondary">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
