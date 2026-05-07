import { ContactForm } from "@/components/forms/contact-form";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { resolveLodgeSlug } from "@/lib/tenant";

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

export default async function ContactPage({
  searchParams,
}: {
  searchParams: Promise<{ lodge?: string }>;
}) {
  const { lodge } = await searchParams;
  const isTenantMode = Boolean(lodge);
  const lodgeSlug = resolveLodgeSlug(lodge);

  if (!isTenantMode) {
    return (
      <div className="bg-dash-bg text-dash-text">
        <section className="border-b border-dash-border bg-dash-surface pt-28">
          <div className="mx-auto grid max-w-6xl gap-10 px-5 pb-16 pt-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)] lg:items-end lg:px-8">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-dash-ring">Contact LodgePay</p>
              <h1 className="mt-4 max-w-4xl font-heading text-4xl font-semibold leading-[1.05] tracking-tight text-dash-text sm:text-5xl lg:text-6xl">
                Tell us what your lodge needs to run better.
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-relaxed text-dash-muted sm:text-lg">
                Ask about product fit, pricing, onboarding, Province rollouts, integrations, or a practical walkthrough
                for your officers.
              </p>
            </div>
            <div className="rounded-[1.5rem] border border-dash-border bg-dash-surface-subtle p-7 shadow-dash">
              <p className="text-sm font-semibold text-dash-text">Fastest route</p>
              <p className="mt-3 text-sm leading-relaxed text-dash-muted">
                If you want to see the product rather than send a general note, book a focused LodgePay walkthrough.
              </p>
              <Button asChild className="mt-6" variant="primary">
                <Link href="/book-demo">Book a demo</Link>
              </Button>
            </div>
          </div>
        </section>
        <section id="contact-form" className="scroll-mt-24 border-b border-dash-border bg-dash-surface py-20 lg:py-24">
          <div className="mx-auto max-w-4xl px-5 lg:px-8">
            <div className="rounded-[1.25rem] border border-dash-border bg-dash-surface p-8 shadow-dash">
              <h2 className="font-heading text-3xl font-semibold text-dash-text">Send us a message</h2>
              <p className="mb-8 mt-3 text-dash-muted">
                Notifications go straight to the LodgePay team and you will receive a branded confirmation email.
              </p>
              <ContactForm />
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
            <p className="public-kicker">Contact Covenant Lodge</p>
            <h1 className="public-hero-title">Talk to us directly.</h1>
            <p className="public-hero-body">
              If you have a question about the lodge, membership, or an event, we&apos;d be glad
              to hear from you.
            </p>
          </div>
          <div className="public-hero-panel">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-200">
              Response approach
            </p>
            <p className="mt-4 text-sm leading-relaxed text-slate-300">
              We aim to respond promptly, clearly, and with enough context to be useful. If
              you&apos;re enquiring about joining, we&apos;ll help you understand the next step.
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
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{info.title}</p>
                  {info.href ? (
                    <a href={info.href} className="mt-3 block font-medium text-blue-600 hover:underline">
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
                Fill out the form below and we&apos;ll get back to you as soon as we can.
              </p>
              <ContactForm lodgeSlug={lodgeSlug} />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
