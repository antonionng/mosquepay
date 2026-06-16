import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/marketing/legal-page";
import { marketingMetadata } from "@/lib/seo";
import {
  COMPANY_NAME,
  CONTACT_PATH,
  LEGAL_LAST_UPDATED,
  PRODUCT_NAME,
} from "@/lib/legal";

export const metadata: Metadata = marketingMetadata({
  title: "Cookie Policy | MosquePay",
  description:
    "How MosquePay uses strictly necessary cookies and optional analytics cookies, and how users can accept, decline, or change their choice.",
  path: "/cookies",
  keywords: ["MosquePay cookies", "cookie policy", "PECR analytics consent"],
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
      "If you choose Decline, analytics cookies and page-view tracking are not enabled by MosquePay. You can still use the website and platform.",
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
      `${COMPANY_NAME} does not sell personal data and does not use mosque member records for unrelated advertising.`,
    ],
  },
];

export default function CookiesPage() {
  return (
    <LegalPage
      kicker="Cookies"
      title="Cookie Policy for MosquePay."
      intro={`Last updated ${LEGAL_LAST_UPDATED}. This page explains how ${PRODUCT_NAME} uses cookies, how consent works, and how you can change your choice.`}
      sections={sections}
      footer={
        <>
          Cookie, privacy, or data protection questions can be sent through the{" "}
          <Link href={CONTACT_PATH} className="font-semibold text-brand hover:underline">
            contact form
          </Link>
          .
        </>
      }
    />
  );
}
