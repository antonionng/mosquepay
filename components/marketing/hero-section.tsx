"use client";

import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { FadeIn } from "@/components/motion";
import { HeroFigmaPanel } from "@/components/marketing/hero-figma-panel";

export function HeroSection() {
  return (
    <section className="bg-mkt-bg px-5 pb-20 pt-20 sm:px-6 sm:pt-28">
      <div className="mx-auto flex max-w-[1204px] flex-col items-center">
        {/* Eyebrow */}
        <FadeIn delay={0.1}>
          <div className="inline-flex items-center gap-2 rounded-full border border-mkt-border bg-white px-4 py-2 shadow-[0_0_1px_rgba(44,58,114,0.05),0_2px_6px_rgba(44,58,114,0.05),0_10px_18px_rgba(58,76,146,0.1)]">
            <Sparkles className="h-4 w-4 text-mkt-blue" />
            <span className="text-sm font-medium text-[#4b5162]">
              All-in-One Lodge Management Platform
            </span>
          </div>
        </FadeIn>

        {/* Headline */}
        <FadeIn delay={0.2}>
          <h1 className="mt-8 max-w-[860px] text-center font-heading text-4xl font-bold leading-[1.16] text-white sm:text-5xl lg:text-[48px]">
            One Platform for Every Lodge Operation
          </h1>
        </FadeIn>

        {/* Subtitle */}
        <FadeIn delay={0.3}>
          <p className="mx-auto mt-5 max-w-[700px] text-center text-base leading-relaxed text-mkt-text-secondary opacity-80 sm:text-lg">
            Build your lodge website, manage events and RSVPs, collect payments with Gift Aid,
            and track candidate journeys in one modern, unified system.
          </p>
        </FadeIn>

        {/* CTA Buttons */}
        <FadeIn delay={0.4}>
          <div className="mt-10 flex w-full flex-col items-center gap-3 sm:w-auto sm:flex-row">
            <Link
              href="/book-demo"
              className="w-full rounded-xl bg-mkt-blue px-7 py-3 text-center font-heading text-base font-bold text-white transition-colors hover:bg-mkt-blue-light sm:w-auto"
            >
              Start Free Trial
            </Link>
            <Link
              href="/product"
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-mkt-border bg-transparent px-7 py-3 font-heading text-base font-bold text-[#4b5162] transition-colors hover:border-mkt-text-secondary hover:text-white sm:w-auto"
            >
              Explore Product
              <ArrowRight className="h-5 w-5" />
            </Link>
          </div>
        </FadeIn>

        {/* Hero panel from Figma node 223:73053 */}
        <FadeIn delay={0.5} className="mt-16 w-full">
          <HeroFigmaPanel />
        </FadeIn>
      </div>
    </section>
  );
}
