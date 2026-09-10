export type MarketingGuide = {
  slug: string;
  path: `/${string}`;
  listingTitle: string;
  description: string;
  publishedAt: string;
  lastModified: string;
  keywords: string[];
};

/**
 * Operator-owned field guides on www.mosque-pay.com/guides.
 * /news is the product changelog. /charity and /donate are demo mosque pages.
 */
export const MARKETING_GUIDES: readonly MarketingGuide[] = [
  {
    slug: "contactless-qr-donations-uk-mosque",
    path: "/guides/contactless-qr-donations-uk-mosque",
    listingTitle: "Contactless donations mosque UK",
    description:
      "UK mosque treasurers need contactless and QR giving that tags the fund on the spot, captures Gift Aid when it applies, and still leaves a Friday record the committee can trust. A treasurer field guide after Jumu'ah, not a hardware splash.",
    publishedAt: "2026-09-10",
    lastModified: "2026-09-10",
    keywords: [
      "contactless donations mosque UK",
      "QR code donations mosque UK",
      "contactless QR donations UK mosque",
      "replace cash collection mosque contactless UK Jumuah",
      "contactless giving mosque UK",
    ],
  },
  {
    slug: "collect-zakat-online-uk-mosque",
    path: "/guides/collect-zakat-online-uk-mosque",
    listingTitle: "Collect Zakat online UK mosque",
    description:
      "UK mosque treasurers need a collection path that takes Zakat online, keeps it apart from Sadaqah and Lillah, and shows the committee the restricted fund without rebuilding Ramadan in Excel. A field guide to mosque-side Zakat collection.",
    publishedAt: "2026-09-10",
    lastModified: "2026-09-10",
    keywords: [
      "collect Zakat online UK mosque",
      "Zakat collection UK mosque",
      "collect Zakat online",
      "mosque Zakat online",
      "Zakat collection mosque UK",
    ],
  },
  {
    slug: "mosque-treasurer-software-uk",
    path: "/guides/mosque-treasurer-software-uk",
    listingTitle: "Mosque treasurer software UK",
    description:
      "UK mosque treasurers need one stack that tags Zakat separately, captures Gift Aid evidence, and builds the committee pack without rebuilding Friday in Excel. A category field guide to the jobs behind mosque software.",
    publishedAt: "2026-09-10",
    lastModified: "2026-09-10",
    keywords: [
      "mosque treasurer software UK",
      "mosque accounts donations",
      "software for mosque treasurers",
      "mosque software UK",
      "mosque treasurer stack",
    ],
  },
  {
    slug: "gift-aid-for-uk-mosque-treasurers",
    path: "/guides/gift-aid-for-uk-mosque-treasurers",
    listingTitle: "Gift Aid for UK mosque treasurers",
    description:
      "UK mosque treasurers can collect Gift Aid declarations and GASDS evidence at Jumu'ah without rebuilding the HMRC claim in a spreadsheet. Ordinary Gift Aid, GASDS, and restricted funds in one field guide.",
    publishedAt: "2026-09-01",
    lastModified: "2026-09-01",
    keywords: [
      "Gift Aid mosque UK",
      "GASDS mosque",
      "Gift Aid Islamic charity UK",
      "Gift Aid for UK mosque treasurers",
      "mosque Gift Aid declaration",
    ],
  },
] as const;

export function getMarketingGuide(slug: string): MarketingGuide | undefined {
  return MARKETING_GUIDES.find((guide) => guide.slug === slug);
}
