import type { ReactNode } from "react";
import { marketingMetadata } from "@/lib/seo";

export const metadata = marketingMetadata({
  title: "Online Church Donations and Gift Aid | ChurchPay",
  description:
    "Collect church charity donations online with Gift Aid declarations, donor details, Mooov checkout, donation records, reporting, and event-linked charitable giving.",
  path: "/donate",
  keywords: [
    "online church donations",
    "Church Gift Aid donations",
    "church charity payment page",
    "Mooov donations for churches",
  ],
});

export default function DonateLayout({ children }: { children: ReactNode }) {
  return children;
}
