import { Suspense } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { ExpressionOfInterestForm } from "@/components/forms/expression-of-interest-form";
import { PublicFooter } from "@/components/layout/public-footer";
import { PublicHeader } from "@/components/layout/public-header";
import {
  MarketingShell,
  MarketingSection,
  MarketingKicker,
  MarketingCtaBand,
} from "@/components/marketing/marketing-shell";
import { resolveChurchSlug } from "@/lib/tenant";
import { marketingMetadata } from "@/lib/seo";

export const metadata = marketingMetadata({
  title: "Get Started with ChurchPay | Church Onboarding",
  description:
    "Bring your church onto ChurchPay. Onboarding covers data import, giving and Gift Aid setup, website configuration, member portal rollout, and training for your team.",
  path: "/join",
  keywords: [
    "church onboarding",
    "church software setup",
    "switch church management software",
    "church giving setup",
  ],
});

const ONBOARDING_STEPS = [
  {
    title: "Discovery call",
    body: "We learn how your church runs today, covering giving, records, services, and who does what, and agree the right plan.",
  },
  {
    title: "Import and setup",
    body: "We help import members, giving history, and Gift Aid declarations, connect payments, and brand your church site.",
  },
  {
    title: "Team training",
    body: "Short, role-specific sessions for treasurers, administrators, and welcome teams. Volunteers pick it up fast.",
  },
  {
    title: "Go live",
    body: "Launch your giving pages and member portal, send your first service notice, and retire the spreadsheets.",
  },
];

const INCLUDED = [
  "Data import from spreadsheets or your previous system",
  "Giving, Gift Aid, and GASDS configuration",
  "Church website setup with your branding",
  "Member portal invitations",
  "Role-based permissions for your team",
  "Ongoing support from real people",
];

const TENANT_BENEFITS = [
  "A church family that knows your name",
  "Spiritual growth through teaching and community",
  "Opportunities to serve and use your gifts",
  "Practical and pastoral support in every season",
];

export default async function JoinPage({
  searchParams,
}: {
  searchParams: Promise<{ church?: string }>;
}) {
  const { church } = await searchParams;
  const isTenantMode = Boolean(church);
  const churchSlug = resolveChurchSlug(church);

  if (!isTenantMode) {
    return (
      <MarketingShell>
        <section className="px-5 pb-4 pt-16 lg:px-8 lg:pt-24">
          <div className="mx-auto max-w-7xl">
            <div className="max-w-3xl">
              <MarketingKicker>Get started</MarketingKicker>
              <h1 className="mt-4 font-heading text-4xl font-bold leading-tight tracking-tight text-slate-900 sm:text-5xl">
                Bring your church onto ChurchPay.
              </h1>
              <p className="mt-6 text-lg leading-8 text-slate-600">
                Onboarding is included in every plan, and most churches are live within days. Here
                is exactly what happens after you say yes.
              </p>
              <div className="mt-9 flex flex-wrap gap-3">
                <Link
                  href="/book-demo"
                  className="inline-flex items-center rounded-xl bg-brand px-7 py-3.5 text-sm font-semibold text-white shadow-[0_12px_28px_-8px_rgba(11,67,184,0.5)] transition-colors hover:bg-brand-dark"
                >
                  Book a demo
                </Link>
                <Link
                  href="/contact"
                  className="inline-flex items-center rounded-xl border border-[#ddd5c4] bg-white px-7 py-3.5 text-sm font-semibold text-slate-800 shadow-sm transition-colors hover:border-brand/30 hover:text-brand"
                >
                  Talk to us first
                </Link>
              </div>
            </div>
          </div>
        </section>

        <MarketingSection>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {ONBOARDING_STEPS.map((step, index) => (
              <article key={step.title} className="rounded-3xl border border-[#e9e2d4] bg-white p-7">
                <span className="font-heading text-4xl font-bold text-brand/15">{index + 1}</span>
                <h2 className="mt-3 font-heading text-lg font-semibold text-slate-900">
                  {step.title}
                </h2>
                <p className="mt-2.5 text-sm leading-6 text-slate-600">{step.body}</p>
              </article>
            ))}
          </div>

          <div className="mt-10 rounded-3xl border border-[#e9e2d4] bg-[#f4f0e7] p-8 lg:p-10">
            <h2 className="font-heading text-xl font-semibold text-slate-900">
              Included with onboarding
            </h2>
            <ul className="mt-5 grid gap-3 sm:grid-cols-2">
              {INCLUDED.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm text-slate-700">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </MarketingSection>

        <MarketingCtaBand
          title="Ready when you are."
          body="Whether you're moving from spreadsheets or another system, we'll make the transition calm and complete, including your Gift Aid history."
          secondaryLabel="See pricing"
          secondaryHref="/pricing"
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
                <p className="public-kicker">Join our church family</p>
                <h1 className="public-hero-title">A clear and welcoming path to belonging.</h1>
                <p className="public-hero-body">
                  Whoever you are and wherever you&apos;re starting from, you are welcome here.
                  From your first visit to becoming a member, we&apos;ll walk with you at your
                  pace.
                </p>
              </div>
              <div className="public-hero-panel">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-200">
                  How it works
                </p>
                <div className="mt-6 space-y-4">
                  {[
                    "Tell us a little about yourself",
                    "Visit a service and meet the community",
                    "Join a newcomers' gathering when you're ready",
                  ].map((item, index) => (
                    <div key={item} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-400">
                        Step {index + 1}
                      </p>
                      <p className="mt-2 font-medium text-white">{item}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="public-section">
            <div className="container-full">
              <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(380px,0.9fr)] lg:gap-16">
                <div>
                  <p className="section-label">Why join?</p>
                  <h2 className="section-title">Church is better together.</h2>
                  <p className="section-description">
                    Membership is about worship, friendship, service, and belonging. Being known,
                    supported, and part of something bigger than Sunday mornings.
                  </p>

                  <div className="mt-10 grid gap-4">
                    {TENANT_BENEFITS.map((benefit) => (
                      <div
                        key={benefit}
                        className="public-grid-card-muted flex items-center gap-4 py-5"
                      >
                        <div className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                        <span className="font-medium text-slate-900">{benefit}</span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-10 public-grid-card">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                      What happens next
                    </p>
                    <p className="mt-4 text-lg leading-relaxed text-slate-700">
                      Once you get in touch, someone from our welcome team will reach out, answer
                      your questions, and invite you to whatever feels like the right next step.
                    </p>
                  </div>
                </div>

                <div className="public-grid-card">
                  <h3 className="text-2xl font-semibold text-slate-950">Get in touch</h3>
                  <p className="mb-8 mt-3 text-slate-600">
                    Fill in the form below and we&apos;ll get back to you. Your details are
                    handled in confidence.
                  </p>
                  <ExpressionOfInterestForm churchSlug={churchSlug} />
                </div>
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
