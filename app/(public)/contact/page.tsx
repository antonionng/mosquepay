import { Suspense } from "react";
import { Clock, Mail, MessageCircle } from "lucide-react";
import { ContactForm } from "@/components/forms/contact-form";
import { PublicFooter } from "@/components/layout/public-footer";
import { PublicHeader } from "@/components/layout/public-header";
import {
  MarketingShell,
  MarketingSection,
  MarketingKicker,
} from "@/components/marketing/marketing-shell";
import { resolveMosqueSlug } from "@/lib/tenant";
import { marketingMetadata } from "@/lib/seo";

const SAAS_CONTACT_INFO = [
  {
    Icon: Mail,
    title: "Email",
    content: "ag@experrt.com",
    href: "mailto:ag@experrt.com",
  },
  {
    Icon: Clock,
    title: "Response time",
    content: "We aim to reply within one working day",
  },
  {
    Icon: MessageCircle,
    title: "What to include",
    content: "Your mosque name, congregation size, and what you'd like to solve first",
  },
];

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ mosque?: string }>;
}) {
  const { mosque } = await searchParams;
  if (mosque) {
    return {
      title: "Contact the Mosque",
      description:
        "Contact the mosque team about services, membership, giving, events, or general information.",
    };
  }

  return marketingMetadata({
    title: "Contact MosquePay | Sales and Support for Mosque Software",
    description:
      "Contact MosquePay about giving, Gift Aid, mosque websites, member records, service notices, newcomer follow-up, welfare, and network rollouts for UK mosques.",
    path: "/contact",
    keywords: [
      "contact MosquePay",
      "mosque software support",
      "mosque software sales",
      "mosque giving platform enquiry",
    ],
  });
}

export default async function ContactPage({
  searchParams,
}: {
  searchParams: Promise<{ mosque?: string }>;
}) {
  const { mosque } = await searchParams;
  const isTenantMode = Boolean(mosque);
  const mosqueSlug = resolveMosqueSlug(mosque);

  if (!isTenantMode) {
    return (
      <MarketingShell>
        <section className="px-5 pb-4 pt-16 lg:px-8 lg:pt-24">
          <div className="mx-auto max-w-7xl">
            <div className="max-w-3xl">
              <MarketingKicker>Contact</MarketingKicker>
              <h1 className="mt-4 font-heading text-4xl font-bold leading-tight tracking-tight text-slate-900 sm:text-5xl">
                Talk to a human who knows mosque admin.
              </h1>
              <p className="mt-6 text-lg leading-8 text-slate-600">
                Questions about giving, Gift Aid, migration, pricing, or anything else? Tell us
                about your mosque and we&apos;ll point you in the right direction.
              </p>
            </div>
          </div>
        </section>

        <MarketingSection>
          <div className="grid gap-10 lg:grid-cols-[minmax(280px,0.7fr)_minmax(0,1.3fr)] lg:gap-14">
            <div className="space-y-4">
              {SAAS_CONTACT_INFO.map(({ Icon, title, content, href }) => (
                <div key={title} className="rounded-3xl border border-[#e9e2d4] bg-white p-6">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-brand/8 text-brand">
                    <Icon className="h-5 w-5" />
                  </span>
                  <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    {title}
                  </p>
                  {href ? (
                    <a href={href} className="mt-2 block font-medium text-brand hover:underline">
                      {content}
                    </a>
                  ) : (
                    <p className="mt-2 text-sm leading-6 text-slate-700">{content}</p>
                  )}
                </div>
              ))}
            </div>

            <div id="contact-form" className="rounded-3xl border border-[#e9e2d4] bg-white p-8 shadow-sm lg:p-10">
              <h2 className="font-heading text-2xl font-semibold text-slate-900">Send a message</h2>
              <p className="mb-8 mt-3 text-slate-600">
                Fill out the form and we&apos;ll get back to you as soon as we can.
              </p>
              <Suspense>
                <ContactForm />
              </Suspense>
            </div>
          </div>
        </MarketingSection>
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
                <p className="public-kicker">Contact the mosque</p>
                <h1 className="public-hero-title">We&apos;d love to hear from you.</h1>
                <p className="public-hero-body">
                  Questions about services, membership, giving, or anything else? Send us a
                  message and someone from the team will reply.
                </p>
              </div>
              <div className="public-hero-panel">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-200">
                  Response approach
                </p>
                <p className="mt-4 text-sm leading-relaxed text-slate-300">
                  We aim to respond promptly and personally. If you&apos;re enquiring about
                  visiting or joining, we&apos;ll help you understand the next step.
                </p>
              </div>
            </div>
          </section>

          <section className="public-section">
            <div className="container-full">
              <div className="mx-auto max-w-2xl">
                <div className="public-grid-card">
                  <h2 className="text-2xl font-semibold text-slate-950">Send a message</h2>
                  <p className="mb-8 mt-3 text-slate-600">
                    Fill out the form below and we&apos;ll get back to you as soon as we can.
                  </p>
                  <Suspense>
                    <ContactForm mosqueSlug={mosqueSlug} />
                  </Suspense>
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
