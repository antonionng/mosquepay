import { ContactForm } from "@/components/forms/contact-form";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { resolveLodgeSlug } from "@/lib/tenant";

const contactInfo = [
  {
    title: "Email",
    content: "secretary@covenantlodge.org.uk",
    href: "mailto:secretary@covenantlodge.org.uk",
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
      <div className="public-page">
        <section className="public-hero">
          <div className="public-hero-shell">
            <div className="public-hero-copy">
              <p className="public-kicker">Contact LodgePay</p>
              <h1 className="public-hero-title">Talk to the LodgePay team.</h1>
              <p className="public-hero-body">
                Ask about product fit, onboarding, pricing, or integrations.
              </p>
            </div>
            <div className="public-hero-panel">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-200">
                Fastest route
              </p>
              <div className="mt-4">
                <Button asChild variant="primary">
                  <Link href="/book-demo">Book Demo</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>
        <section className="public-section">
          <div className="container-full max-w-4xl">
            <div className="public-grid-card">
              <h2 className="text-2xl font-semibold text-slate-950">Send us a message</h2>
              <p className="mb-8 mt-3 text-slate-600">
                We usually respond within one business day.
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
