import type { Metadata } from "next";
import { Suspense } from "react";
import { Inter, DM_Sans } from "next/font/google";
import "./globals.css";
import { PageViewTracker } from "@/components/telemetry/page-view-tracker";
import {
  lodgePayStructuredData,
  marketingMetadata,
  SOCIAL_SHARE_IMAGE,
  SITE_ORIGIN,
} from "@/lib/seo";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
  weight: ["400", "500", "700"],
});

function siteUrl(): URL {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.VERCEL_PROJECT_PRODUCTION_URL ??
    "https://www.lodgepayments.co.uk";
  const normalized = raw.startsWith("http") ? raw : `https://${raw}`;
  try {
    return new URL(normalized);
  } catch {
    return new URL("https://www.lodgepayments.co.uk");
  }
}

export const metadata: Metadata = {
  ...marketingMetadata({
    title: "LodgePay | Masonic Lodge Websites, Payments, Events, and Member CRM",
    description:
      "LodgePay is an all-in-one platform for Masonic lodges, Provinces, and hall groups. Build lodge websites, collect dues and donations, manage events, send summons, claim Gift Aid, run member portals, and nurture candidates.",
    path: "/",
  }),
  metadataBase: siteUrl(),
  applicationName: "LodgePay",
  authors: [{ name: "LodgePay", url: SITE_ORIGIN }],
  creator: "LodgePay",
  publisher: "LodgePay",
  category: "Masonic lodge management software",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Lodge",
  },
  icons: {
    icon: "/icon.png",
    apple: "/icon.png",
  },
  other: {
    "og:image:secure_url": SOCIAL_SHARE_IMAGE.url,
    "article:publisher": SITE_ORIGIN,
  },
};

export const viewport = {
  themeColor: "#1d4ed8",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${dmSans.variable}`}>
      <body className="min-h-screen bg-background font-sans antialiased">
        <Suspense fallback={null}>
          <PageViewTracker />
        </Suspense>
        <script
          type="application/ld+json"
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: JSON.stringify(lodgePayStructuredData) }}
        />
        {children}
      </body>
    </html>
  );
}
