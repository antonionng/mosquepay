import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service | LodgePay",
  description: "Terms for using LodgePay websites, member portals, payments, communications, and administration tools.",
};

const sections = [
  {
    title: "Using LodgePay",
    body: [
      "LodgePay provides software for lodge websites, member portals, meetings, summons, RSVPs, dues, donations, Gift Aid, candidate management, welfare workflows, communications, reporting, and multi-lodge administration.",
      "Customers are responsible for making sure their officers, staff, members, and invited users use the platform lawfully, accurately, and with appropriate authority.",
    ],
  },
  {
    title: "Customer responsibilities",
    body: [
      "Customers must maintain accurate lodge information, use appropriate officer permissions, protect login credentials, and only upload or process personal data they are entitled to manage.",
      "Customers are responsible for the content they publish through lodge websites, news posts, events, summons, emails, donation pages, and member communications.",
    ],
  },
  {
    title: "Payments and financial records",
    body: [
      "LodgePay supports payment and donation workflows through third-party payment providers such as Stripe. Payment availability, settlement, refunds, chargebacks, and card processing are subject to the payment provider's own terms.",
      "Treasurer tools, ledgers, reports, bank imports, and reconciliation views are operational aids. Customers remain responsible for reviewing their accounts, tax position, Gift Aid records, and statutory obligations.",
    ],
  },
  {
    title: "Sensitive records",
    body: [
      "Some modules may hold sensitive lodge information, including welfare, Almoner, mentoring, candidate, conduct, audit, or compliance notes. Customers must restrict access to authorised users and follow their own governance rules.",
      "LodgePay provides technical controls such as role-based access and audit logs, but customers decide who should have access inside their organisation.",
    ],
  },
  {
    title: "Availability and support",
    body: [
      "We aim to provide a reliable platform, but service availability may be affected by maintenance, hosting providers, payment providers, email providers, network issues, or events outside our control.",
      "Technical support requests should be sent through the contact form. We may need enough detail to identify the lodge, user, browser, page, and affected workflow.",
    ],
  },
  {
    title: "Acceptable use",
    body: [
      "Users must not misuse the platform, attempt unauthorised access, bypass tenant boundaries, upload malicious content, spam recipients, publish unlawful content, or interfere with the security or operation of the service.",
      "We may suspend access where needed to protect the platform, customers, members, payment flows, or data security.",
    ],
  },
];

export default function TermsPage() {
  return (
    <div className="bg-dash-bg text-dash-text">
      <section className="border-b border-dash-border bg-dash-surface pt-28">
        <div className="mx-auto max-w-6xl px-5 pb-16 pt-10 lg:px-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-dash-ring">Terms</p>
          <h1 className="mt-4 max-w-4xl font-heading text-4xl font-semibold leading-[1.05] tracking-tight text-dash-text sm:text-5xl lg:text-6xl">
            Terms for using LodgePay.
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-relaxed text-dash-muted sm:text-lg">
            Last updated 7 May 2026. These terms describe how LodgePay should be used by lodges, Provinces,
            officers, members, administrators, and public visitors.
          </p>
        </div>
      </section>

      <section className="border-b border-dash-border bg-dash-surface py-20 lg:py-24">
        <div className="mx-auto grid max-w-6xl gap-6 px-5 lg:px-8">
          {sections.map((section) => (
            <article key={section.title} className="rounded-[1.25rem] border border-dash-border bg-dash-surface p-8 shadow-dash">
              <h2 className="font-heading text-2xl font-semibold text-dash-text">{section.title}</h2>
              <div className="mt-4 space-y-4 text-base leading-relaxed text-dash-muted">
                {section.body.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </article>
          ))}
          <div className="rounded-[1.25rem] border border-dash-border bg-dash-surface-subtle p-8 text-base leading-relaxed text-dash-muted">
            For support, billing, access, or account questions, use the{" "}
            <Link href="/contact#contact-form" className="font-semibold text-dash-ring hover:underline">
              contact form
            </Link>
            .
          </div>
        </div>
      </section>
    </div>
  );
}
