import type { ReactNode } from "react";
import { marketingMetadata } from "@/lib/seo";

export const metadata = marketingMetadata({
  title: "Online Lodge Donations and Gift Aid | LodgePay",
  description:
    "Collect lodge charity donations online with Gift Aid declarations, donor details, Mooov checkout, donation records, reporting, and event-linked charitable giving.",
  path: "/donate",
  keywords: [
    "online lodge donations",
    "Masonic Gift Aid donations",
    "lodge charity payment page",
    "Mooov donations for lodges",
  ],
});

export default function DonateLayout({ children }: { children: ReactNode }) {
  return children;
}
