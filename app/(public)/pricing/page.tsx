import { StaticMarketingSite } from "@/components/marketing/static-marketing-site";
import { marketingMetadata } from "@/lib/seo";

export const metadata = marketingMetadata({
  title: "LodgePay Pricing | Masonic Lodge Software Plans",
  description:
    "Compare LodgePay plans for lodges, Provinces, and hall groups. Pricing covers lodge websites, payments, events, dues, donations, Gift Aid tools, member portals, candidate CRM, reporting, and multi-lodge administration.",
  path: "/pricing",
  keywords: [
    "Masonic software pricing",
    "lodge website pricing",
    "lodge payment software pricing",
    "Masonic CRM pricing",
  ],
});

export default function PricingPage() {
  return <StaticMarketingSite initialPage="pricing" />;
}
