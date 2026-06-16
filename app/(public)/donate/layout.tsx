import type { ReactNode } from "react";
import { marketingMetadata } from "@/lib/seo";

export const metadata = marketingMetadata({
  title: "Online Mosque Donations and Gift Aid | MosquePay",
  description:
    "Collect mosque charity donations online with Gift Aid declarations, donor details, Mooov checkout, donation records, reporting, and event-linked charitable giving.",
  path: "/donate",
  keywords: [
    "online mosque donations",
    "Mosque Gift Aid donations",
    "mosque charity payment page",
    "Mooov donations for mosques",
  ],
});

export default function DonateLayout({ children }: { children: ReactNode }) {
  return children;
}
