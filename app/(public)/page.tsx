"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { LodgeHomepage } from "@/components/lodge-site/lodge-homepage";
import { MarketingLanding } from "@/components/marketing/marketing-landing";

function HomeContent() {
  const searchParams = useSearchParams();
  const isTenantMode = Boolean(searchParams.get("lodge"));

  if (isTenantMode) {
    return <LodgeHomepage />;
  }

  return <MarketingHomepage />;
}

function MarketingHomepage() {
  return <MarketingLanding />;
}

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-dash-bg">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-dash-border border-t-dash-ring" />
        </div>
      }
    >
      <HomeContent />
    </Suspense>
  );
}
