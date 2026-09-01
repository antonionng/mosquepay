"use client";

import { Suspense } from "react";
import { usePathname } from "next/navigation";
import { PublicHeader } from "@/components/layout/public-header";
import { PublicFooter } from "@/components/layout/public-footer";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  // Marketing/legal routes render their own MarketingShell (or, in tenant
  // mode, the page itself wraps with PublicHeader/PublicFooter).
  const isMarketingRoute =
    pathname === "/" ||
    pathname === "/features" ||
    pathname === "/pricing" ||
    pathname === "/faq" ||
    pathname === "/about" ||
    pathname === "/contact" ||
    pathname === "/book-demo" ||
    pathname === "/news" ||
    pathname === "/guides" ||
    pathname.startsWith("/guides/") ||
    pathname === "/join" ||
    pathname === "/login" ||
    pathname === "/terms" ||
    pathname === "/privacy" ||
    pathname === "/gdpr" ||
    pathname === "/cookies";

  if (isMarketingRoute) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Suspense>
        <PublicHeader />
      </Suspense>
      <main className="flex-1">{children}</main>
      <Suspense>
        <PublicFooter />
      </Suspense>
    </div>
  );
}
