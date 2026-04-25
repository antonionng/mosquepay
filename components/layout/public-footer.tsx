"use client";

import Link from "next/link";
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
    { href: "/case-studies", label: "Case Studies" },
    { href: "/contact", label: "Contact" },
    { href: "/?lodge=covenant-4344", label: "Covenant Showcase" },
    { href: "/admin", label: "Platform Admin" },
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
          : "border-t border-stone-300 bg-stone-200 text-slate-900"
      }
    >
      <div className="container-full py-16 lg:py-20">
        <div className="grid gap-14 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <div className="mb-5 flex items-center gap-3">
              <div
                className={
                  isTenantMode
                    ? "flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-[11px] font-semibold tracking-[0.2em]"
                    : "flex h-10 w-10 items-center justify-center rounded-xl border border-slate-300 bg-white text-[11px] font-semibold tracking-[0.2em]"
                }
              >
                {initialsFromName(isTenantMode ? branding?.name ?? "Covenant Lodge" : "LodgePay")}
              </div>
              <div>
                <p className="text-base font-semibold tracking-tight">
                  {isTenantMode ? branding?.name ?? "Covenant Lodge" : "LodgePay"}
                </p>
                <p className={isTenantMode ? "text-sm text-slate-400" : "text-sm text-slate-600"}>
                  {isTenantMode
                    ? `No. 4344 · ${branding?.city ?? "Mayfair, London"}`
                    : "Lodge websites, payments, and candidate CRM"}
                </p>
              </div>
            </div>
            <p
              className={
                isTenantMode
                  ? "max-w-md text-sm leading-relaxed text-slate-400"
                  : "max-w-md text-sm leading-relaxed text-slate-600"
              }
            >
              {isTenantMode
                ? branding?.tagline ??
                  "A lodge website powered by LodgePay, helping members and visitors navigate events and enquiries."
                : "LodgePay is a multi-tenant platform for lodges to launch modern sites, collect payments, and nurture candidates from enquiry to initiation."}
            </p>
            <div
              className={
                isTenantMode
                  ? "mt-6 flex flex-wrap gap-3 text-xs text-slate-400"
                  : "mt-6 flex flex-wrap gap-3 text-xs text-slate-600"
              }
            >
              <span
                className={
                  isTenantMode
                    ? "rounded-full border border-white/10 bg-white/5 px-3 py-1.5"
                    : "rounded-full border border-slate-300 bg-white px-3 py-1.5"
                }
              >
                Established 1922
              </span>
              <span
                className={
                  isTenantMode
                    ? "rounded-full border border-white/10 bg-white/5 px-3 py-1.5"
                    : "rounded-full border border-slate-300 bg-white px-3 py-1.5"
                }
              >
                Mark Masons&apos; Hall
              </span>
            </div>
          </div>
          
          <div className="lg:col-span-3">
            <p
              className={
                isTenantMode
                  ? "mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500"
                  : "mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700"
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
                      : "text-sm text-slate-700 transition-colors hover:text-slate-950"
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
                  : "mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700"
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
                      : "text-sm text-slate-700 transition-colors hover:text-slate-950"
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
              : "mt-16 border-t border-stone-300 pt-8"
          }
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className={isTenantMode ? "text-xs text-slate-500" : "text-xs text-slate-600"}>
              © {new Date().getFullYear()} {isTenantMode ? branding?.name ?? "Covenant Lodge No. 4344" : "LodgePay"}.
              {" "}All rights reserved.
            </p>
            <p className={isTenantMode ? "text-xs text-slate-500" : "text-xs text-slate-600"}>
              {isTenantMode ? (
                <>
                  Powered by{" "}
                  <Link href="/" className="font-medium text-slate-400 transition-colors hover:text-white">
                    Covenant Platform
                  </Link>
                </>
              ) : (
                "Built for modern lodge operations"
              )}
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
