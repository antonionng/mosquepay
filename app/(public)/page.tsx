"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { LodgeHomepage } from "@/components/lodge-site/lodge-homepage";
import { MarketingNavbar } from "@/components/marketing/marketing-navbar";
import { HeroSection } from "@/components/marketing/hero-section";
import { SocialProofSection } from "@/components/marketing/social-proof-section";
import { FeaturesSection } from "@/components/marketing/features-section";
import { TestimonialsSection } from "@/components/marketing/testimonials-section";
import { TrialBannerSection } from "@/components/marketing/trial-banner-section";
import { SolutionsGridSection } from "@/components/marketing/solutions-grid-section";
import { FaqSection } from "@/components/marketing/faq-section";
import { MarketingFooter } from "@/components/marketing/marketing-footer";

function HomeContent() {
  const searchParams = useSearchParams();
  const isTenantMode = Boolean(searchParams.get("lodge"));

  if (isTenantMode) {
    return <LodgeHomepage />;
  }

  return <MarketingHomepage />;
}

function MarketingHomepage() {
  return (
    <div className="min-h-screen bg-mkt-bg">
      <MarketingNavbar />
      <main>
        <HeroSection />
        <SocialProofSection />
        <FeaturesSection />
        <TestimonialsSection />
        <TrialBannerSection />
        <SolutionsGridSection />
        <FaqSection />
      </main>
      <MarketingFooter />
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-mkt-bg">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-mkt-border border-t-mkt-blue" />
        </div>
      }
    >
      <HomeContent />
    </Suspense>
  );
}
