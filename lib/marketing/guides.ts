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
