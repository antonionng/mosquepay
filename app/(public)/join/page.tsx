import { ExpressionOfInterestForm } from "@/components/forms/expression-of-interest-form";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { resolveLodgeSlug } from "@/lib/tenant";
import { marketingMetadata } from "@/lib/seo";

export const metadata = marketingMetadata({
  title: "Join a Lodge or Onboard Your Lodge | LodgePay",
  description:
    "Start a membership enquiry for a lodge site or bring your lodge onto LodgePay. LodgePay supports candidate enquiries, membership conversations, lodge onboarding, websites, payments, events, and member records.",
  path: "/join",
  keywords: [
    "join a Masonic lodge",
    "Masonic membership enquiry",
    "lodge onboarding",
    "candidate intake software",
  ],
});

const benefits = [
  "Personal development and self-improvement",
  "Lifelong friendships with like-minded individuals",
  "Meaningful charitable work",
  "Access to a global fraternal network",
];

export default async function JoinPage({
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
              <p className="public-kicker">Lodge onboarding</p>
              <h1 className="public-hero-title">Bring your lodge onto LodgePay.</h1>
              <p className="public-hero-body">
                If you are evaluating a platform for websites, payments, and candidate
                workflows, this is the right starting point.
              </p>
              <div className="mt-8 flex gap-3">
                <Button asChild variant="primary">
                  <Link href="/book-demo">Book Demo</Link>
                </Button>
                <Button asChild variant="secondary">
                  <Link href="/contact">Talk to us</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>
        <section className="public-section">
          <div className="container-full max-w-4xl">
            <div className="public-grid-card">
              <h2 className="text-2xl font-semibold text-slate-950">What onboarding includes</h2>
              <ul className="mt-4 space-y-2 text-slate-600">
                <li>- Tenant setup and branding</li>
                <li>- Lodge website configuration and AI draft</li>
                <li>- Payment and RSVP flow activation</li>
                <li>- Candidate pipeline setup and handover</li>
              </ul>
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
            <p className="public-kicker">Join Covenant Lodge</p>
            <h1 className="public-hero-title">A clear and respectful path to membership.</h1>
            <p className="public-hero-body">
              We welcome men from different ages, backgrounds, and professions. The process from
              enquiry to initiation is designed to be supportive, transparent, and personal.
            </p>
          </div>
          <div className="public-hero-panel">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-200">How it works</p>
            <div className="mt-6 space-y-4">
              {[
                "Send an expression of interest",
                "Meet members informally and ask questions",
                "Take the next step only if it feels right",
              ].map((item, index) => (
                <div key={item} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Step {index + 1}</p>
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
              <h2 className="section-title">Membership should add depth to your life.</h2>
              <p className="section-description">
                Freemasonry is about personal development, friendship, and service. Covenant
                Lodge meets at one of London&apos;s most distinguished venues while keeping the
                experience human and grounded.
              </p>

              <div className="mt-10 grid gap-4">
                {benefits.map((benefit) => (
                  <div key={benefit} className="public-grid-card-muted flex items-center gap-4 py-5">
                    <div className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                    <span className="font-medium text-slate-900">{benefit}</span>
                  </div>
                ))}
              </div>

              <div className="mt-10 public-grid-card">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">What happens next</p>
                <p className="mt-4 text-lg leading-relaxed text-slate-700">
                  Once you enquire, we&apos;ll arrange a conversation and help you understand the lodge,
                  the process, and whether membership is a good fit for you.
                </p>
              </div>
            </div>

            <div className="public-grid-card">
              <h3 className="text-2xl font-semibold text-slate-950">Express your interest</h3>
              <p className="mb-8 mt-3 text-slate-600">
                Fill in the form below and we&apos;ll get in touch. Your details are handled in confidence.
              </p>
              <ExpressionOfInterestForm lodgeSlug={lodgeSlug} />
            </div>
          </div>
        </div>
      </section>

      <section className="public-section public-section-muted">
        <div className="container-full max-w-4xl text-center">
          <div className="public-grid-card-muted">
            <h3 className="text-2xl font-semibold text-slate-950">Women and Freemasonry</h3>
            <p className="mx-auto mt-4 max-w-2xl text-slate-600">
              Freemasonry for women is organised separately. Visit the{" "}
              <a href="https://www.owf.org.uk" className="font-medium text-blue-600 hover:underline">
                Order of Women Freemasons
              </a>{" "}
              or the{" "}
              <a href="https://www.hfaf.org" className="font-medium text-blue-600 hover:underline">
                HFAF
              </a>{" "}
              to learn more.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
