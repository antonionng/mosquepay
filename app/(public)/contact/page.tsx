import { Suspense } from "react";
import { ContactForm } from "@/components/forms/contact-form";
import { PublicFooter } from "@/components/layout/public-footer";
import { PublicHeader } from "@/components/layout/public-header";
import { StaticMarketingSite } from "@/components/marketing/static-marketing-site";
import { resolveLodgeSlug } from "@/lib/tenant";
import { marketingMetadata } from "@/lib/seo";

const contactInfo = [
  {
    title: "Email",
    content: "ag@experrt.com",
    href: "mailto:ag@experrt.com",
  },
  {
    title: "Location",
    content: "Mark Masons' Hall, 86 St James's Street, Mayfair, London",
  },
  {
    title: "Response Time",
    content: "We aim to respond within 48 hours",
  },
];

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ lodge?: string }>;
}) {
  const { lodge } = await searchParams;
  if (lodge) {
    return {
      title: "Contact the Lodge",
      description:
        "Contact the lodge secretary about membership enquiries, visiting, events, meetings, charity, or general lodge information.",
    };
  }

  return marketingMetadata({
    title: "Contact LodgePay | Masonic Lodge Software Support and Sales",
    description:
      "Contact LodgePay to discuss Masonic lodge websites, payments, event RSVPs, dues, donations, Gift Aid, member portals, candidate CRM, Province administration, and lodge operations software.",
    path: "/contact",
    keywords: [
      "contact LodgePay",
      "Masonic software support",
      "lodge software sales",
      "lodge website enquiry",
    ],
  });
}

export default async function ContactPage({
  searchParams,
}: {
  searchParams: Promise<{ lodge?: string }>;
}) {
  const { lodge } = await searchParams;
  const isTenantMode = Boolean(lodge);
  const lodgeSlug = resolveLodgeSlug(lodge);

  if (!isTenantMode) {
    return <StaticMarketingSite initialPage="contact" />;
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
                <p className="public-kicker">Contact Covenant Lodge</p>
                <h1 className="public-hero-title">Talk to us directly.</h1>
                <p className="public-hero-body">
                  If you have a question about the lodge, membership, or an event,
                  we&apos;d be glad to hear from you.
                </p>
              </div>
              <div className="public-hero-panel">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-200">
                  Response approach
                </p>
                <p className="mt-4 text-sm leading-relaxed text-slate-300">
                  We aim to respond promptly, clearly, and with enough context to be
                  useful. If you&apos;re enquiring about joining, we&apos;ll help you
                  understand the next step.
                </p>
              </div>
            </div>
          </section>

          <section className="public-section">
            <div className="container-full">
              <div className="grid gap-10 lg:grid-cols-[minmax(280px,0.7fr)_minmax(0,1.3fr)] lg:gap-16">
                <div className="space-y-4">
                  {contactInfo.map((info) => (
                    <div key={info.title} className="public-grid-card-muted">
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                        {info.title}
                      </p>
                      {info.href ? (
                        <a
                          href={info.href}
                          className="mt-3 block font-medium text-blue-600 hover:underline"
                        >
                          {info.content}
                        </a>
                      ) : (
                        <p className="mt-3 text-slate-700">{info.content}</p>
                      )}
                    </div>
                  ))}
                </div>

                <div className="public-grid-card">
                  <h2 className="text-2xl font-semibold text-slate-950">Send a message</h2>
                  <p className="mb-8 mt-3 text-slate-600">
                    Fill out the form below and we&apos;ll get back to you as soon as we
                    can.
                  </p>
                  <ContactForm lodgeSlug={lodgeSlug} />
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
