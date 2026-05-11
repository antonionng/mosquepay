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
  const isMarketingRoute =
    pathname === "/" ||
    pathname === "/features" ||
    pathname === "/pricing" ||
    pathname === "/contact" ||
    pathname === "/book-demo";

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
