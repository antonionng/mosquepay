import { StaticMarketingSite } from "@/components/marketing/static-marketing-site";
import { marketingMetadata } from "@/lib/seo";

export const metadata = marketingMetadata({
  title: "Book a LodgePay Demo | Masonic Lodge Platform Walkthrough",
  description:
    "Book a LodgePay demo for your lodge, Province, or hall group. See how LodgePay handles websites, online payments, event RSVPs, dues, donations, Gift Aid, summons, member portals, and candidate CRM.",
  path: "/book-demo",
  keywords: [
    "book Masonic software demo",
    "lodge platform demo",
    "Masonic website demo",
    "lodge payment demo",
  ],
});

export default function BookDemoPage() {
  return <StaticMarketingSite initialPage="contact" />;
}
