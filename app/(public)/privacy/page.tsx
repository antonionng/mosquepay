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
  title: "Privacy Policy | MosquePay",
  description:
    "How MosquePay handles personal data across mosque websites, member portals, payments, communications, newcomer records, Gift Aid, pastoral notes, reporting, and administration tools.",
  path: "/privacy",
  keywords: ["MosquePay privacy", "mosque software privacy", "mosque member data"],
});

const sections = [
  {
    title: "Who this policy covers",
    body: [
      `This policy explains how ${PRODUCT_NAME} handles personal data when people visit our website, contact us, request a demo, use a mosque website powered by ${PRODUCT_NAME}, or access the member and admin platform.`,
      `For mosque records, member data, newcomer details, pastoral notes, payments, service notices, communications, and reports, the relevant mosque, network, or platform customer is usually the data controller. ${COMPANY_NAME} acts as a data processor where we host and operate ${PRODUCT_NAME} on their behalf.`,
    ],
  },
  {
    title: "Data we process",
    body: [
      "The platform may process names, email addresses, telephone numbers, mosque roles, member profiles, newcomer enquiry records, event RSVPs, hospitality and dietary preferences, giving and donation records, Gift Aid declarations, receipts, communication preferences, audit logs, support requests, and technical usage information.",
      "Certain modules may also store sensitive operational records, such as welfare notes, mentoring notes, visit records, and compliance requests. These areas are designed for role-based access and should only be used by authorised team members.",
    ],
  },
  {
    title: "How and why we use data",
    body: [
      "We use data to run mosque websites, member portals, service and notice workflows, payment and donation flows, newcomer pipelines, communications, reporting, support, security monitoring, audit trails, and service improvement.",
      "Our lawful bases under the UK GDPR may include contract, legitimate interests, legal obligation, consent, or explicit consent, depending on the context and the data involved. Customers are responsible for the lawful basis for customer-controlled mosque records.",
      "We do not sell personal data. We do not use mosque member records for unrelated advertising.",
    ],
  },
  {
    title: "Payments, cookies, and third parties",
    body: [
      "Payment processing is handled by our payments partner. MosquePay stores payment status, references, receipts, and reconciliation information, but full card details are handled by payment processors. We never see or store your card number.",
      "We may use trusted service providers for hosting, database services, email delivery, analytics, storage, logging, support, payments, and security. These providers are used only where needed to deliver and protect the service.",
      "We use strictly necessary cookies for login and security. Analytics cookies are used only where consent is given. Our Cookie Policy explains this in more detail.",
    ],
  },
  {
    title: "Retention and security",
    body: [
      "Customer mosque data is retained according to the relevant mosque or customer instructions, legal requirements, and operational needs. Some records, such as audit logs, payment records, Gift Aid records, and compliance requests, may need to be retained for longer.",
      "MosquePay applies access controls, tenant separation, role permissions, audit logging, encryption in transit, secure service credentials, and operational safeguards appropriate to the platform.",
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
      "Depending on your relationship with a mosque and the data involved, you may have rights to access, correct, delete, restrict, object to processing, request portability, and withdraw consent where processing is based on consent.",
      "If your request relates to a mosque record, we may need to pass the request to the relevant mosque or customer because they control that data. You can contact us and we will help route the request appropriately.",
      "You also have the right to complain to the Information Commissioner's Office if you are unhappy with how your personal data has been handled.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <LegalPage
      kicker="Privacy"
      title="Privacy Policy for the MosquePay platform."
      intro={`Last updated ${LEGAL_LAST_UPDATED}. This page explains how personal data is handled across MosquePay websites, member portals, payments, communications, and mosque administration tools under UK data protection law.`}
      sections={sections}
      footer={
        <>
          Questions about privacy or data rights can be sent through the{" "}
          <Link href={CONTACT_PATH} className="font-semibold text-brand hover:underline">
            contact form
          </Link>
          . You can also complain to the{" "}
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
