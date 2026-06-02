import type { Metadata } from "next";
import Link from "next/link";
import { marketingMetadata } from "@/lib/seo";
import {
  COMPANY_DETAILS,
  COMPANY_NAME,
  CONTACT_PATH,
  ICO_URL,
  LEGAL_LAST_UPDATED,
  PRODUCT_NAME,
} from "@/lib/legal";

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
      `This policy explains how ${PRODUCT_NAME} handles personal data when people visit our website, contact us, request a demo, use a lodge website powered by ${PRODUCT_NAME}, or access the member and admin platform.`,
      `For lodge records, member data, candidate details, welfare notes, payments, summons, communications, and reports, the relevant lodge, Province, hall group, or platform customer is usually the data controller. ${COMPANY_NAME} acts as a data processor where we host and operate ${PRODUCT_NAME} on their behalf.`,
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
    title: "How and why we use data",
    body: [
      "We use data to run lodge websites, member portals, meeting and summons workflows, payment and donation flows, candidate pipelines, communications, reporting, support, security monitoring, audit trails, and service improvement.",
      "Our lawful bases under the UK GDPR may include contract, legitimate interests, legal obligation, consent, or explicit consent, depending on the context and the data involved. Customers are responsible for the lawful basis for customer-controlled lodge records.",
      "We do not sell personal data. We do not use lodge member records for unrelated advertising.",
    ],
  },
  {
    title: "Payments, cookies, and third parties",
    body: [
      "Payment processing is handled by our payments partner. LodgePay stores payment status, references, receipts, and reconciliation information, but full card details are handled by payment processors. We never see or store your card number.",
      "We may use trusted service providers for hosting, database services, email delivery, analytics, storage, logging, support, payments, and security. These providers are used only where needed to deliver and protect the service.",
      "We use strictly necessary cookies for login and security. Analytics cookies are used only where consent is given. Our Cookie Policy explains this in more detail.",
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
    title: "International transfers",
    body: [
      "Some suppliers may process data outside the United Kingdom. Where that happens, we aim to use appropriate safeguards such as adequacy regulations, the UK International Data Transfer Agreement, the UK Addendum to EU standard contractual clauses, or equivalent contractual and technical protections.",
    ],
  },
  {
    title: "Your rights",
    body: [
      "Depending on your relationship with a lodge and the data involved, you may have rights to access, correct, delete, restrict, object to processing, request portability, and withdraw consent where processing is based on consent.",
      "If your request relates to a lodge record, we may need to pass the request to the relevant lodge or customer because they control that data. You can contact us and we will help route the request appropriately.",
      "You also have the right to complain to the Information Commissioner's Office if you are unhappy with how your personal data has been handled.",
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
            Privacy Policy for the LodgePay platform.
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-relaxed text-dash-muted sm:text-lg">
            Last updated {LEGAL_LAST_UPDATED}. This page explains how personal data is handled
            across LodgePay websites, member portals, payments, communications, and lodge
            administration tools under UK data protection law.
          </p>
        </div>
      </section>

      <section className="border-b border-dash-border bg-dash-surface py-20 lg:py-24">
        <div className="mx-auto grid max-w-6xl gap-6 px-5 lg:px-8">
          <article className="rounded-[1.25rem] border border-dash-border bg-dash-surface-subtle p-8 shadow-dash">
            <h2 className="font-heading text-2xl font-semibold text-dash-text">Who we are</h2>
            <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
              {COMPANY_DETAILS.map((item) => (
                <div key={item.label}>
                  <dt className="font-semibold text-dash-text">{item.label}</dt>
                  <dd className="mt-1 text-dash-muted">{item.value}</dd>
                </div>
              ))}
            </dl>
          </article>

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
            <Link href={CONTACT_PATH} className="font-semibold text-dash-ring hover:underline">
              contact form
            </Link>
            . You can also complain to the{" "}
            <a href={ICO_URL} className="font-semibold text-dash-ring hover:underline">
              Information Commissioner&apos;s Office
            </a>
            . Read our{" "}
            <Link href="/cookies" className="font-semibold text-dash-ring hover:underline">
              Cookie Policy
            </Link>
            .
          </div>
        </div>
      </section>
    </div>
  );
}
