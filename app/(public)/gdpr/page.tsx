import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/marketing/legal-page";
import { marketingMetadata } from "@/lib/seo";
import {
  COMPANY_NAME,
  CONTACT_PATH,
  ICO_URL,
  LEGAL_LAST_UPDATED,
  PRODUCT_NAME,
} from "@/lib/legal";

export const metadata: Metadata = marketingMetadata({
  title: "GDPR and Data Protection | ChurchPay",
  description:
    "GDPR information for ChurchPay customers, churches, networks, members, newcomers, donors, and platform users. Covers controller roles, processor duties, member records, newcomer data, Gift Aid, payments, pastoral notes, and security.",
  path: "/gdpr",
  keywords: ["ChurchPay GDPR", "church software GDPR", "church data protection"],
});

const sections = [
  {
    title: "Controller and processor roles",
    body: [
      "For most church records, the church, network, or platform customer decides why and how personal data is used. That organisation is usually the data controller.",
      `${COMPANY_NAME} normally acts as a processor for customer platform data, providing ${PRODUCT_NAME} hosting, software, support, security, backups, email delivery, payment workflow records, reporting, and technical operations.`,
      "For our own website, sales enquiries, support operations, security logs, and company administration, we may act as a controller.",
    ],
  },
  {
    title: "Categories of data",
    body: [
      "The platform can process member records, team roles, newcomer enquiries, mentoring activity, service attendance, service notice delivery, RSVPs, hospitality and dietary requirements, giving and donation records, Gift Aid declarations, receipts, communications, support tickets, audit logs, and security events.",
      "Some customers may use the pastoral care, compliance, or mentoring modules to store special category or sensitive personal data. These modules should be used only where there is a lawful basis and suitable internal governance.",
    ],
  },
  {
    title: "Lawful basis",
    body: [
      "Customers are responsible for deciding and recording the lawful basis for their own processing. Typical bases may include legitimate interests, contract, legal obligation, consent, or explicit consent depending on the data and purpose.",
      "ChurchPay processes customer data under customer instructions, our service terms, data protection obligations, and the operational need to deliver and protect the platform.",
    ],
  },
  {
    title: "Data subject requests",
    body: [
      "Members, newcomers, donors, or team members may request access, correction, deletion, restriction, portability, objection, or consent withdrawal under applicable data protection law.",
      "Where a request relates to customer-controlled church records, ChurchPay may need to route the request to the relevant customer. We will support customers with reasonable technical assistance where needed.",
    ],
  },
  {
    title: "Security and tenant separation",
    body: [
      "The platform is designed around tenant separation, church context, role-based permissions, audit trails, secure session handling, encrypted transport, and restricted administrative access.",
      "Customers should review team access regularly, remove users who no longer need access, use appropriate roles, and avoid placing unnecessary sensitive information into general notes or public content fields.",
    ],
  },
  {
    title: "Subprocessors and transfers",
    body: [
      "ChurchPay may use subprocessors for hosting, database services, storage, email delivery, observability, payments, analytics, support operations, backups, and security.",
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
    <LegalPage
      kicker="GDPR"
      title="GDPR information for ChurchPay customers and users."
      intro={`Last updated ${LEGAL_LAST_UPDATED}. This page explains how ${PRODUCT_NAME} is intended to support data protection duties across church operations, public websites, member portals, payments, communications, and sensitive team workflows.`}
      sections={sections}
      footer={
        <>
          GDPR or data protection questions can be sent through the{" "}
          <Link href={CONTACT_PATH} className="font-semibold text-brand hover:underline">
            contact form
          </Link>
          . You can also contact the{" "}
          <a href={ICO_URL} className="font-semibold text-brand hover:underline">
            Information Commissioner&apos;s Office
          </a>
          . Read our{" "}
          <Link href="/cookies" className="font-semibold text-brand hover:underline">
            Cookie Policy
          </Link>
          .
        </>
      }
    />
  );
}
