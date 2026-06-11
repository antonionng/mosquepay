import type { Metadata } from "next";
import { Suspense } from "react";
import { Inter, DM_Sans } from "next/font/google";
import "./globals.css";
import { CookieConsent } from "@/components/legal/cookie-consent";
import { PageViewTracker } from "@/components/telemetry/page-view-tracker";
import {
  churchPayStructuredData,
  marketingMetadata,
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
    "https://www.churchpay.co.uk";
  const normalized = raw.startsWith("http") ? raw : `https://${raw}`;
  try {
    return new URL(normalized);
  } catch {
    return new URL("https://www.churchpay.co.uk");
  }
}

export const metadata: Metadata = {
  ...marketingMetadata({
    title: "ChurchPay | Church Websites, Giving, Events, and Member CRM",
    description:
      "ChurchPay is an all-in-one platform for churches, networks, and hall groups. Build church websites, collect giving and donations, manage services and events, send service notices, claim Gift Aid, run member portals, and nurture newcomers.",
    path: "/",
  }),
  metadataBase: siteUrl(),
  applicationName: "ChurchPay",
  authors: [{ name: "ChurchPay", url: SITE_ORIGIN }],
  creator: "ChurchPay",
  publisher: "ChurchPay",
  category: "Church management software",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Church",
  },
  icons: {
    icon: "/icon.png",
    apple: "/icon.png",
  },
  // format-detection:none stops iOS Safari from auto-linking phone numbers,
  // addresses, and dates in admin/church content (they show up as ugly blue
  // underlined "tap to call" affordances on numeric IDs and reference codes).
  formatDetection: {
    telephone: false,
    date: false,
    address: false,
    email: false,
    url: false,
  },
  other: {
    "article:publisher": SITE_ORIGIN,
    // Hint to Chromium PWAs that landscape is also acceptable on tablets.
    "mobile-web-app-capable": "yes",
  },
};

export const viewport = {
  themeColor: "#1d4ed8",
  // viewportFit:"cover" lets the app draw under iOS Safari's notch + home
  // indicator so we can use env(safe-area-inset-*) to honour the cutouts
  // ourselves. width/initialScale stay at Next.js's sane defaults; we do
  // NOT set maximumScale:1 because that breaks pinch-to-zoom accessibility.
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover" as const,
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
          dangerouslySetInnerHTML={{ __html: JSON.stringify(churchPayStructuredData) }}
        />
        {children}
        <CookieConsent />
      </body>
    </html>
  );
}
