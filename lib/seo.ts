import type { Metadata } from "next";

export const SITE_ORIGIN = "https://www.mosque-pay.com";

export const SOCIAL_SHARE_IMAGE = {
  url: "/social-share.png",
  width: 1200,
  height: 630,
  alt: "MosquePay — Smart Payments. Stronger Communities. The all-in-one platform for mosques to manage membership, payments, donations, Zakat, Sadaqah, and Gift Aid.",
  type: "image/png",
};

export function socialShareImageUrl(origin: string = SITE_ORIGIN): string {
  return `${origin.replace(/\/$/, "")}${SOCIAL_SHARE_IMAGE.url}`;
}

export const MOSQUEPAY_KEYWORDS = [
  "mosque management software",
  "masjid management software",
  "mosque management software UK",
  "mosque website builder",
  "masjid website builder",
  "mosque member portal",
  "mosque membership management",
  "mosque CRM",
  "mosque payments",
  "mosque donation app",
  "online mosque donations",
  "Zakat collection software",
  "Zakat and Sadaqah collection",
  "Sadaqah donations",
  "mosque direct debit",
  "Friday Jumu'ah donations",
  "mosque event RSVP",
  "Jumu'ah notice management",
  "Gift Aid software",
  "GASDS software",
  "Muslim charity Gift Aid",
  "newcomer CRM",
  "mosque charity donations",
  "mosque network management",
  "mosque hall booking",
  "mosque accounting and reporting",
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
  const keywordList = Array.from(new Set([...MOSQUEPAY_KEYWORDS, ...keywords]));

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
      siteName: "MosquePay",
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

export const mosquePayStructuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_ORIGIN}/#organization`,
      name: "MosquePay",
      legalName: "MosquePay",
      slogan: "Smart Payments. Stronger Communities.",
      url: SITE_ORIGIN,
      logo: {
        "@type": "ImageObject",
        url: `${SITE_ORIGIN}/brand/mosquepay-logo.png`,
      },
      image: socialShareImageUrl(),
      description:
        "MosquePay is an all-in-one membership, payments, and management platform for UK mosques, Islamic centres, Muslim charities, and mosque networks. It brings together mosque websites, online donations, Zakat and Sadaqah collection, Gift Aid and GASDS claims, member and newcomer CRM, Jumu'ah and events, community welfare, and treasurer reporting.",
      areaServed: {
        "@type": "Country",
        name: "United Kingdom",
      },
      knowsAbout: [
        "Mosque and masjid management",
        "Zakat and Sadaqah collection",
        "Mosque donations and online giving",
        "Gift Aid and GASDS for Muslim charities",
        "Member and congregation CRM",
        "Jumu'ah, prayers, and event management",
        "Mosque website hosting",
        "Community welfare and treasurer reporting",
      ],
      sameAs: [SITE_ORIGIN],
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_ORIGIN}/#website`,
      url: SITE_ORIGIN,
      name: "MosquePay",
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
      name: "MosquePay",
      applicationCategory: "BusinessApplication",
      applicationSubCategory: "Mosque Management Software",
      operatingSystem: "Web",
      url: SITE_ORIGIN,
      image: socialShareImageUrl(),
      screenshot: socialShareImageUrl(),
      softwareHelp: `${SITE_ORIGIN}/features`,
      keywords: MOSQUEPAY_KEYWORDS.join(", "),
      audience: {
        "@type": "Audience",
        audienceType:
          "Mosques, charities, mosque networks, and mosque hall groups in the United Kingdom",
      },
      publisher: { "@id": `${SITE_ORIGIN}/#organization` },
      description:
        "MosquePay is software for mosque websites, payments, donations, Zakat and Sadaqah, Gift Aid, Jumu'ah and prayer notices, member portals, newcomer CRM, community welfare workflows, reporting, and multi-mosque administration.",
      featureList: [
        "Mosque website builder",
        "Member portal and membership management",
        "Event RSVP and payments",
        "Donations, Zakat, and Sadaqah collection",
        "Gift Aid and GASDS claims",
        "Jumu'ah, prayer notices, and event management",
        "Newcomer CRM and mentoring",
        "Charity campaigns and community welfare",
        "Network and multi-mosque administration",
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
