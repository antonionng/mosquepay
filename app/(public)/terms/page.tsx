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
  title: "Terms of Service | ChurchPay",
  description:
    "Terms for using ChurchPay church websites, member portals, services, payments, giving, donations, Gift Aid, newcomer management, communications, reporting, and administration tools.",
  path: "/terms",
  keywords: ["ChurchPay terms", "church software terms", "church platform terms"],
});

const sections = [
  {
    title: "Using ChurchPay",
    body: [
      `${PRODUCT_NAME} provides software for church websites, member portals, services, service notices, RSVPs, giving, donations, Gift Aid, newcomer management, pastoral workflows, communications, reporting, and multi-church administration.`,
      `The service is operated by ${COMPANY_NAME}. Customers are responsible for making sure their staff, volunteers, members, and invited users use the platform lawfully, accurately, and with appropriate authority.`,
    ],
  },
  {
    title: "Customer responsibilities",
    body: [
      "Customers must maintain accurate church information, use appropriate role permissions, protect login credentials, and only upload or process personal data they are entitled to manage.",
      "Customers are responsible for the content they publish through church websites, news posts, events, service notices, emails, donation pages, and member communications.",
    ],
  },
  {
    title: "Payments and financial records",
    body: [
      "ChurchPay supports payment and donation workflows through payment partners. Payment availability, settlement, refunds, chargebacks, and card processing may be subject to partner terms and processor rules.",
      "Treasurer tools, ledgers, reports, bank imports, and reconciliation views are operational aids. Customers remain responsible for reviewing their accounts, tax position, Gift Aid records, and statutory obligations.",
    ],
  },
  {
    title: "Sensitive records",
    body: [
      "Some modules may hold sensitive church information, including pastoral care, mentoring, newcomer, conduct, audit, or compliance notes. Customers must restrict access to authorised users and follow their own governance rules.",
      "ChurchPay provides technical controls such as role-based access and audit logs, but customers decide who should have access inside their organisation.",
    ],
  },
  {
    title: "Availability and support",
    body: [
      "We aim to provide a reliable platform, but service availability may be affected by maintenance, hosting providers, payment providers, email providers, network issues, security events, or events outside our control.",
      "Technical support requests should be sent through the contact form. We may need enough detail to identify the church, user, browser, page, and affected workflow.",
    ],
  },
  {
    title: "Acceptable use",
    body: [
      "Users must not misuse the platform, attempt unauthorised access, bypass tenant boundaries, upload malicious content, spam recipients, publish unlawful content, or interfere with the security or operation of the service.",
      "We may suspend access where needed to protect the platform, customers, members, payment flows, or data security.",
    ],
  },
  {
    title: "Liability",
    body: [
      "Nothing in these terms excludes liability where it would be unlawful to do so, including liability for fraud or fraudulent misrepresentation.",
      "To the extent permitted by law, ChurchPay is provided as an operational software service and customers remain responsible for their own governance, accounts, tax decisions, church records, and published content.",
    ],
  },
  {
    title: "Governing law",
    body: [
      "These terms are governed by the laws of England and Wales. The courts of England and Wales will have jurisdiction, except where mandatory law gives a user a different right.",
    ],
  },
];

export default function TermsPage() {
  return (
    <LegalPage
      kicker="Terms"
      title="Terms for using ChurchPay."
      intro={`Last updated ${LEGAL_LAST_UPDATED}. These terms describe how ${PRODUCT_NAME} should be used by churches, networks, staff, volunteers, members, administrators, and public visitors.`}
      sections={sections}
      footer={
        <>
          For support, billing, access, or account questions, use the{" "}
          <Link href={CONTACT_PATH} className="font-semibold text-brand hover:underline">
            contact form
          </Link>
          .
        </>
      }
    />
  );
}
