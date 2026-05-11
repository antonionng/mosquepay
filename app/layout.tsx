import type { Metadata } from "next";
import { Suspense } from "react";
import { Inter, DM_Sans } from "next/font/google";
import "./globals.css";
import { PageViewTracker } from "@/components/telemetry/page-view-tracker";

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
    "https://lodgepayments.co.uk";
  const normalized = raw.startsWith("http") ? raw : `https://${raw}`;
  try {
    return new URL(normalized);
  } catch {
    return new URL("https://lodgepayments.co.uk");
  }
}

const socialShareImage = {
  url: "https://www.lodgepayments.co.uk/social-share.png",
  width: 1024,
  height: 537,
  alt: "LodgePay platform preview",
};

export const metadata: Metadata = {
  metadataBase: siteUrl(),
  title: {
    default: "LodgePay | Websites, Payments, and Candidate CRM for Lodges",
    template: "%s · LodgePay",
  },
  description:
    "LodgePay helps lodges run websites, collect payments, manage events, and nurture candidates in one multi-tenant platform.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Lodge",
  },
  openGraph: {
    type: "website",
    title: "LodgePay",
    description:
      "Lodge SaaS for websites, payments, event operations, and candidate nurturing.",
    siteName: "LodgePay",
    images: [socialShareImage],
  },
  twitter: {
    card: "summary_large_image",
    title: "LodgePay",
    description:
      "Lodge SaaS for websites, payments, event operations, and candidate nurturing.",
    images: [socialShareImage.url],
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
        {children}
      </body>
    </html>
  );
}
