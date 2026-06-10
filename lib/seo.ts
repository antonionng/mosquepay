import type { Metadata } from "next";

export const SITE_ORIGIN = "https://www.churchpay.co.uk";

export const SOCIAL_SHARE_IMAGE = {
  url: `${SITE_ORIGIN}/social-share.png`,
  width: 1024,
  height: 547,
  alt: "ChurchPay - Faith. Community. Together. All-in-one membership, giving, events, and management platform for churches.",
  type: "image/png",
};

export const CHURCHPAY_KEYWORDS = [
  "church management software",
  "church management software UK",
  "church website builder",
  "church member portal",
  "church CRM",
  "church payments",
  "church giving software",
  "online church donations",
  "church event RSVP",
  "service notice management",
  "Gift Aid software",
  "GASDS software",
  "newcomer CRM",
  "member portal",
  "church charity donations",
  "church network management",
  "church hall management",
  "church accounting and reporting",
  "tithe and offering software",
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
  const keywordList = Array.from(new Set([...CHURCHPAY_KEYWORDS, ...keywords]));

  return {
    title,
    description,
    keywords: keywordList,
    alternates: {
      canonical: url,
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-image-preview": "large",
        "max-snippet": -1,
        "max-video-preview": -1,
      },
    },
    openGraph: {
      type: "website",
      title,
      description,
      url,
      siteName: "ChurchPay",
      locale: "en_GB",
      images: [SOCIAL_SHARE_IMAGE],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [{ url: SOCIAL_SHARE_IMAGE.url, alt: SOCIAL_SHARE_IMAGE.alt }],
    },
  };
}

export const churchPayStructuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_ORIGIN}/#organization`,
      name: "ChurchPay",
      legalName: "ChurchPay",
      slogan: "Faith. Community. Together.",
      url: SITE_ORIGIN,
      logo: {
        "@type": "ImageObject",
        url: `${SITE_ORIGIN}/brand/churchpay-logo.png`,
      },
      image: SOCIAL_SHARE_IMAGE.url,
      description:
        "ChurchPay is an all-in-one membership, payments, and management platform for UK churches, charities, and church networks. It brings together church websites, online giving, Gift Aid and GASDS claims, member and newcomer CRM, services and events, pastoral care, and treasurer reporting.",
      areaServed: {
        "@type": "Country",
        name: "United Kingdom",
      },
      knowsAbout: [
        "Church management",
        "Gift Aid and GASDS",
        "Church giving and donations",
        "Member and congregation CRM",
        "Church website hosting",
        "Treasurer reporting",
      ],
      sameAs: [SITE_ORIGIN],
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_ORIGIN}/#website`,
      url: SITE_ORIGIN,
      name: "ChurchPay",
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
      name: "ChurchPay",
      applicationCategory: "BusinessApplication",
      applicationSubCategory: "Church Management Software",
      operatingSystem: "Web",
      url: SITE_ORIGIN,
      image: SOCIAL_SHARE_IMAGE.url,
      screenshot: SOCIAL_SHARE_IMAGE.url,
      softwareHelp: `${SITE_ORIGIN}/features`,
      keywords: CHURCHPAY_KEYWORDS.join(", "),
      audience: {
        "@type": "Audience",
        audienceType:
          "Churches, charities, church networks, and church hall groups in the United Kingdom",
      },
      publisher: { "@id": `${SITE_ORIGIN}/#organization` },
      description:
        "ChurchPay is software for church websites, payments, services, giving, donations, Gift Aid, service notices, member portals, newcomer CRM, pastoral workflows, reporting, and multi-church administration.",
      featureList: [
        "Church website builder",
        "Member portal",
        "Event RSVP and payments",
        "Giving and donation collection",
        "Gift Aid and GASDS claims",
        "Service notices and service management",
        "Newcomer CRM and mentoring",
        "Charity and pastoral workflows",
        "Network and multi-church administration",
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
