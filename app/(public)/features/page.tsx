import { StaticMarketingSite } from "@/components/marketing/static-marketing-site";
import { marketingMetadata } from "@/lib/seo";

export const metadata = marketingMetadata({
  title: "Masonic Lodge Management Features | LodgePay",
  description:
    "Explore LodgePay features for Masonic lodges, Provinces, and hall groups: lodge websites, member portals, event RSVPs, online payments, dues, donations, Gift Aid, GASDS, summons, candidate CRM, mentoring, welfare, and reporting.",
  path: "/features",
  keywords: [
    "Masonic lodge features",
    "lodge event software",
    "Masonic member portal",
    "lodge summons software",
    "Masonic candidate management",
  ],
});

export default function FeaturesPage() {
  return <StaticMarketingSite initialPage="features" />;
}

