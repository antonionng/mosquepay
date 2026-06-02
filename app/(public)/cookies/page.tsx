import type { Metadata } from "next";
import Link from "next/link";
import { marketingMetadata } from "@/lib/seo";
import {
  COMPANY_DETAILS,
  COMPANY_NAME,
  CONTACT_PATH,
  LEGAL_LAST_UPDATED,
  PRODUCT_NAME,
} from "@/lib/legal";

export const metadata: Metadata = marketingMetadata({
  title: "Cookie Policy | LodgePay",
  description:
    "How LodgePay uses strictly necessary cookies and optional analytics cookies, and how users can accept, decline, or change their choice.",
  path: "/cookies",
  keywords: ["LodgePay cookies", "cookie policy", "PECR analytics consent"],
});

const sections = [
  {
    title: "How we use cookies",
    body: [
      `${PRODUCT_NAME} uses cookies and similar browser storage to keep the service secure, remember your cookie choice, support login sessions, and, if you accept, understand how public pages are used.`,
      "Under the Privacy and Electronic Communications Regulations (PECR), non-essential cookies need your consent. We therefore ask before using analytics cookies.",
    ],
  },
  {
    title: "Strictly necessary cookies",
    body: [
      "These cookies are needed for core site and platform functions, including login, session security, fraud prevention, tenant routing, form protection, and remembering whether you accepted or declined analytics cookies.",
      "Strictly necessary cookies do not require consent because the site and platform cannot work properly without them.",
    ],
  },
  {
    title: "Analytics cookies",
    body: [
      "If you choose Accept all, we may use analytics cookies and events to measure page views, understand which public pages are useful, and improve the product and website.",
      "If you choose Decline, analytics cookies and page-view tracking are not enabled by LodgePay. You can still use the website and platform.",
    ],
  },
  {
    title: "Changing your choice",
    body: [
      "You can change your choice at any time by using the Cookie settings link in the footer. Your choice is stored for up to 12 months unless you clear your browser storage sooner.",
      "You can also block or delete cookies in your browser settings. Some login, security, and account features may not work if strictly necessary cookies are blocked.",
    ],
  },
  {
    title: "Data protection",
    body: [
      "Where cookie data identifies or can identify a person, it is handled under the UK GDPR and Data Protection Act 2018. Analytics is used only with consent and for service improvement.",
      `${COMPANY_NAME} does not sell personal data and does not use lodge member records for unrelated advertising.`,
    ],
  },
];

export default function CookiesPage() {
  return (
    <div className="bg-dash-bg text-dash-text">
      <section className="border-b border-dash-border bg-dash-surface pt-28">
        <div className="mx-auto max-w-6xl px-5 pb-16 pt-10 lg:px-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-dash-ring">
            Cookies
          </p>
          <h1 className="mt-4 max-w-4xl font-heading text-4xl font-semibold leading-[1.05] tracking-tight text-dash-text sm:text-5xl lg:text-6xl">
            Cookie Policy for LodgePay.
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-relaxed text-dash-muted sm:text-lg">
            Last updated {LEGAL_LAST_UPDATED}. This page explains how {PRODUCT_NAME} uses
            cookies, how consent works, and how you can change your choice.
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
            Cookie, privacy, or data protection questions can be sent through the{" "}
            <Link href={CONTACT_PATH} className="font-semibold text-dash-ring hover:underline">
              contact form
            </Link>
            .
          </div>
        </div>
      </section>
    </div>
  );
}
