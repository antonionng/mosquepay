"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { resolveLodgeSlug } from "@/lib/tenant";

const tenantLinks = {
  main: [
    { href: "/", label: "Home" },
    { href: "/events", label: "Events" },
    { href: "/charity", label: "Charity" },
    { href: "/join", label: "Join Us" },
  ],
  secondary: [
    { href: "/news", label: "News" },
    { href: "/contact", label: "Contact" },
    { href: "/faq", label: "FAQ" },
  ],
};

const marketingLinks = {
  main: [
    { href: "/product", label: "Product" },
    { href: "/features", label: "Features" },
    { href: "/pricing", label: "Pricing" },
    { href: "/book-demo", label: "Book Demo" },
  ],
  secondary: [
    { href: "/faq", label: "FAQs" },
    { href: "/contact#contact-form", label: "Technical support" },
    { href: "/contact", label: "Contact" },
  ],
};

type LodgeBranding = {
  name: string;
  city: string | null;
  tagline: string | null;
};

function initialsFromName(name: string) {
  const words = name.split(" ").filter(Boolean);
  if (words.length === 0) return "LG";
  return words
    .slice(0, 2)
    .map((word) => word.charAt(0))
    .join("")
    .toUpperCase();
}

export function PublicFooter() {
  const searchParams = useSearchParams();
  const [branding, setBranding] = useState<LodgeBranding | null>(null);
  const rawLodgeQuery = searchParams.get("lodge");
  const isTenantMode = Boolean(rawLodgeQuery);
  const lodgeSlug = useMemo(
    () => resolveLodgeSlug(rawLodgeQuery),
    [rawLodgeQuery]
  );
  const links = isTenantMode ? tenantLinks : marketingLinks;
  const withTenantQuery = (href: string) =>
    isTenantMode && href.startsWith("/")
      ? `${href}?lodge=${encodeURIComponent(lodgeSlug)}`
      : href;

  useEffect(() => {
    let active = true;
    async function loadBranding() {
      try {
        const res = await fetch(`/api/lodges/${lodgeSlug}/site`);
        if (!res.ok) return;
        const data = await res.json();
        if (!active) return;
        const lodge = data.lodge as LodgeBranding | null;
        if (lodge) setBranding(lodge);
      } catch {
        // Keep static fallback branding.
      }
    }
    if (!isTenantMode) return;
    loadBranding();
    return () => {
      active = false;
    };
  }, [isTenantMode, lodgeSlug]);

  return (
    <footer
      className={
        isTenantMode
          ? "border-t border-slate-800 bg-slate-950 text-white"
          : "border-t border-dash-border bg-dash-surface text-dash-text"
      }
    >
      <div className={isTenantMode ? "container-full py-16 lg:py-20" : "mx-auto max-w-6xl px-5 py-16 lg:px-8 lg:py-20"}>
        <div className="grid gap-14 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <div className="mb-5 flex items-center gap-3">
              {isTenantMode ? (
                <>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-[11px] font-semibold tracking-[0.2em]">
                    {initialsFromName(branding?.name ?? "Covenant Lodge")}
                  </div>
                  <div>
                    <p className="text-base font-semibold tracking-tight">
                      {branding?.name ?? "Covenant Lodge"}
                    </p>
                    <p className="text-sm text-slate-400">
                      {`No. 4344 · ${branding?.city ?? "Mayfair, London"}`}
                    </p>
                  </div>
                </>
              ) : (
                <Image
                  src="/brand/lodgepay-sidebar-logo.png"
                  alt="LodgePay"
                  width={1032}
                  height={245}
                  className="h-9 w-auto max-w-[10rem] object-contain opacity-90"
                />
              )}
            </div>
            <p
              className={
                isTenantMode
                  ? "max-w-md text-sm leading-relaxed text-slate-400"
                  : "max-w-md text-sm leading-relaxed text-dash-muted"
              }
            >
              {isTenantMode
                ? branding?.tagline ??
                  "A lodge website powered by LodgePay, helping members and visitors navigate events and enquiries."
                : "Websites, meetings, summons, dues, charity, Gift Aid, member portal, digital card, candidate CRM, mentoring, Almoner, communications, Treasurer reconciliation, and reporting for Masonic lodges."}
            </p>
            {isTenantMode ? (
              <div className="mt-6 flex flex-wrap gap-3 text-xs text-slate-400">
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
                  Established 1922
                </span>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
                  Mark Masons&apos; Hall
                </span>
              </div>
            ) : null}
          </div>
          
          <div className="lg:col-span-3">
            <p
              className={
                isTenantMode
                  ? "mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500"
                  : "mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-dash-faint"
              }
            >
              Explore
            </p>
            <nav className="flex flex-col gap-3">
              {links.main.map((link) => (
                <Link
                  key={link.href}
                  href={withTenantQuery(link.href)}
                  className={
                    isTenantMode
                      ? "text-sm text-slate-400 transition-colors hover:text-white"
                      : "text-sm text-dash-muted transition-colors hover:text-dash-text"
                  }
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>
          
          <div className="lg:col-span-3">
            <p
              className={
                isTenantMode
                  ? "mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500"
                  : "mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-dash-faint"
              }
            >
              More
            </p>
            <nav className="flex flex-col gap-3">
              {links.secondary.map((link) => (
                <Link
                  key={link.href}
                  href={withTenantQuery(link.href)}
                  className={
                    isTenantMode
                      ? "text-sm text-slate-400 transition-colors hover:text-white"
                      : "text-sm text-dash-muted transition-colors hover:text-dash-text"
                  }
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>
        </div>
        
        <div
          className={
            isTenantMode
              ? "mt-16 border-t border-white/10 pt-8"
              : "mt-16 border-t border-dash-border pt-8"
          }
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className={isTenantMode ? "text-xs text-slate-500" : "text-xs text-dash-faint"}>
              © {new Date().getFullYear()} {isTenantMode ? branding?.name ?? "Covenant Lodge No. 4344" : "LodgePay"}.
              {" "}All rights reserved.
            </p>
            <div className={isTenantMode ? "flex flex-wrap gap-5 text-xs text-slate-500" : "flex flex-wrap gap-5 text-xs text-dash-faint"}>
              {isTenantMode ? (
                <p>
                  Powered by{" "}
                  <Link href="/" className="font-medium text-slate-400 transition-colors hover:text-white">
                    Covenant Platform
                  </Link>
                </p>
              ) : (
                <>
                  <Link href="/privacy" className="transition-colors hover:text-dash-muted">
                    Privacy
                  </Link>
                  <Link href="/terms" className="transition-colors hover:text-dash-muted">
                    Terms
                  </Link>
                  <Link href="/gdpr" className="transition-colors hover:text-dash-muted">
                    GDPR
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
