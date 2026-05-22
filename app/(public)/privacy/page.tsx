import type { Metadata } from "next";
import Link from "next/link";
import { marketingMetadata } from "@/lib/seo";

export const metadata: Metadata = marketingMetadata({
  title: "Privacy Policy | LodgePay",
  description:
    "How LodgePay handles personal data across lodge websites, member portals, payments, communications, candidate records, Gift Aid, welfare notes, reporting, and administration tools.",
  path: "/privacy",
  keywords: ["LodgePay privacy", "Masonic software privacy", "lodge member data"],
});

const sections = [
  {
    title: "Who this policy covers",
    body: [
      "This policy explains how LodgePay handles personal data when people visit our website, contact us, request a demo, use a lodge website powered by LodgePay, or access the LodgePay member and admin platform.",
      "For lodge records, member data, candidate details, welfare notes, payments, summons, communications, and reports, the relevant lodge, Province, hall group, or platform customer is usually the data controller. LodgePay acts as a data processor where we host and operate the platform on their behalf.",
    ],
  },
  {
    title: "Data we process",
    body: [
      "The platform may process names, email addresses, telephone numbers, lodge roles, member profiles, candidate enquiry records, event RSVPs, dining preferences, dues and donation records, Gift Aid declarations, receipts, communication preferences, audit logs, support requests, and technical usage information.",
      "Certain modules may also store sensitive operational records, such as Almoner welfare notes, mentoring notes, visit records, and compliance requests. These areas are designed for role-based access and should only be used by authorised officers.",
    ],
  },
  {
    title: "How we use data",
    body: [
      "We use data to run lodge websites, member portals, meeting and summons workflows, payment and donation flows, candidate pipelines, communications, reporting, support, security monitoring, audit trails, and service improvement.",
      "We do not sell personal data. We do not use lodge member records for unrelated advertising.",
    ],
  },
  {
    title: "Payments and third parties",
    body: [
      "Payment processing is handled by Mooov, our payments partner. LodgePay stores payment status, references, receipts, and reconciliation information, but full card details are handled by Mooov and its underlying payment processors. We never see or store your card number.",
      "We may use trusted service providers for hosting, email delivery, analytics, storage, logging, support, and security. These providers are used only where needed to deliver and protect the service.",
    ],
  },
  {
    title: "Retention and security",
    body: [
      "Customer lodge data is retained according to the relevant lodge or customer instructions, legal requirements, and operational needs. Some records, such as audit logs, payment records, Gift Aid records, and compliance requests, may need to be retained for longer.",
      "LodgePay applies access controls, tenant separation, role permissions, audit logging, encryption in transit, secure service credentials, and operational safeguards appropriate to the platform.",
    ],
  },
  {
    title: "Your rights",
    body: [
      "Depending on your location and relationship with a lodge, you may have rights to access, correct, delete, restrict, or object to processing of your personal data.",
      "If your request relates to a lodge record, we may need to pass the request to the relevant lodge or customer because they control that data. You can contact us and we will help route the request appropriately.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <div className="bg-dash-bg text-dash-text">
      <section className="border-b border-dash-border bg-dash-surface pt-28">
        <div className="mx-auto max-w-6xl px-5 pb-16 pt-10 lg:px-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-dash-ring">Privacy</p>
          <h1 className="mt-4 max-w-4xl font-heading text-4xl font-semibold leading-[1.05] tracking-tight text-dash-text sm:text-5xl lg:text-6xl">
            Privacy policy for the LodgePay platform.
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-relaxed text-dash-muted sm:text-lg">
            Last updated 7 May 2026. This page explains how personal data is handled across LodgePay websites,
            member portals, payments, communications, and lodge administration tools.
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
            Questions about privacy or data rights can be sent through the{" "}
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
