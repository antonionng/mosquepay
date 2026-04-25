"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useState, useEffect, useMemo } from "react";
import { Menu, X, Facebook, Instagram, Linkedin, Twitter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { resolveLodgeSlug } from "@/lib/tenant";

const tenantNavLinks = [
  { href: "/", label: "Home" },
  { href: "/events", label: "Events" },
  { href: "/charity", label: "Charity" },
  { href: "/news", label: "News" },
  { href: "/contact", label: "Contact" },
];

const marketingNavLinks = [
  { href: "/product", label: "Product" },
  { href: "/features", label: "Features" },
  { href: "/pricing", label: "Pricing" },
  { href: "/case-studies", label: "Case Studies" },
];

type LodgeBranding = {
  name: string;
  city: string | null;
  tagline: string | null;
};

const FIGMA_LOGO_UNION_A = "https://www.figma.com/api/mcp/asset/ef598919-60f8-44ed-b2d2-0b9728871181";
const FIGMA_LOGO_UNION_B = "https://www.figma.com/api/mcp/asset/cd781fc9-aac4-47a8-b5e9-e39fe0614889";

function initialsFromName(name: string) {
  const words = name.split(" ").filter(Boolean);
  if (words.length === 0) return "LG";
  return words
    .slice(0, 2)
    .map((word) => word.charAt(0))
    .join("")
    .toUpperCase();
}

function LodgePayFigmaMark({ className = "" }: { className?: string }) {
  return (
    <div className={`relative h-7 w-8 ${className}`} aria-hidden="true">
      <img src={FIGMA_LOGO_UNION_A} alt="" className="absolute bottom-0 left-0 h-6 w-5 object-contain" />
      <img src={FIGMA_LOGO_UNION_B} alt="" className="absolute right-0 top-0 h-6 w-5 object-contain" />
    </div>
  );
}

export function PublicHeader() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [branding, setBranding] = useState<LodgeBranding | null>(null);
  const isHome = pathname === "/";
  const rawLodgeQuery = searchParams.get("lodge");
  const isTenantMode = Boolean(rawLodgeQuery);
  const lodgeSlug = useMemo(
    () => resolveLodgeSlug(rawLodgeQuery),
    [rawLodgeQuery]
  );
  const navLinks = isTenantMode ? tenantNavLinks : marketingNavLinks;

  const withTenantQuery = (href: string) =>
    isTenantMode ? `${href}?lodge=${encodeURIComponent(lodgeSlug)}` : href;

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

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

  const solidHeader = scrolled || !isHome;

  return (
    <header
      className={cn(
        "fixed top-0 z-50 w-full transition-all duration-300",
        isTenantMode
          ? solidHeader
            ? "border-b border-slate-200 bg-white/90 backdrop-blur-xl"
            : "bg-transparent"
          : "border-b border-slate-200 bg-white"
      )}
    >
      {!isTenantMode ? (
        <div className="hidden border-b border-slate-200 bg-white lg:block">
          <div className="container-full flex h-10 items-center justify-between text-xs text-slate-600">
            <div className="flex items-center gap-3">
              <span>Phone: +44 20 7946 0987</span>
              <span className="text-slate-300">|</span>
              <span>Email: team@lodgepay.co.uk</span>
            </div>
            <div className="flex items-center gap-3">
              <Facebook className="h-3.5 w-3.5" />
              <Instagram className="h-3.5 w-3.5" />
              <Twitter className="h-3.5 w-3.5" />
              <Linkedin className="h-3.5 w-3.5" />
            </div>
          </div>
        </div>
      ) : null}

      <div className="container-full flex h-18 items-center justify-between py-3 lg:h-20">
        <Link href={withTenantQuery("/")} className="flex items-center gap-3">
          {isTenantMode ? (
            <>
              <div
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-xl border text-[11px] font-semibold tracking-[0.2em] transition-colors",
                  isTenantMode && !solidHeader
                    ? "border-white/20 bg-white/10 text-white"
                    : "border-slate-200 bg-slate-950 text-white"
                )}
              >
                {initialsFromName(branding?.name ?? "Covenant Lodge")}
              </div>
              <div className="min-w-0">
                <p
                  className={cn(
                    "text-sm font-semibold tracking-tight transition-colors",
                    isTenantMode && !solidHeader ? "text-white" : "text-slate-950"
                  )}
                >
                  {branding?.name ?? "Covenant Lodge"}
                </p>
                <p
                  className={cn(
                    "text-xs transition-colors",
                    isTenantMode && !solidHeader ? "text-slate-300" : "text-slate-500"
                  )}
                >
                  {`No. 4344 · ${branding?.city ?? "Mayfair, London"}`}
                </p>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <LodgePayFigmaMark />
              <span className="text-lg font-semibold tracking-tight text-slate-950">LodgePay</span>
            </div>
          )}
        </Link>

        <nav className="hidden items-center gap-1 lg:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={withTenantQuery(link.href)}
              className={cn(
                "rounded-full px-4 py-2 text-sm font-medium transition-colors",
                isTenantMode && !solidHeader
                  ? "text-slate-200 hover:bg-white/10 hover:text-white"
                  : "text-slate-700 hover:bg-slate-100 hover:text-slate-950"
              )}
            >
              {link.label}
            </Link>
          ))}
          <div className="ml-4 border-l pl-4 border-slate-200/20">
            <Button
              asChild
              size="sm"
              variant={solidHeader ? "primary" : "secondary"}
              className={cn(
                isTenantMode && !solidHeader
                  ? "border-white/10 bg-white text-slate-950 hover:bg-slate-100"
                  : "bg-slate-950 text-white hover:bg-slate-800"
              )}
            >
              <Link href={withTenantQuery(isTenantMode ? "/join" : "/book-demo")}>
                {isTenantMode ? "Join Us" : "Book Demo"}
              </Link>
            </Button>
          </div>
        </nav>

        <button
          className={cn(
            "rounded-xl p-2 transition-colors lg:hidden",
            isTenantMode && !solidHeader
              ? "text-white hover:bg-white/10"
              : "text-slate-700 hover:bg-slate-100"
          )}
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      <div
        className={cn(
          "fixed inset-x-0 top-[72px] overflow-hidden border-b border-slate-200 bg-white transition-all duration-300 lg:hidden",
          mobileOpen ? "max-h-[420px] opacity-100" : "max-h-0 opacity-0"
        )}
      >
        <nav className="container-full flex flex-col gap-1 py-4">
          {!isTenantMode ? (
            <div className="mb-2 flex items-center gap-2 px-3 py-2 text-sm font-semibold text-slate-900">
              <LodgePayFigmaMark />
              <span>LodgePay</span>
            </div>
          ) : null}
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={withTenantQuery(link.href)}
              className="rounded-xl px-3 py-3 text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-950"
              onClick={() => setMobileOpen(false)}
            >
              {link.label}
            </Link>
          ))}
          <div className="mt-3 border-t border-slate-200 pt-4">
            <Button asChild className="w-full" variant="primary">
              <Link
                href={withTenantQuery(isTenantMode ? "/join" : "/book-demo")}
                onClick={() => setMobileOpen(false)}
              >
                {isTenantMode ? "Join Us" : "Book Demo"}
              </Link>
            </Button>
          </div>
        </nav>
      </div>
    </header>
  );
}
