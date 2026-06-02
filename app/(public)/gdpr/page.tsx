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
  title: "GDPR and Data Protection | LodgePay",
  description:
    "GDPR information for LodgePay customers, lodges, Provinces, members, candidates, donors, and platform users. Covers controller roles, processor duties, member records, candidate data, Gift Aid, payments, welfare notes, and security.",
  path: "/gdpr",
  keywords: ["LodgePay GDPR", "Masonic software GDPR", "lodge data protection"],
});

const sections = [
  {
    title: "Controller and processor roles",
    body: [
      "For most lodge records, the lodge, Province, hall group, or platform customer decides why and how personal data is used. That organisation is usually the data controller.",
      `${COMPANY_NAME} normally acts as a processor for customer platform data, providing ${PRODUCT_NAME} hosting, software, support, security, backups, email delivery, payment workflow records, reporting, and technical operations.`,
      "For our own website, sales enquiries, support operations, security logs, and company administration, we may act as a controller.",
    ],
  },
  {
    title: "Categories of data",
    body: [
      "The platform can process member records, officer roles, candidate enquiries, mentoring activity, meeting attendance, summons delivery, RSVPs, dining requirements, dues, donation records, Gift Aid declarations, receipts, communications, support tickets, audit logs, and security events.",
      "Some customers may use the Almoner, welfare, compliance, or mentoring modules to store special category or sensitive personal data. These modules should be used only where there is a lawful basis and suitable internal governance.",
    ],
  },
  {
    title: "Lawful basis",
    body: [
      "Customers are responsible for deciding and recording the lawful basis for their own processing. Typical bases may include legitimate interests, contract, legal obligation, consent, or explicit consent depending on the data and purpose.",
      "LodgePay processes customer data under customer instructions, our service terms, data protection obligations, and the operational need to deliver and protect the platform.",
    ],
  },
  {
    title: "Data subject requests",
    body: [
      "Members, candidates, donors, visitors, or officers may request access, correction, deletion, restriction, portability, objection, or consent withdrawal under applicable data protection law.",
      "Where a request relates to customer-controlled lodge records, LodgePay may need to route the request to the relevant customer. We will support customers with reasonable technical assistance where needed.",
    ],
  },
  {
    title: "Security and tenant separation",
    body: [
      "The platform is designed around tenant separation, lodge context, role-based permissions, audit trails, secure session handling, encrypted transport, and restricted administrative access.",
      "Customers should review officer access regularly, remove users who no longer need access, use appropriate roles, and avoid placing unnecessary sensitive information into general notes or public content fields.",
    ],
  },
  {
    title: "Subprocessors and transfers",
    body: [
      "LodgePay may use subprocessors for hosting, database services, storage, email delivery, observability, payments, analytics, support operations, backups, and security.",
      "Where data is transferred internationally, appropriate safeguards should be used according to the provider, hosting location, contract, and applicable law.",
      "Customers can contact us through the contact form if they need more information about subprocessors for procurement or data protection review.",
    ],
  },
  {
    title: "Cookies and analytics",
    body: [
      "Strictly necessary cookies support login, security, and platform operation. Analytics cookies are only used where consent has been accepted.",
      "The Cookie Policy explains the cookie categories, how consent works, and how a user can change their choice.",
    ],
  },
  {
    title: "Complaints",
    body: [
      "If you are unhappy with how personal data has been handled, please contact us first so we can investigate. You can also complain to the Information Commissioner's Office.",
    ],
  },
];

export default function GDPRPage() {
  return (
    <div className="bg-dash-bg text-dash-text">
      <section className="border-b border-dash-border bg-dash-surface pt-28">
        <div className="mx-auto max-w-6xl px-5 pb-16 pt-10 lg:px-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-dash-ring">GDPR</p>
          <h1 className="mt-4 max-w-4xl font-heading text-4xl font-semibold leading-[1.05] tracking-tight text-dash-text sm:text-5xl lg:text-6xl">
            GDPR information for LodgePay customers and users.
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-relaxed text-dash-muted sm:text-lg">
            Last updated {LEGAL_LAST_UPDATED}. This page explains how {PRODUCT_NAME} is intended
            to support data protection duties across lodge operations, public websites, member
            portals, payments, communications, and sensitive officer workflows.
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
            GDPR or data protection questions can be sent through the{" "}
            <Link href={CONTACT_PATH} className="font-semibold text-dash-ring hover:underline">
              contact form
            </Link>
            . You can also contact the{" "}
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
