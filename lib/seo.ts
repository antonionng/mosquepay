import type { Metadata } from "next";

export const SITE_ORIGIN = "https://www.lodgepayments.co.uk";

export const SOCIAL_SHARE_IMAGE = {
  url: `${SITE_ORIGIN}/social-share.png`,
  width: 1024,
  height: 537,
  alt: "LodgePay platform preview",
};

export const LODGEPAY_KEYWORDS = [
  "Masonic lodge management software",
  "lodge management software",
  "Masonic website builder",
  "lodge website builder",
  "Freemason lodge website",
  "Masonic payments",
  "lodge dues payments",
  "Masonic event RSVP",
  "summons management",
  "Gift Aid software",
  "GASDS software",
  "candidate CRM",
  "member portal",
  "lodge charity donations",
  "Province lodge management",
  "Masonic hall management",
];

type MarketingMetadataOptions = {
  title: string;
  description: string;
  path?: string;
  keywords?: string[];
};

export function marketingMetadata({
  title,
  description,
  path = "/",
  keywords = [],
}: MarketingMetadataOptions): Metadata {
  const canonicalPath = path === "/" ? "/" : path.replace(/\/+$/, "");
  const url = `${SITE_ORIGIN}${canonicalPath}`;

  return {
    title,
    description,
    keywords: [...LODGEPAY_KEYWORDS, ...keywords],
    alternates: {
      canonical: url,
    },
    openGraph: {
      type: "website",
      title,
      description,
      url,
      siteName: "LodgePay",
      images: [SOCIAL_SHARE_IMAGE],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [SOCIAL_SHARE_IMAGE.url],
    },
  };
}

export const lodgePayStructuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_ORIGIN}/#organization`,
      name: "LodgePay",
      url: SITE_ORIGIN,
      logo: `${SITE_ORIGIN}/brand/lodgepay-logo.png`,
      sameAs: [SITE_ORIGIN],
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_ORIGIN}/#website`,
      url: SITE_ORIGIN,
      name: "LodgePay",
      publisher: { "@id": `${SITE_ORIGIN}/#organization` },
      inLanguage: "en-GB",
      potentialAction: {
        "@type": "SearchAction",
        target: `${SITE_ORIGIN}/features?q={search_term_string}`,
        "query-input": "required name=search_term_string",
      },
    },
    {
      "@type": "SoftwareApplication",
      "@id": `${SITE_ORIGIN}/#software`,
      name: "LodgePay",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      url: SITE_ORIGIN,
      image: SOCIAL_SHARE_IMAGE.url,
      publisher: { "@id": `${SITE_ORIGIN}/#organization` },
      description:
        "LodgePay is software for Masonic lodge websites, payments, events, dues, donations, Gift Aid, summons, member portals, candidate CRM, welfare workflows, reporting, and multi-lodge administration.",
      featureList: [
        "Lodge website builder",
        "Member portal",
        "Event RSVP and payments",
        "Dues and donation collection",
        "Gift Aid and GASDS claims",
        "Summons and meeting management",
        "Candidate CRM and mentoring",
        "Charity and welfare workflows",
        "Province and multi-lodge administration",
      ],
      offers: {
        "@type": "Offer",
        url: `${SITE_ORIGIN}/pricing`,
        priceCurrency: "GBP",
        availability: "https://schema.org/InStock",
      },
    },
  ],
};
